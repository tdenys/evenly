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

/** Part du "reste" attribuable à `ownerId`, proportionnelle aux revenus (même calcul que
 * prorata_income dans le moteur waterfall) — 0.5 par défaut si les données manquent. */
export function incomeShare(
  ownerId: string | null,
  profile: PersonLike | null,
  partner: PersonLike | null,
  income: Income
): number {
  if (!profile || !partner || !ownerId) return 0.5;
  const { personA } = orderCouple(profile, partner);
  const total = income.a + income.b;
  if (total <= 0) return 0.5;
  return ownerId === personA.id ? income.a / total : income.b / total;
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

