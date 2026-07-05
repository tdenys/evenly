import type {
  Amount,
  Condition,
  Envelope,
  EnvelopeResult,
  GoalsState,
  Income,
  PotsState,
  Rule,
  RuleAllocation,
  WaterfallInput,
  WaterfallResult,
} from './types';

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
      return round2(clamp(pool.poolRemaining, pool.poolRemaining));
  }
}

interface ConditionContext {
  goals?: GoalsState;
  pots?: PotsState;
  today: string;
}

function isSkipped(condition: Condition | undefined, ctx: ConditionContext): boolean {
  if (!condition) return false;
  switch (condition.type) {
    case 'skip_if_goal_reached': {
      const goal = ctx.goals?.[condition.goalId];
      return goal !== undefined && goal.current >= goal.target;
    }
    case 'skip_if_pot_above': {
      const pot = ctx.pots?.[condition.potId];
      return pot !== undefined && pot > condition.threshold;
    }
    case 'active_from_date':
      return ctx.today < condition.date;
  }
}

function splitProrata(amount: number, income: Income): { a: number; b: number } {
  const total = income.a + income.b;
  if (total <= 0) {
    const half = round2(amount / 2);
    return { a: half, b: round2(amount - half) };
  }
  const a = round2(amount * (income.a / total));
  return { a, b: round2(amount - a) };
}

function byPriority<T extends { priority: number }>(items: T[]): T[] {
  return [...items].sort((x, y) => x.priority - y.priority);
}

function runRule(rule: Rule, envelopeId: string, pool: Pool, income: Income, ctx: ConditionContext): RuleAllocation {
  const skipped = isSkipped(rule.condition, ctx);
  const amount = skipped ? 0 : resolveAmount(rule.amount, pool);
  const split = !skipped && rule.recipient.type === 'prorata' ? splitProrata(amount, income) : undefined;

  return {
    envelopeId,
    ruleId: rule.id,
    amount,
    skipped,
    recipient: rule.recipient,
    ...(split ? { split } : {}),
  };
}

function runEnvelope(envelope: Envelope, pool: Pool, income: Income, ctx: ConditionContext): EnvelopeResult {
  const amount = resolveAmount(envelope.allocation, pool);

  let remaining = amount;
  const ruleAllocations = byPriority(envelope.rules).map((rule) => {
    const allocation = runRule(rule, envelope.id, { poolAtStart: amount, poolRemaining: remaining }, income, ctx);
    remaining = round2(remaining - allocation.amount);
    return allocation;
  });

  return { envelopeId: envelope.id, amount, ruleAllocations };
}

export function runWaterfall(input: WaterfallInput): WaterfallResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const ctx: ConditionContext = { goals: input.goals, pots: input.pots, today };
  const totalIncome = input.income.a + input.income.b;

  let remainingIncome = totalIncome;
  const envelopeResults = byPriority(input.envelopes).map((envelope) => {
    const result = runEnvelope(
      envelope,
      { poolAtStart: totalIncome, poolRemaining: remainingIncome },
      input.income,
      ctx
    );
    remainingIncome = round2(remainingIncome - result.amount);
    return result;
  });

  return { totalIncome, envelopeResults, remainingIncome };
}
