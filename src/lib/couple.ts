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
