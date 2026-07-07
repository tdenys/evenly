import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Amount, Envelope } from '@/core/waterfall/types';
import { findSiblings } from '@/core/waterfall/tree';
import type { PaydayAction, PaydayAmount } from '@/core/payday/types';
import { orderCouple } from '@/lib/couple';

export type PaydayActionRow = PaydayAction & { ownerId: string };

export interface Profile {
  id: string;
  displayName: string;
  coupleId: string | null;
  netIncome: number;
}

export interface Couple {
  id: string;
  inviteCode: string;
}

export type AppStatus = 'loading' | 'signedOut' | 'needsCouple' | 'waitingForPartner' | 'ready';

interface StoreState {
  status: AppStatus;
  profile: Profile | null;
  partner: Profile | null;
  couple: Couple | null;
  envelopes: Envelope[];
  paydayActions: PaydayActionRow[];
  error: string | null;

  init: () => void;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createCouple: () => Promise<string>;
  joinCouple: (inviteCode: string) => Promise<void>;
  refresh: () => Promise<void>;
  updateMyIncome: (netIncome: number) => Promise<void>;
  updatePartnerIncome: (netIncome: number) => Promise<void>;
  loadEnvelopes: () => Promise<void>;
  createEnvelope: (input: {
    label: string;
    emoji: string;
    priority: number;
    allocation: Amount;
    enabled: boolean;
    fundedBy: 'A' | 'B' | 'both' | null;
    parentId: string | null;
  }) => Promise<void>;
  updateEnvelope: (
    id: string,
    input: {
      label: string;
      emoji: string;
      priority: number;
      allocation: Amount;
      enabled: boolean;
      fundedBy: 'A' | 'B' | 'both' | null;
    }
  ) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  reorderEnvelopeTo: (id: string, targetIndex: number) => Promise<void>;
  setEnvelopeEnabled: (id: string, enabled: boolean) => Promise<void>;
  loadPaydayActions: () => Promise<void>;
  createPaydayAction: (input: {
    ownerId: string;
    label: string;
    priority: number;
    amount: PaydayAmount;
  }) => Promise<void>;
  updatePaydayAction: (
    id: string,
    input: { ownerId: string; label: string; priority: number; amount: PaydayAmount }
  ) => Promise<void>;
  deletePaydayAction: (id: string) => Promise<void>;
  reorderPaydayActionTo: (id: string, targetIndex: number) => Promise<void>;
}

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export const useStore = create<StoreState>((set, get) => ({
  status: 'loading',
  profile: null,
  partner: null,
  couple: null,
  envelopes: [],
  paydayActions: [],
  error: null,

  init: () => {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        set({
          status: 'signedOut',
          profile: null,
          partner: null,
          couple: null,
          envelopes: [],
          paydayActions: [],
        });
        return;
      }
      void loadCoupleData(session.user.id, set, get);
    });
  },

  signUp: async (email, password, displayName) => {
    set({ error: null });
    // display_name is read by the `handle_new_user` DB trigger (see supabase/migration.sql),
    // which creates the `profiles` row atomically with the auth.users insert — this avoids a
    // race with the onAuthStateChange listener querying `profiles` before a client-side insert
    // would have landed.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  createCouple: async () => {
    const { profile } = get();
    if (!profile) throw new Error('Profil introuvable.');

    let created = false;
    let inviteCode = '';
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      inviteCode = generateInviteCode();
      const { error } = await supabase.rpc('create_couple', { p_invite_code: inviteCode });
      if (error) {
        if (error.code === '23505') continue; // invite code collision, retry
        throw error;
      }
      created = true;
    }
    if (!created) throw new Error("Impossible de générer un code d'invitation, réessaie.");

    await loadCoupleData(profile.id, set, get);
    return inviteCode;
  },

  joinCouple: async (inviteCode: string) => {
    const { profile } = get();
    if (!profile) throw new Error('Profil introuvable.');

    const { error } = await supabase.rpc('join_couple', {
      p_invite_code: inviteCode.trim().toUpperCase(),
    });
    if (error) throw new Error("Code d'invitation invalide.");

    await loadCoupleData(profile.id, set, get);
  },

  refresh: async () => {
    const { profile } = get();
    if (!profile) return;
    await loadCoupleData(profile.id, set, get);
  },

  updateMyIncome: async (netIncome: number) => {
    const { profile } = get();
    if (!profile) throw new Error('Profil introuvable.');

    const { error } = await supabase.from('profiles').update({ net_income: netIncome }).eq('id', profile.id);
    if (error) throw error;

    await get().refresh();
  },

  updatePartnerIncome: async (netIncome: number) => {
    // La policy RLS "update own profile" n'autorise que id = auth.uid() — modifier le revenu
    // du/de la partenaire passe donc par le RPC security definer update_partner_income (voir
    // supabase/migration.sql), qui ne touche que sa colonne net_income.
    const { error } = await supabase.rpc('update_partner_income', { p_net_income: netIncome });
    if (error) throw error;

    await get().refresh();
  },

  loadEnvelopes: async () => {
    const { couple } = get();
    if (!couple) return;

    const { data, error } = await supabase
      .from('envelopes')
      .select('id, parent_id, label, emoji, priority, allocation, enabled, funded_by')
      .eq('couple_id', couple.id)
      .order('priority', { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const byParent = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const key = row.parent_id;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(row);
    }
    const build = (parentId: string | null): Envelope[] =>
      (byParent.get(parentId) ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        emoji: row.emoji,
        priority: row.priority,
        allocation: row.allocation as Amount,
        enabled: row.enabled,
        fundedBy: row.funded_by as 'A' | 'B' | 'both' | null,
        children: build(row.id),
      }));

    set({ envelopes: build(null) });
  },

  createEnvelope: async (input) => {
    const { couple } = get();
    if (!couple) throw new Error('Aucun couple actif.');

    const { data, error } = await supabase
      .from('envelopes')
      .insert({
        couple_id: couple.id,
        parent_id: input.parentId,
        label: input.label,
        emoji: input.emoji,
        priority: input.priority,
        allocation: input.allocation,
        enabled: input.enabled,
        funded_by: input.fundedBy,
      })
      .select('id')
      .single();
    if (error) throw error;

    await get().loadEnvelopes();
    await syncPaydayActionsForEnvelope(data.id, input.fundedBy, input.label, input.emoji, get);
  },

  updateEnvelope: async (id, input) => {
    const { error } = await supabase
      .from('envelopes')
      .update({
        label: input.label,
        emoji: input.emoji,
        priority: input.priority,
        allocation: input.allocation,
        enabled: input.enabled,
        funded_by: input.fundedBy,
      })
      .eq('id', id);
    if (error) throw error;

    await get().loadEnvelopes();
    await syncPaydayActionsForEnvelope(id, input.fundedBy, input.label, input.emoji, get);
  },

  deleteEnvelope: async (id) => {
    // Nettoie d'abord les actions payday liées (référence vivante — une action pointant vers
    // une enveloppe supprimée n'a plus de sens), sur un état payday_actions frais (l'utilisateur
    // n'a peut-être jamais ouvert l'onglet Salaire cette session).
    await get().loadPaydayActions();
    const linked = get().paydayActions.filter(
      (a) => a.amount.type === 'envelope' && a.amount.envelopeId === id
    );
    await Promise.all(linked.map((a) => supabase.from('payday_actions').delete().eq('id', a.id)));

    const { error } = await supabase.from('envelopes').delete().eq('id', id);
    if (error) throw error;

    await get().loadEnvelopes();
    if (linked.length > 0) await get().loadPaydayActions();
  },

  setEnvelopeEnabled: async (id, enabled) => {
    const { error } = await supabase.from('envelopes').update({ enabled }).eq('id', id);
    if (error) throw error;

    await get().loadEnvelopes();
  },

  reorderEnvelopeTo: async (id, targetIndex) => {
    const { envelopes } = get();
    const siblings = findSiblings(envelopes, id);
    if (!siblings) return;

    const currentIndex = siblings.findIndex((e) => e.id === id);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Renumérote toutes les enveloppes sœurs selon leur nouvel ordre (le drag & drop peut
    // déplacer un élément de plusieurs positions d'un coup, contrairement à un simple échange
    // de voisins).
    const results = await Promise.all(
      reordered.map((envelope, index) =>
        supabase.from('envelopes').update({ priority: index + 1 }).eq('id', envelope.id)
      )
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) throw firstError;

    await get().loadEnvelopes();
  },

  loadPaydayActions: async () => {
    const { couple } = get();
    if (!couple) return;

    const { data, error } = await supabase
      .from('payday_actions')
      .select('id, owner, label, priority, amount')
      .eq('couple_id', couple.id)
      .order('priority', { ascending: true });
    if (error) throw error;

    const paydayActions: PaydayActionRow[] = (data ?? []).map((row) => ({
      id: row.id,
      ownerId: row.owner,
      label: row.label,
      priority: row.priority,
      amount: row.amount as PaydayAmount,
    }));

    set({ paydayActions });
  },

  createPaydayAction: async (input) => {
    const { couple } = get();
    if (!couple) throw new Error('Aucun couple actif.');

    const { error } = await supabase.from('payday_actions').insert({
      couple_id: couple.id,
      owner: input.ownerId,
      label: input.label,
      priority: input.priority,
      amount: input.amount,
    });
    if (error) throw error;

    await get().loadPaydayActions();
  },

  updatePaydayAction: async (id, input) => {
    const { error } = await supabase
      .from('payday_actions')
      .update({
        owner: input.ownerId,
        label: input.label,
        priority: input.priority,
        amount: input.amount,
      })
      .eq('id', id);
    if (error) throw error;

    await get().loadPaydayActions();
  },

  deletePaydayAction: async (id) => {
    const { error } = await supabase.from('payday_actions').delete().eq('id', id);
    if (error) throw error;

    await get().loadPaydayActions();
  },

  reorderPaydayActionTo: async (id, targetIndex) => {
    const { paydayActions } = get();
    const moving = paydayActions.find((a) => a.id === id);
    if (!moving) return;

    const siblings = paydayActions.filter((a) => a.ownerId === moving.ownerId);
    const currentIndex = siblings.findIndex((a) => a.id === id);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const results = await Promise.all(
      reordered.map((action, index) =>
        supabase.from('payday_actions').update({ priority: index + 1 }).eq('id', action.id)
      )
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) throw firstError;

    await get().loadPaydayActions();
  },
}));

