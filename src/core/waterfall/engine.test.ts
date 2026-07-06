import { runWaterfall } from './engine';
import type { Envelope } from './types';

// Petit constructeur avec des valeurs par défaut sensées, pour ne pas répéter
// emoji/priority/enabled/children sur chaque enveloppe de test.
function env(overrides: Partial<Envelope> & Pick<Envelope, 'id' | 'allocation'>): Envelope {
  return {
    label: overrides.id,
    emoji: '📦',
    priority: 1,
    enabled: true,
    children: [],
    ...overrides,
  };
}

function coupleEnvelopes(): Envelope[] {
  return [
    env({ id: 'besoins', label: 'Besoins', emoji: '🏠', priority: 1, allocation: { type: 'percent_envelope', pct: 50 } }),
    env({ id: 'envies', label: 'Envies', emoji: '🎉', priority: 2, allocation: { type: 'percent_envelope', pct: 30 } }),
    env({
      id: 'investissement',
      label: 'Investissement',
      emoji: '📈',
      priority: 3,
      allocation: { type: 'percent_envelope', pct: 20 },
    }),
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
    const voyage = env({
      id: 'voyage',
      label: 'Voyage',
      emoji: '✈️',
      priority: 1,
      allocation: { type: 'fixed', value: 300 },
      children: [
        env({ id: 'japon', label: 'Voyage Japon', emoji: '🗾', priority: 1, allocation: { type: 'percent_envelope', pct: 50 } }),
        env({
          id: 'camping',
          label: 'Camping Normandie',
          emoji: '⛺',
          priority: 2,
          allocation: { type: 'percent_envelope', pct: 50 },
        }),
      ],
    });

    const result = runWaterfall({ income: { a: 300, b: 0 }, envelopes: [voyage] });

    const voyageResult = result.envelopeResults[0];
    expect(voyageResult.amount).toBe(300);
    expect(voyageResult.children.map((c) => [c.envelopeId, c.amount])).toEqual([
      ['japon', 150],
      ['camping', 150],
    ]);
    // Pas de plafonnement ici : demandé == attribué pour les deux.
    expect(voyageResult.children.map((c) => c.requestedAmount)).toEqual([150, 150]);
  });

  it('cascade fixed / percent_remaining / prorata_income (A+B) entre sous-enveloppes', () => {
    const investissement = env({
      id: 'investissement',
      label: 'Investissement',
      emoji: '📈',
      priority: 1,
      allocation: { type: 'fixed', value: 1000 },
      children: [
        env({ id: 'matelas', label: 'Matelas sécurité', emoji: '🛟', priority: 1, allocation: { type: 'fixed', value: 300 } }),
        env({
          id: 'apport',
          label: 'Apport immobilier',
          emoji: '🏡',
          priority: 2,
          allocation: { type: 'percent_remaining', pct: 50 },
        }),
        env({ id: 'pea-a', label: 'PEA de A', emoji: '📊', priority: 3, allocation: { type: 'prorata_income', who: 'A' } }),
        env({ id: 'pea-b', label: 'PEA de B', emoji: '📊', priority: 4, allocation: { type: 'prorata_income', who: 'B' } }),
      ],
    });

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
    const envelope = env({
      id: 'env',
      allocation: { type: 'fixed', value: 1000 },
      children: [env({ id: 'pea-a', label: 'PEA de A', emoji: '📊', allocation: { type: 'prorata_income', who: 'A' } })],
    });

    const result = runWaterfall({ income: { a: 600, b: 400 }, envelopes: [envelope] });

    expect(result.envelopeResults[0].children[0].amount).toBe(600);
  });

  it("la récursion va au-delà d'un niveau si besoin", () => {
    const root = env({
      id: 'root',
      label: 'Root',
      allocation: { type: 'fixed', value: 100 },
      children: [
        env({
          id: 'mid',
          label: 'Mid',
          allocation: { type: 'percent_envelope', pct: 100 },
          children: [env({ id: 'leaf', label: 'Leaf', emoji: '🍃', allocation: { type: 'percent_envelope', pct: 50 } })],
        }),
      ],
    });

    const result = runWaterfall({ income: { a: 100, b: 0 }, envelopes: [root] });
    expect(result.envelopeResults[0].amount).toBe(100);
    expect(result.envelopeResults[0].children[0].amount).toBe(100);
    expect(result.envelopeResults[0].children[0].children[0].amount).toBe(50);
  });
});

