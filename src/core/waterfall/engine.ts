import type { Amount, Envelope, EnvelopeResult, Income, WaterfallInput, WaterfallResult } from './types';

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, poolRemaining: number) => Math.min(Math.max(value, 0), Math.max(poolRemaining, 0));

interface Pool {
  poolAtStart: number;
  poolRemaining: number;
}

function resolveAmount(amount: Amount, pool: Pool): number {
  switch (amount.type) {
    case 'fixed':
      return round2(clamp(amount.value, pool.poolRemaining));
    case 'percent_envelope':
      return round2(clamp((amount.pct / 100) * pool.poolAtStart, pool.poolRemaining));
    case 'percent_remaining':
      return round2(clamp((amount.pct / 100) * pool.poolRemaining, pool.poolRemaining));
    case 'prorata_income':
      // Résolu dans runSiblings (a besoin de `income` et d'une base figée entre sœurs) —
      // ne devrait jamais être appelé ici.
      throw new Error('prorata_income must be resolved by runSiblings');
  }
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
    let amount: number;
    if (envelope.allocation.type === 'prorata_income') {
      if (prorataBase === null) prorataBase = remaining;
      amount = round2(clamp(prorataBase * incomeShare(envelope.allocation.who, income), remaining));
    } else {
      prorataBase = null;
      amount = resolveAmount(envelope.allocation, { poolAtStart, poolRemaining: remaining });
    }
    remaining = round2(remaining - amount);

    const children = runSiblings(envelope.children, amount, amount, income);
    return { envelopeId: envelope.id, amount, children };
  });
}

export function runWaterfall(input: WaterfallInput): WaterfallResult {
  const totalIncome = input.income.a + input.income.b;
  const envelopeResults = runSiblings(input.envelopes, totalIncome, totalIncome, input.income);
  const allocated = envelopeResults.reduce((sum, e) => sum + e.amount, 0);

  return { totalIncome, envelopeResults, remainingIncome: round2(totalIncome - allocated) };
}
