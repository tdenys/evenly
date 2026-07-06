import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { calculateBalance, type Balance } from '@/core/balance/calculateBalance';
import type { Amount, Envelope } from '@/core/waterfall/types';
import { findSiblings } from '@/core/waterfall/tree';

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

export interface Expense {
  id: string;
  payerId: string;
  amount: number;
  category: string;
  label: string | null;
  createdAt: string;
}

export interface Settlement {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  createdAt: string;
}

export type AppStatus = 'loading' | 'signedOut' | 'needsCouple' | 'waitingForPartner' | 'ready';

interface StoreState {
  status: AppStatus;
  profile: Profile | null;
  partner: Profile | null;
  couple: Couple | null;
  expenses: Expense[];
  settlements: Settlement[];
  envelopes: Envelope[];
  error: string | null;

  init: () => void;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createCouple: () => Promise<string>;
  joinCouple: (inviteCode: string) => Promise<void>;
  addExpense: (amount: number, category: string, label?: string) => Promise<void>;
  settleUp: () => Promise<void>;
  refresh: () => Promise<void>;
  balance: () => Balance | null;
  updateMyIncome: (netIncome: number) => Promise<void>;
  loadEnvelopes: () => Promise<void>;
  createEnvelope: (input: {
    label: string;
    emoji: string;
    priority: number;
    allocation: Amount;
    parentId: string | null;
  }) => Promise<void>;
  updateEnvelope: (
    id: string,
    input: { label: string; emoji: string; priority: number; allocation: Amount }
  ) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  reorderEnvelopeTo: (id: string, targetIndex: number) => Promise<void>;
}

let realtimeChannel: RealtimeChannel | null = null;

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

function teardownRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

export const useStore = create<StoreState>((set, get) => ({
  status: 'loading',
  profile: null,
  partner: null,
  couple: null,
  expenses: [],
  settlements: [],
  envelopes: [],
  error: null,

  init: () => {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        teardownRealtime();
        set({
          status: 'signedOut',
          profile: null,
          partner: null,
          couple: null,
          expenses: [],
          settlements: [],
          envelopes: [],
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
    teardownRealtime();
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

  addExpense: async (amount, category, label) => {
    const { profile, couple } = get();
    if (!profile || !couple) throw new Error('Aucun couple actif.');

    const { error } = await supabase.from('expenses').insert({
      couple_id: couple.id,
      payer_id: profile.id,
      amount,
      category,
      label: label || null,
    });
    if (error) throw error;

    await loadCoupleData(profile.id, set, get);
  },

  settleUp: async () => {
    const { profile, partner, couple } = get();
    if (!profile || !partner || !couple) throw new Error('Aucun couple actif.');

    const balance = get().balance();
    if (!balance || balance.status === 'settled') return;

    const [fromUser, toUser] =
      balance.status === 'owed_to_me' ? [partner.id, profile.id] : [profile.id, partner.id];

    const { error } = await supabase.from('settlements').insert({
      couple_id: couple.id,
      from_user: fromUser,
      to_user: toUser,
      amount: balance.amount,
    });
    if (error) throw error;

    await loadCoupleData(profile.id, set, get);
  },

  refresh: async () => {
    const { profile } = get();
    if (!profile) return;
    await loadCoupleData(profile.id, set, get);
  },

  balance: () => {
    const { profile, partner, expenses, settlements } = get();
    if (!profile || !partner) return null;
    return calculateBalance(
      profile.id,
      partner.id,
      expenses.map((e) => ({ payerId: e.payerId, amount: e.amount })),
      settlements.map((s) => ({ fromUser: s.fromUser, toUser: s.toUser, amount: s.amount }))
    );
  },

  updateMyIncome: async (netIncome: number) => {
    const { profile } = get();
    if (!profile) throw new Error('Profil introuvable.');

    const { error } = await supabase.from('profiles').update({ net_income: netIncome }).eq('id', profile.id);
    if (error) throw error;

    await get().refresh();
  },

  loadEnvelopes: async () => {
    const { couple } = get();
    if (!couple) return;

    const { data, error } = await supabase
      .from('envelopes')
      .select('id, parent_id, label, emoji, priority, allocation')
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
        children: build(row.id),
      }));

    set({ envelopes: build(null) });
  },

  createEnvelope: async (input) => {
    const { couple } = get();
    if (!couple) throw new Error('Aucun couple actif.');

    const { error } = await supabase.from('envelopes').insert({
      couple_id: couple.id,
      parent_id: input.parentId,
      label: input.label,
      emoji: input.emoji,
      priority: input.priority,
      allocation: input.allocation,
    });
    if (error) throw error;

    await get().loadEnvelopes();
  },

  updateEnvelope: async (id, input) => {
    const { error } = await supabase
      .from('envelopes')
      .update({
        label: input.label,
        emoji: input.emoji,
        priority: input.priority,
        allocation: input.allocation,
      })
      .eq('id', id);
    if (error) throw error;

    await get().loadEnvelopes();
  },

  deleteEnvelope: async (id) => {
    const { error } = await supabase.from('envelopes').delete().eq('id', id);
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
}));

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
    teardownRealtime();
    set({ status: 'needsCouple', profile, partner: null, couple: null, expenses: [], settlements: [] });
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
    teardownRealtime();
    set({ status: 'waitingForPartner', profile, couple, partner: null, expenses: [], settlements: [] });
    return;
  }

  const [{ data: expenseRows }, { data: settlementRows }] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, payer_id, amount, category, label, created_at')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('id, from_user, to_user, amount, created_at')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false }),
  ]);

  const expenses: Expense[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    payerId: e.payer_id,
    amount: Number(e.amount),
    category: e.category,
    label: e.label,
    createdAt: e.created_at,
  }));
  const settlements: Settlement[] = (settlementRows ?? []).map((s) => ({
    id: s.id,
    fromUser: s.from_user,
    toUser: s.to_user,
    amount: Number(s.amount),
    createdAt: s.created_at,
  }));

  set({ status: 'ready', profile, couple, partner, expenses, settlements, error: null });

  teardownRealtime();
  realtimeChannel = supabase
    .channel(`couple-${couple.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'expenses', filter: `couple_id=eq.${couple.id}` },
      () => void loadCoupleData(userId, set, get)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'settlements', filter: `couple_id=eq.${couple.id}` },
      () => void loadCoupleData(userId, set, get)
    )
    .subscribe();
}
