import type { Amount } from '@/core/waterfall/types';
import type { PaydayAmount } from './types';
import { round2 } from './engine';

/** Seul endroit du code qui importe à la fois waterfall/types et payday/types — les deux
 * moteurs restent isolés l'un de l'autre, ce module est le pont délibéré entre les deux.
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