/** Réconcilie les payday_actions "référence vivante" (amount.type === 'envelope') d'une
 * enveloppe avec son `fundedBy` actuel — crée/supprime des lignes selon les personnes
 * attendues, mais ne touche jamais au montant (toujours recalculé à l'affichage, jamais copié
 * ici). Appelée après chaque save d'enveloppe (create/update) dans useStore.ts. */
async function syncPaydayActionsForEnvelope(
  envelopeId: string,
  fundedBy: 'A' | 'B' | 'both' | null,
  label: string,
  emoji: string,
  get: () => StoreState
) {
  const { profile, partner, couple } = get();
  if (!profile || !partner || !couple) return;

  // Repart d'un état payday_actions frais : l'utilisateur n'a peut-être jamais ouvert l'onglet
  // Salaire cette session, un état local vide ferait croire à tort qu'aucune action n'existe.
  await get().loadPaydayActions();
  const { paydayActions } = get();

  const { personA, personB } = orderCouple(profile, partner);
  const expectedOwnerIds =
    fundedBy === 'A'
      ? [personA.id]
      : fundedBy === 'B'
        ? [personB.id]
        : fundedBy === 'both'
          ? [personA.id, personB.id]
          : [];

  const linked = paydayActions.filter(
    (a) => a.amount.type === 'envelope' && a.amount.envelopeId === envelopeId
  );

  const toDelete = linked.filter((a) => !expectedOwnerIds.includes(a.ownerId));
  const existingOwnerIds = new Set(linked.map((a) => a.ownerId));
  const toCreateOwnerIds = expectedOwnerIds.filter((ownerId) => !existingOwnerIds.has(ownerId));

  await Promise.all([
    ...toDelete.map((a) => supabase.from('payday_actions').delete().eq('id', a.id)),
    ...toCreateOwnerIds.map((ownerId) => {
      const ownerActions = paydayActions.filter((a) => a.ownerId === ownerId);
      const nextPriority = ownerActions.length > 0 ? Math.max(...ownerActions.map((a) => a.priority)) + 1 : 1;
      return supabase.from('payday_actions').insert({
        couple_id: couple.id,
        owner: ownerId,
        label: `${emoji} ${label}`,
        priority: nextPriority,
        amount: { type: 'envelope', envelopeId },
      });
    }),
  ]);

  if (toDelete.length > 0 || toCreateOwnerIds.length > 0) {
    await get().loadPaydayActions();
  }
}

