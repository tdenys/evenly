import type { Income } from '@/core/waterfall/types';

interface PersonLike {
  id: string;
  displayName: string;
  netIncome: number;
}

/**
 * Assigns "A"/"B" by profile id rather than "moi"/"partenaire" — stable regardless of which
 * partner's device is looking, so `Amount.prorata_income.who` means the same person for both.
 */
export function orderCouple<T extends PersonLike>(profile: T, partner: T): { personA: T; personB: T } {
  return profile.id < partner.id ? { personA: profile, personB: partner } : { personA: partner, personB: profile };
}

export function coupleIncome(profile: PersonLike, partner: PersonLike): Income {
  const { personA, personB } = orderCouple(profile, partner);
  return { a: personA.netIncome, b: personB.netIncome };
}

/** Prénoms réels affichés pour le choix A/B (ex: dans AmountEditor), sans exposer "A"/"B" à l'UI. */
export function coupleLabels(
  profile: PersonLike | null,
  partner: PersonLike | null
): { A: string; B: string } {
  if (!profile || !partner) return { A: 'Personne A', B: 'Personne B' };
  const { personA, personB } = orderCouple(profile, partner);
  return { A: personA.displayName, B: personB.displayName };
}
