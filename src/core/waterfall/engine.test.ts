import { runWaterfall } from './engine';
import type { Envelope } from './types';

function investissementEnvelope(): Envelope {
  return {
    id: 'investissement',
    label: 'Investissement',
    emoji: '📈',
    priority: 3,
    allocation: { type: 'percent_envelope', pct: 20 },
    rules: [
      {
        id: 'matelas',
        label: 'Matelas sécurité',
        priority: 1,
        amount: { type: 'fixed', value: 300 },
        recipient: { type: 'shared_pot', potId: 'matelas' },
        condition: { type: 'skip_if_goal_reached', goalId: 'matelas-goal' },
      },
      {
        id: 'apport',
        label: 'Apport immobilier',
        priority: 2,
        amount: { type: 'percent_remaining', pct: 50 },
        recipient: { type: 'shared_pot', potId: 'apport' },
      },
      {
        id: 'pea',
        label: 'PEA',
        priority: 3,
        amount: { type: 'prorata_income' },
        recipient: { type: 'prorata' },
      },
    ],
  };
}

function coupleEnvelopes(): Envelope[] {
  return [
    {
      id: 'besoins',
      label: 'Besoins',
      emoji: '🏠',
      priority: 1,
      allocation: { type: 'percent_envelope', pct: 50 },
      rules: [],
    },
    {
      id: 'envies',
      label: 'Envies',
      emoji: '🎉',
      priority: 2,
      allocation: { type: 'percent_envelope', pct: 30 },
      rules: [],
    },
    investissementEnvelope(),
  ];
}

describe('runWaterfall — exemples chiffrés de CLAUDE.md', () => {
  it('répartit 5000€ en 2500 / 1500 / 1000 entre les enveloppes', () => {
    const result = runWaterfall({
      income: { a: 2500, b: 2500 },
      envelopes: coupleEnvelopes(),
    });

    expect(result.totalIncome).toBe(5000);
    expect(result.remainingIncome).toBe(0);
    expect(result.envelopeResults.map((e) => [e.envelopeId, e.amount])).toEqual([
      ['besoins', 2500],
      ['envies', 1500],
      ['investissement', 1000],
    ]);
  });

  it('cascade 300€ fixe / 50% du reste / prorata revenus dans Investissement', () => {
    const result = runWaterfall({
      income: { a: 2500, b: 2500 },
      envelopes: coupleEnvelopes(),
      goals: { 'matelas-goal': { current: 5000, target: 10000 } }, // pas encore atteint
    });

    const investissement = result.envelopeResults.find((e) => e.envelopeId === 'investissement')!;
    expect(investissement.ruleAllocations).toEqual([
      expect.objectContaining({ ruleId: 'matelas', amount: 300, skipped: false }),
      expect.objectContaining({ ruleId: 'apport', amount: 350, skipped: false }),
      expect.objectContaining({ ruleId: 'pea', amount: 350, skipped: false, split: { a: 175, b: 175 } }),
    ]);
  });
});

describe('runWaterfall — conditions', () => {
  it('skip_if_goal_reached: objectif atteint => règle skip, montant laissé au suivant', () => {
    const result = runWaterfall({
      income: { a: 2500, b: 2500 },
      envelopes: coupleEnvelopes(),
      goals: { 'matelas-goal': { current: 10000, target: 10000 } }, // atteint
    });

    const investissement = result.envelopeResults.find((e) => e.envelopeId === 'investissement')!;
    const matelas = investissement.ruleAllocations.find((r) => r.ruleId === 'matelas')!;
    const apport = investissement.ruleAllocations.find((r) => r.ruleId === 'apport')!;
    expect(matelas).toMatchObject({ amount: 0, skipped: true });
    // 50% du reste (1000€, puisque matelas n'a rien pris) = 500€
    expect(apport).toMatchObject({ amount: 500, skipped: false });
  });

  it('skip_if_pot_above: pot au-dessus du seuil => règle skip', () => {
    const envelope: Envelope = {
      id: 'env',
      label: 'Env',
      emoji: '💰',
      priority: 1,
      allocation: { type: 'fixed', value: 1000 },
      rules: [
        {
          id: 'r1',
          label: 'Règle',
          priority: 1,
          amount: { type: 'fixed', value: 200 },
          recipient: { type: 'shared_pot', potId: 'pot1' },
          condition: { type: 'skip_if_pot_above', potId: 'pot1', threshold: 100 },
        },
      ],
    };

    const result = runWaterfall({
      income: { a: 1000, b: 0 },
      envelopes: [envelope],
      pots: { pot1: 150 },
    });

    expect(result.envelopeResults[0].ruleAllocations[0]).toMatchObject({ amount: 0, skipped: true });
  });

  it('active_from_date: date future => règle skip', () => {
    const envelope: Envelope = {
      id: 'env',
      label: 'Env',
      emoji: '💰',
      priority: 1,
      allocation: { type: 'fixed', value: 1000 },
      rules: [
        {
          id: 'r1',
          label: 'Règle',
          priority: 1,
          amount: { type: 'fixed', value: 200 },
          recipient: { type: 'shared_pot', potId: 'pot1' },
          condition: { type: 'active_from_date', date: '2099-01-01' },
        },
      ],
    };

    const result = runWaterfall({
      income: { a: 1000, b: 0 },
      envelopes: [envelope],
      today: '2026-07-05',
    });

    expect(result.envelopeResults[0].ruleAllocations[0]).toMatchObject({ amount: 0, skipped: true });
  });
});

describe('runWaterfall — cas limites', () => {
  it('plafonne un montant fixed qui dépasse ce qu’il reste dans le pool', () => {
    const envelope: Envelope = {
      id: 'env',
      label: 'Env',
      emoji: '💰',
      priority: 1,
      allocation: { type: 'fixed', value: 100 },
      rules: [
        {
          id: 'trop-gros',
          label: 'Trop gros',
          priority: 1,
          amount: { type: 'fixed', value: 9999 },
          recipient: { type: 'shared_pot', potId: 'pot1' },
        },
      ],
    };

    const result = runWaterfall({ income: { a: 100, b: 0 }, envelopes: [envelope] });

    expect(result.envelopeResults[0].ruleAllocations[0].amount).toBe(100);
  });

  it('trie enveloppes et règles par priority même si le tableau est dans le désordre', () => {
    const envelopes: Envelope[] = [
      {
        id: 'second',
        label: 'Second',
        emoji: '2',
        priority: 2,
        allocation: { type: 'percent_envelope', pct: 40 },
        rules: [],
      },
      {
        id: 'first',
        label: 'First',
        emoji: '1',
        priority: 1,
        allocation: { type: 'percent_envelope', pct: 60 },
        rules: [],
      },
    ];

    const result = runWaterfall({ income: { a: 1000, b: 0 }, envelopes });

    expect(result.envelopeResults.map((e) => e.envelopeId)).toEqual(['first', 'second']);
  });
});
