-- Budget Couple — schéma initial + RLS
-- À coller dans le SQL Editor du dashboard Supabase et exécuter une seule fois.

create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  couple_id uuid references couples(id),
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  payer_id uuid not null references profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  category text not null,
  label text,
  created_at timestamptz not null default now()
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  from_user uuid not null references profiles(id),
  to_user uuid not null references profiles(id),
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Crée automatiquement la ligne `profiles` dès qu'un utilisateur s'inscrit.
-- Tourne dans la même transaction que l'insert dans auth.users (trigger), donc pas de
-- course possible avec un insert séparé fait depuis le client juste après signUp().
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Utilisateur'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: couple_id de l'utilisateur connecté
create function auth_couple_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select couple_id from profiles where id = auth.uid();
$$;

-- Créer un couple. security definer : la policy "select own couple" n'autorise à lire
-- que le couple déjà lié au profil, or juste après l'insert le profil n'est pas encore
-- lié — un insert().select() direct depuis le client échouerait donc côté RLS. On fait
-- l'insert + la liaison du profil dans la même transaction serveur, comme join_couple().
create function create_couple(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  insert into couples (invite_code) values (p_invite_code) returning id into v_couple_id;
  update profiles set couple_id = v_couple_id where id = auth.uid();
  return v_couple_id;
end;
$$;

-- Rejoindre un couple par code d'invitation.
-- security definer : le client n'a pas le droit de SELECT la table `couples` par code
-- (RLS ne l'autorise que pour son propre couple une fois lié), donc le lookup + la
-- mise à jour du profil passent par cette fonction plutôt que par des requêtes directes.
create function join_couple(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select id into v_couple_id from couples where invite_code = p_invite_code;

  if v_couple_id is null then
    raise exception 'invite code not found';
  end if;

  update profiles set couple_id = v_couple_id where id = auth.uid();

  return v_couple_id;
end;
$$;

alter table couples enable row level security;
alter table profiles enable row level security;
alter table expenses enable row level security;
alter table settlements enable row level security;

-- couples: un utilisateur ne peut voir que son propre couple une fois lié.
-- Création (create_couple) et jonction (join_couple) passent par des fonctions
-- security definer, donc aucune policy INSERT n'est nécessaire ici.
create policy "select own couple" on couples
  for select to authenticated using (id = auth_couple_id());

-- profiles: un utilisateur voit son profil + celui de son partenaire, et gère le sien
create policy "select own or partner profile" on profiles
  for select to authenticated using (id = auth.uid() or couple_id = auth_couple_id());

create policy "insert own profile" on profiles
  for insert to authenticated with check (id = auth.uid());

create policy "update own profile" on profiles
  for update to authenticated using (id = auth.uid());

-- expenses: visibles/insérables uniquement pour le couple de l'utilisateur
create policy "select couple expenses" on expenses
  for select to authenticated using (couple_id = auth_couple_id());

create policy "insert couple expenses" on expenses
  for insert to authenticated with check (couple_id = auth_couple_id() and payer_id = auth.uid());

-- settlements: pareil
create policy "select couple settlements" on settlements
  for select to authenticated using (couple_id = auth_couple_id());

create policy "insert couple settlements" on settlements
  for insert to authenticated with check (couple_id = auth_couple_id());

grant execute on function join_couple(text) to authenticated;
grant execute on function create_couple(text) to authenticated;

-- Le rôle `authenticated` a besoin du droit SQL brut sur les tables en plus des policies RLS
-- (RLS restreint les lignes visibles/écrivables, il ne remplace pas le GRANT lui-même).
-- couples/profiles n'ont besoin que de SELECT côté client : la création/liaison passe par
-- les fonctions security definer ci-dessus.
grant select on couples to authenticated;
grant select, update on profiles to authenticated;
grant select, insert on expenses to authenticated;
grant select, insert on settlements to authenticated;

-- Realtime: permet à Supabase Realtime de streamer les inserts sur ces tables
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table settlements;
