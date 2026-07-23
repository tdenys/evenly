import type { Amount, Envelope, WaterfallResult } from '@/core/waterfall/types';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import type { PaydayAction, PaydayAmount } from './types';
import { round2 } from './engine';

/** Seul endroit du code qui importe à la fois waterfall/types et payday/types — les deux
 * moteurs restent isolés l'un de l'autre, ce module est le pont délibéré entre les deux.
 * Héberge 2 fonctions-pont liées : la résolution d'une allocation d'enveloppe unique
 * (resolveEnvelopeAmount) et la résolution d'une liste d'actions pour un propriétaire
 * (resolveOwnerActions), qui s'appuie sur la première.
 *
 * Traduit l'allocation d'une enveloppe en montant Payday pour la part déjà calculée de cette
 * personne. Une enveloppe "boîte à reste" (100% du reste) devient `remainder` — tout ce qui
 * reste du salaire RÉEL de ce payday y va, même si ça diffère du montant théorique calculé par
 * Waterfall (revenu net déclaré vs salaire réel du mois). Toute autre enveloppe devient un
 * montant fixe figé sur la part déjà calculée. */
export function resolveEnvelopeAmount(allocation: Amount, share: number): PaydayAmount {
  if (allocation.type === 'percent_remaining' && allocation.pct === 100) {
    return { type: 'remainder' };
  }
  return { type: 'fixed', value: round2(share) };
}

export interface ResolvedOwnerAction<T extends PaydayAction> {
  action: T;
  envelope: Envelope | null; // enveloppe source si amount.type === 'envelope' (et encore présente)
  resolvedAmount: PaydayAmount; // toujours concret, jamais 'envelope' — prêt pour runPayday
}

/** Résout chaque action "référence vivante" (amount.type === 'envelope') d'une liste en un
 * montant concret, à partir du Waterfall déjà calculé — générique sur T pour que l'appelant
 * puisse passer un type enrichi (ex: PaydayActionRow côté store, avec ownerId/accountId) et le
 * récupérer intact dans `action`, sans que ce module pur importe jamais ce type store. */
export function resolveOwnerActions<T extends PaydayAction>(
  actions: T[],
  envelopes: Envelope[],
  waterfallResult: WaterfallResult,
  share: number
): ResolvedOwnerAction<T>[] {
  return actions.map((action) => {
    if (action.amount.type !== 'envelope') {
      return { action, envelope: null, resolvedAmount: action.amount };
    }
    const envelope = findEnvelope(envelopes, action.amount.envelopeId);
    if (!envelope) {
      return { action, envelope: null, resolvedAmount: { type: 'fixed', value: 0 } };
    }
    const envelopeAmount = findEnvelopeResult(waterfallResult.envelopeResults, envelope.id)?.amount ?? 0;
    const envShare = envelope.fundedBy === 'both' ? share : 1;
    return { action, envelope, resolvedAmount: resolveEnvelopeAmount(envelope.allocation, envelopeAmount * envShare) };
  });
}
