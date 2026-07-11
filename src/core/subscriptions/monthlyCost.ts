import type { SubscriptionFrequency } from './types';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Coût mensuel équivalent, peu importe la fréquence réelle — hebdomadaire converti via
 * 52/12 (moyenne exacte de semaines par mois), pas *4 (sous-estimerait le coût réel). */
export function monthlyCost(cost: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case 'weekly':
      return round2((cost * 52) / 12);
    case 'monthly':
      return cost;
    case 'quarterly':
      return round2(cost / 3);
    case 'yearly':
      return round2(cost / 12);
  }
}