async function loadCoupleData(
  userId: string,
  set: (partial: Partial<StoreState>) => void,
  get: () => StoreState
) {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, couple_id, net_income')
    .eq('id', userId)
    .single();
  if (profileError) {
    set({ error: profileError.message, status: 'signedOut' });
    return;
  }

  const profile: Profile = {
    id: profileRow.id,
    displayName: profileRow.display_name,
    coupleId: profileRow.couple_id,
    netIncome: Number(profileRow.net_income),
  };

  if (!profile.coupleId) {
    set({ status: 'needsCouple', profile, partner: null, couple: null });
    return;
  }

  const { data: coupleRow, error: coupleError } = await supabase
    .from('couples')
    .select('id, invite_code')
    .eq('id', profile.coupleId)
    .single();
  if (coupleError) {
    set({ error: coupleError.message });
    return;
  }
  const couple: Couple = { id: coupleRow.id, inviteCode: coupleRow.invite_code };

  const { data: partnerRow } = await supabase
    .from('profiles')
    .select('id, display_name, couple_id, net_income')
    .eq('couple_id', couple.id)
    .neq('id', userId)
    .maybeSingle();
  const partner: Profile | null = partnerRow
    ? {
        id: partnerRow.id,
        displayName: partnerRow.display_name,
        coupleId: partnerRow.couple_id,
        netIncome: Number(partnerRow.net_income),
      }
    : null;

  if (!partner) {
    set({ status: 'waitingForPartner', profile, couple, partner: null });
    return;
  }

  set({ status: 'ready', profile, couple, partner, error: null });
}