describe('runWaterfall — enveloppe désactivée', () => {
  it('une enveloppe désactivée vaut 0€ et ne consomme rien — la sœur suivante récupère tout', () => {
    const investissement = env({
      id: 'investissement',
      label: 'Investissement',
      allocation: { type: 'fixed', value: 1000 },
      children: [
        env({
          id: 'matelas',
          label: 'Matelas sécurité (plein, désactivé)',
          priority: 1,
          allocation: { type: 'fixed', value: 300 },
          enabled: false,
        }),
        env({ id: 'reste', label: 'Reste', priority: 2, allocation: { type: 'percent_remaining', pct: 100 } }),
      ],
    });

    const result = runWaterfall({ income: { a: 1000, b: 0 }, envelopes: [investissement] });

    expect(result.envelopeResults[0].children.map((c) => [c.envelopeId, c.amount])).toEqual([
      ['matelas', 0],
      ['reste', 1000], // pas 700 : le matelas désactivé ne consomme rien du tout
    ]);
    // Une enveloppe désactivée ne doit pas non plus compter comme "demandée" (pas de faux
    // dépassement signalé pour un montant qu'on a explicitement choisi de ne pas verser).
    expect(result.envelopeResults[0].children[0].requestedAmount).toBe(0);
  });

  it('une enveloppe désactivée entre deux prorata_income ne casse pas leur groupe', () => {
    const envelope = env({
      id: 'env',
      allocation: { type: 'fixed', value: 1000 },
      children: [
        env({ id: 'pea-a', label: 'PEA de A', priority: 1, allocation: { type: 'prorata_income', who: 'A' } }),
        env({ id: 'inactive', label: 'Désactivée', priority: 2, allocation: { type: 'fixed', value: 9999 }, enabled: false }),
        env({ id: 'pea-b', label: 'PEA de B', priority: 3, allocation: { type: 'prorata_income', who: 'B' } }),
      ],
    });

    const result = runWaterfall({ income: { a: 600, b: 400 }, envelopes: [envelope] });

    expect(result.envelopeResults[0].children.map((c) => [c.envelopeId, c.amount])).toEqual([
      ['pea-a', 600],
      ['inactive', 0],
      ['pea-b', 400],
    ]);
  });
});

describe('runWaterfall — cas limites', () => {
  it('plafonne un montant fixed qui dépasse ce qu’il reste dans le pool', () => {
    const envelope = env({
      id: 'env',
      allocation: { type: 'fixed', value: 100 },
      children: [env({ id: 'trop-gros', label: 'Trop gros', emoji: '💸', allocation: { type: 'fixed', value: 9999 } })],
    });

    const result = runWaterfall({ income: { a: 100, b: 0 }, envelopes: [envelope] });

    const child = result.envelopeResults[0].children[0];
    expect(child.amount).toBe(100);
    expect(child.requestedAmount).toBe(9999); // le demandé n'est pas plafonné, lui
  });

  it('signale un dépassement quand la somme des demandes dépasse le pool (requestedAmount)', () => {
    const makeChild = (id: string, priority: number) =>
      env({ id, priority, allocation: { type: 'percent_envelope', pct: 60 } });
    const envelope = env({
      id: 'env',
      allocation: { type: 'fixed', value: 1000 },
      children: [makeChild('c1', 1), makeChild('c2', 2), makeChild('c3', 3)],
    });

    const result = runWaterfall({ income: { a: 1000, b: 0 }, envelopes: [envelope] });

    // Chacun demande 60% de 1000 = 600€, mais le pool ne peut en fournir que 1000€ au total :
    // le 1er reçoit son dû, le 2e est réduit au reste, le 3e n'a plus rien — sans que la
    // demande initiale de chacun (600€) n'ait changé.
    expect(result.envelopeResults[0].children.map((c) => c.amount)).toEqual([600, 400, 0]);
    expect(result.envelopeResults[0].children.map((c) => c.requestedAmount)).toEqual([600, 600, 600]);
  });

  it('trie enveloppes et sous-enveloppes par priority même si le tableau est dans le désordre', () => {
    const envelopes: Envelope[] = [
      env({ id: 'second', label: 'Second', emoji: '2', priority: 2, allocation: { type: 'percent_envelope', pct: 40 } }),
      env({
        id: 'first',
        label: 'First',
        emoji: '1',
        priority: 1,
        allocation: { type: 'percent_envelope', pct: 60 },
        children: [
          env({ id: 'first-b', label: 'First B', emoji: 'b', priority: 2, allocation: { type: 'percent_envelope', pct: 50 } }),
          env({ id: 'first-a', label: 'First A', emoji: 'a', priority: 1, allocation: { type: 'percent_envelope', pct: 50 } }),
        ],
      }),
    ];

    const result = runWaterfall({ income: { a: 1000, b: 0 }, envelopes });

    expect(result.envelopeResults.map((e) => e.envelopeId)).toEqual(['first', 'second']);
    expect(result.envelopeResults[0].children.map((c) => c.envelopeId)).toEqual(['first-a', 'first-b']);
  });
});
