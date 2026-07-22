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

-- ============================================================
-- V2 — Waterfall (enveloppes seules, sans règles/goals/pots)
-- ============================================================

alter table profiles add column net_income numeric(10,2) not null default 0;

create table envelopes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  label text not null,
  emoji text not null default '💰',
  priority int not null,
  allocation jsonb not null, -- sérialisation directe du type Amount (src/core/waterfall/types.ts)
  created_at timestamptz not null default now()
);

alter table envelopes enable row level security;

create policy "select couple envelopes" on envelopes
  for select to authenticated using (couple_id = auth_couple_id());
create policy "insert couple envelopes" on envelopes
  for insert to authenticated with check (couple_id = auth_couple_id());
create policy "update couple envelopes" on envelopes
  for update to authenticated using (couple_id = auth_couple_id());
create policy "delete couple envelopes" on envelopes
  for delete to authenticated using (couple_id = auth_couple_id());

grant select, insert, update, delete on envelopes to authenticated;

-- ============================================================
-- V2 — Sous-enveloppes récursives
-- ============================================================

alter table envelopes add column parent_id uuid references envelopes(id) on delete cascade;

-- ============================================================
-- V2 — Activer / désactiver une enveloppe (matelas de sécurité plein, etc.)
-- ============================================================

alter table envelopes add column enabled boolean not null default true;

-- ============================================================
-- V2 — Modifier le revenu du/de la partenaire (les 2 salaires éditables
-- depuis n'importe quel compte)
-- ============================================================

-- security definer : la policy "update own profile" n'autorise que id = auth.uid(), et on ne
-- veut pas l'élargir à toute la ligne du/de la partenaire (label, couple_id...) juste pour ce
-- besoin — cette fonction ne touche donc que la colonne net_income, et seulement pour le/la
-- partenaire du même couple que l'appelant.
create function update_partner_income(p_net_income numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from profiles where id = auth.uid();
  if v_couple_id is null then
    raise exception 'not in a couple';
  end if;

  update profiles set net_income = p_net_income
  where couple_id = v_couple_id and id <> auth.uid();
end;
$$;

grant execute on function update_partner_income(numeric) to authenticated;

-- ============================================================
-- V2 — Payday Flow (dispatch de salaire)
-- ============================================================

create table payday_actions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  owner uuid not null references profiles(id), -- de qui est ce salaire
  label text not null,
  priority int not null,
  amount jsonb not null, -- sérialisation directe de PaydayAmount (src/core/payday/types.ts)
  created_at timestamptz not null default now()
);

alter table payday_actions enable row level security;

-- Policies larges comme envelopes : n'importe quel membre du couple peut gérer les actions des
-- deux personnes (cohérent avec update_partner_income ci-dessus).
create policy "select couple payday actions" on payday_actions
  for select to authenticated using (couple_id = auth_couple_id());
create policy "insert couple payday actions" on payday_actions
  for insert to authenticated with check (couple_id = auth_couple_id());
create policy "update couple payday actions" on payday_actions
  for update to authenticated using (couple_id = auth_couple_id());
create policy "delete couple payday actions" on payday_actions
  for delete to authenticated using (couple_id = auth_couple_id());

grant select, insert, update, delete on payday_actions to authenticated;

-- ============================================================
-- V2 — Lier une enveloppe au Payday Flow ("financée par")
-- ============================================================

alter table envelopes add column funded_by text; -- 'A' | 'B' | 'both' | null

-- ============================================================
-- V2 — Rappel de versement (notification locale mensuelle)
-- ============================================================

alter table profiles add column payday_day integer check (payday_day between 1 and 31);

-- ============================================================
-- V2 — Jour de versement éditable depuis n'importe quel compte
-- ============================================================

-- Même principe que update_partner_income : la policy "update own profile" n'autorise que
-- id = auth.uid(), donc modifier le jour du/de la partenaire passe par ce RPC security definer.
-- Note : le rappel local ne peut se programmer que sur l'appareil de la personne concernée —
-- si on modifie le jour du/de la partenaire depuis son propre téléphone, la programmation
-- effective se fera seulement quand cette personne rouvrira l'app sur SON appareil (voir la
-- réconciliation dans PaydayScreen.tsx).
create function update_partner_payday_day(p_payday_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from profiles where id = auth.uid();
  if v_couple_id is null then
    raise exception 'not in a couple';
  end if;

  update profiles set payday_day = p_payday_day
  where couple_id = v_couple_id and id <> auth.uid();
end;
$$;

grant execute on function update_partner_payday_day(integer) to authenticated;

-- ============================================================
-- V2 — Description libre sur une action Payday
-- ============================================================

alter table payday_actions add column description text not null default '';

-- ============================================================
-- V2 — Abonnements (registre autonome, pas lié à Waterfall/Répartition)
-- ============================================================

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  title text not null,
  cost numeric(10,2) not null check (cost >= 0),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  category text not null default '',
  assigned_to text not null check (assigned_to in ('A','B','both')),
  created_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Policies larges comme envelopes/payday_actions : n'importe quel membre du couple gère tous
-- les abonnements.
create policy "select couple subscriptions" on subscriptions
  for select to authenticated using (couple_id = auth_couple_id());
create policy "insert couple subscriptions" on subscriptions
  for insert to authenticated with check (couple_id = auth_couple_id());
create policy "update couple subscriptions" on subscriptions
  for update to authenticated using (couple_id = auth_couple_id());
create policy "delete couple subscriptions" on subscriptions
  for delete to authenticated using (couple_id = auth_couple_id());

grant select, insert, update, delete on subscriptions to authenticated;

-- ============================================================
-- V2 — Prénom (display_name) éditable depuis n'importe quel compte
-- ============================================================

-- Même principe que update_partner_income / update_partner_payday_day : la policy
-- "update own profile" n'autorise que id = auth.uid(), donc modifier le prénom du/de la
-- partenaire passe par ce RPC security definer, qui ne touche que sa colonne display_name.
create function update_partner_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from profiles where id = auth.uid();
  if v_couple_id is null then
    raise exception 'not in a couple';
  end if;

  update profiles set display_name = p_display_name
  where couple_id = v_couple_id and id <> auth.uid();
end;
$$;

grant execute on function update_partner_display_name(text) to authenticated;

-- ============================================================
-- V2 — Comptes de destination (liste paramétrable par l'utilisateur)
-- ============================================================

create table accounts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  label text not null,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

-- Policies larges comme subscriptions/envelopes/payday_actions : n'importe quel membre du
-- couple gère tous les comptes.
create policy "select couple accounts" on accounts
  for select to authenticated using (couple_id = auth_couple_id());
create policy "insert couple accounts" on accounts
  for insert to authenticated with check (couple_id = auth_couple_id());
create policy "update couple accounts" on accounts
  for update to authenticated using (couple_id = auth_couple_id());
create policy "delete couple accounts" on accounts
  for delete to authenticated using (couple_id = auth_couple_id());

grant select, insert, update, delete on accounts to authenticated;

-- ============================================================
-- V2 — Lier un compte de destination à une action Payday
-- ============================================================

-- Nullable + on delete set null : contrairement à envelopes.parent_id (cascade), supprimer un
-- compte ne doit jamais supprimer les actions qui pointaient dessus — elles perdent juste leur
-- compte affiché (redevient "Aucun"), l'utilisateur peut leur en réassigner un autre ensuite.
alter table payday_actions add column account_id uuid references accounts(id) on delete set null;
