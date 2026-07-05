import { runWaterfall } from './engine';
import type { Envelope } from './types';

function coupleEnvelopes(): Envelope[] {
  return [
    {
      id: 'besoins',
      label: 'Besoins',
      emoji: '🏠',
      priority: 1,
      allocation: { type: 'percent_envelope', pct: 50 },
      children: [],
    },
    {
      id: 'envies',
      label: 'Envies',
      emoji: '🎉',
      priority: 2,
      allocation: { type: 'percent_envelope', pct: 30 },
      children: [],
    },
    {
      id: 'investissement',
      label: 'Investissement',
      emoji: '📈',
      priority: 3,
      allocation: { type: 'percent_envelope', pct: 20 },
      children: [],
    },
  ];
}

describe('runWaterfall — enveloppes de premier niveau', () => {
  it('répartit 5000€ en 2500 / 1500 / 1000 entre les enveloppes', () => {
    const result = runWaterfall({ income: { a: 2500, b: 2500 }, envelopes: coupleEnvelopes() });

    expect(result.totalIncome).toBe(5000);
    expect(result.remainingIncome).toBe(0);
    expect(result.envelopeResults.map((e) => [e.envelopeId, e.amount])).toEqual([
      ['besoins', 2500],
      ['envies', 1500],
      ['investissement', 1000],
    ]);
  });
});

describe('runWaterfall — sous-enveloppes récursives', () => {
  it('Voyage 300€ → Japon 150€ (50%) + Camping 150€ (50%)', () => {
    const voyage: Envelope = {
      id: 'voyage',
      label: 'Voyage',
      emoji: '✈️',
      priority: 1,
      allocation: { type: 'fixed', value: 300 },
      children: [
        {
          id: 'japon',
          label: 'Voyage Japon',
          emoji: '🗾',
          priority: 1,
          allocation: { type: 'percent_envelope', pct: 50 },
          children: [],
        },
        {
          id: 'camping',
          label: 'Camping Normandie',
          emoji: '⛺',
          priority: 2,
          allocation: { type: 'percent_envelope', pct: 50 },
          children: [],
        },
      ],
    };

    const result = runWaterfall({ income: { a: 300, b: 0 }, envelopes: [voyage] });

    const voyageResult = result.envelopeResults[0];
    expect(voyageResult.amount).toBe(300);
    expect(voyageResult.children.map((c) => [c.envelopeId, c.amount])).toEqual([
      ['japon', 150],
      ['camping', 150],
    ]);
  });

  it('cascade fixed / percent_remaining / prorata_income (A+B) entre sous-enveloppes', () => {
    const investissement: Envelope = {
      id: 'investissement',
      label: 'Investissement',
      emoji: '📈',
      priority: 1,
      allocation: { type: 'fixed', value: 1000 },
      children: [
        {
          id: 'matelas',
          label: 'Matelas sécurité',
          emoji: '🛟',
          priority: 1,
          allocation: { type: 'fixed', value: 300 },
          children: [],
        },
        {
          id: 'apport',
          label: 'Apport immobilier',
          emoji: '🏡',
          priority: 2,
          allocation: { type: 'percent_remaining', pct: 50 },
          children: [],
        },
        {
          id: 'pea-a',
          label: 'PEA de A',
          emoji: '📊',
          priority: 3,
          allocation: { type: 'prorata_income', who: 'A' },
          children: [],
        },
        {
          id: 'pea-b',
          label: 'PEA de B',
          emoji: '📊',
          priority: 4,
          allocation: { type: 'prorata_income', who: 'B' },
          children: [],
        },
      ],
    };

    // revenus 60% A / 40% B → les 350€ restants doivent se répartir 210€ / 140€
    const result = runWaterfall({ income: { a: 600, b: 400 }, envelopes: [investissement] });

    expect(result.envelopeResults[0].children.map((c) => [c.envelopeId, c.amount])).toEqual([
      ['matelas', 300],
      ['apport', 350],
      ['pea-a', 210],
      ['pea-b', 140],
    ]);
  });

  it('un seul enfant prorata_income prend sa part, pas 100% du reste', () => {
    const envelope: Envelope = {
      id: 'env',
      label: 'Env',
      emoji: '💰',
      priority: 1,
      allocation: { type: 'fixed', value: 1000 },
      children: [
        {
          id: 'pea-a',
          label: 'PEA de A',
          emoji: '📊',
          priority: 1,
          allocation: { type: 'prorata_income', who: 'A' },
          children: [],
        },
      ],
    };

    const result = runWaterfall({ income: { a: 600, b: 400 }, envelopes: [envelope] });

    expect(result.envelopeResults[0].children[0].amount).toBe(600);
  });

  it('la récursion va au-delà d\'un niveau si besoin', () => {
    const root: Envelope = {
      id: 'root',
      label: 'Root',
      emoji: '💰',
      priority: 1,
      allocation: { type: 'fixed', value: 100 },
      children: [
        {
          id: 'mid',
          label: 'Mid',
          emoji: '📦',
          priority: 1,
          allocation: { type: 'percent_envelope', pct: 100 },
          children: [
            {
              id: 'leaf',
              label: 'Leaf',
              emoji: '🍃',
              priority: 1,
              allocation: { type: 'percent_envelope', pct: 50 },
              children: [],
            },
          ],
        },
      ],
    };

    const result = runWaterfall({ income: { a: 100, b: 0 }, envelopes: [root] });
    expect(result.envelopeResults[0].amount).toBe(100);
    expect(result.envelopeResults[0].children[0].amount).toBe(100);
    expect(result.envelopeResults[0].children[0].children[0].amount).toBe(50);
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
      children: [
        {
          id: 'trop-gros',
          label: 'Trop gros',
          emoji: '💸',
          priority: 1,
          allocation: { type: 'fixed', value: 9999 },
          children: [],
        },
      ],
    };

    const result = runWaterfall({ income: { a: 100, b: 0 }, envelopes: [envelope] });

    expect(result.envelopeResults[0].children[0].amount).toBe(100);
  });

  it('trie enveloppes et sous-enveloppes par priority même si le tableau est dans le désordre', () => {
    const envelopes: Envelope[] = [
      {
        id: 'second',
        label: 'Second',
        emoji: '2',
        priority: 2,
        allocation: { type: 'percent_envelope', pct: 40 },
        children: [],
      },
      {
        id: 'first',
        label: 'First',
        emoji: '1',
        priority: 1,
        allocation: { type: 'percent_envelope', pct: 60 },
        children: [
          {
            id: 'first-b',
            label: 'First B',
            emoji: 'b',
            priority: 2,
            allocation: { type: 'percent_envelope', pct: 50 },
            children: [],
          },
          {
            id: 'first-a',
            label: 'First A',
            emoji: 'a',
            priority: 1,
            allocation: { type: 'percent_envelope', pct: 50 },
            children: [],
          },
        ],
      },
    ];

    const result = runWaterfall({ income: { a: 1000, b: 0 }, envelopes });

    expect(result.envelopeResults.map((e) => e.envelopeId)).toEqual(['first', 'second']);
    expect(result.envelopeResults[0].children.map((c) => c.envelopeId)).toEqual(['first-a', 'first-b']);
  });
});
