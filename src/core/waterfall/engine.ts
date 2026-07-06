import type { Amount, Envelope, EnvelopeResult, Income, WaterfallInput, WaterfallResult } from './types';

export const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, poolRemaining: number) => Math.min(Math.max(value, 0), Math.max(poolRemaining, 0));

interface Pool {
  poolAtStart: number;
  poolRemaining: number;
}

interface Resolved {
  requested: number; // valeur calculée avant plafonnement, juste flooré à 0
  amount: number; // valeur réellement attribuée (plafonnée au pool restant)
}

function resolveAmount(amount: Amount, pool: Pool): Resolved {
  let raw: number;
  switch (amount.type) {
    case 'fixed':
      raw = amount.value;
      break;
    case 'percent_envelope':
      raw = (amount.pct / 100) * pool.poolAtStart;
      break;
    case 'percent_remaining':
      raw = (amount.pct / 100) * pool.poolRemaining;
      break;
    case 'prorata_income':
      // Résolu dans runSiblings (a besoin de `income` et d'une base figée entre sœurs) —
      // ne devrait jamais être appelé ici.
      throw new Error('prorata_income must be resolved by runSiblings');
  }
  return { requested: round2(Math.max(raw, 0)), amount: round2(clamp(raw, pool.poolRemaining)) };
}

function incomeShare(who: 'A' | 'B', income: Income): number {
  const total = income.a + income.b;
  if (total <= 0) return 0.5;
  return (who === 'A' ? income.a : income.b) / total;
}

function byPriority<T extends { priority: number }>(items: T[]): T[] {
  return [...items].sort((x, y) => x.priority - y.priority);
}

// Des enveloppes sœurs consécutives (par priorité) de type `prorata_income` se partagent le
// pool restant tel qu'il était AU DÉBUT du groupe, pas un reste qui diminue entre elles —
// sinon la 2e personne recevrait moins que sa vraie part proportionnelle (ex: A=60%, B=40% du
// même reste de 350€ → 210€/140€, pas 210€ puis 40% de 140€).
function runSiblings(envelopes: Envelope[], poolAtStart: number, poolRemaining: number, income: Income): EnvelopeResult[] {
  let remaining = poolRemaining;
  let prorataBase: number | null = null;

  return byPriority(envelopes).map((envelope) => {
    let resolved: Resolved;
    if (!envelope.enabled) {
      // Désactivée manuellement (ex: "matelas de sécurité" déjà plein) : 0€, ne consomme rien
      // du pool — donc profite automatiquement à la sœur suivante. Ne touche pas `prorataBase`
      // : une enveloppe désactivée est transparente pour le regroupement des prorata_income
      // consécutives (ex: [prorata A, désactivée, prorata B] partagent quand même le même reste).
      resolved = { requested: 0, amount: 0 };
    } else if (envelope.allocation.type === 'prorata_income') {
      if (prorataBase === null) prorataBase = remaining;
      const raw = prorataBase * incomeShare(envelope.allocation.who, income);
      resolved = { requested: round2(Math.max(raw, 0)), amount: round2(clamp(raw, remaining)) };
    } else {
      prorataBase = null;
      resolved = resolveAmount(envelope.allocation, { poolAtStart, poolRemaining: remaining });
    }
    remaining = round2(remaining - resolved.amount);

    const children = runSiblings(envelope.children, resolved.amount, resolved.amount, income);
    return {
      envelopeId: envelope.id,
      amount: resolved.amount,
      requestedAmount: resolved.requested,
      children,
    };
  });
}

export function runWaterfall(input: WaterfallInput): WaterfallResult {
  const totalIncome = input.income.a + input.income.b;
  const envelopeResults = runSiblings(input.envelopes, totalIncome, totalIncome, input.income);
  const allocated = envelopeResults.reduce((sum, e) => sum + e.amount, 0);

  return { totalIncome, envelopeResults, remainingIncome: round2(totalIncome - allocated) };
}
