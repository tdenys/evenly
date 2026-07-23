import { applyAllocationOverrides, summarizeChildren, type ChildrenSummary } from './tree';
import type { Envelope, EnvelopeResult } from './types';

function child(amount: number, requestedAmount: number): EnvelopeResult {
  return { envelopeId: `child-${amount}-${requestedAmount}`, amount, requestedAmount, children: [] };
}

describe('summarizeChildren', () => {
  it('reste positif quand les enfants ne consomment pas tout le pool', () => {
    const summary: ChildrenSummary = summarizeChildren(1000, [child(300, 300), child(200, 200)]);
    expect(summary).toEqual({ remaining: 500, overflow: 0 });
  });

  it('ni reste ni dépassement quand tout est alloué pile à 100%', () => {
    const summary = summarizeChildren(1000, [child(600, 600), child(400, 400)]);
    expect(summary).toEqual({ remaining: 0, overflow: 0 });
  });

  it('signale un dépassement quand les demandes dépassent le pool, même si amount est plafonné', () => {
    const summary = summarizeChildren(1000, [child(600, 600), child(400, 600), child(0, 600)]);
    expect(summary).toEqual({ remaining: 0, overflow: 800 });
  });
});

describe('applyAllocationOverrides', () => {
  const envelopes: Envelope[] = [
    {
      id: 'besoins',
      label: 'Besoins',
      emoji: '🏠',
      priority: 1,
      allocation: { type: 'percent_envelope', pct: 50 },
      enabled: true,
      fundedBy: null,
      children: [
        {
          id: 'loyer',
          label: 'Loyer',
          emoji: '🔑',
          priority: 1,
          allocation: { type: 'fixed', value: 800 },
          enabled: true,
          fundedBy: null,
          children: [],
        },
      ],
    },
  ];

  it('remplace uniquement les allocations présentes dans overrides, récursivement', () => {
    const result = applyAllocationOverrides(envelopes, { loyer: { type: 'fixed', value: 900 } });
    expect(result[0].allocation).toEqual({ type: 'percent_envelope', pct: 50 }); // inchangée
    expect(result[0].children[0].allocation).toEqual({ type: 'fixed', value: 900 }); // remplacée
  });

  it("ne modifie pas l'arbre d'origine (nouvel arbre à chaque appel)", () => {
    applyAllocationOverrides(envelopes, { besoins: { type: 'fixed', value: 1 } });
    expect(envelopes[0].allocation).toEqual({ type: 'percent_envelope', pct: 50 });
  });

  it("renvoie l'arbre inchangé (structurellement) si overrides est vide", () => {
    const result = applyAllocationOverrides(envelopes, {});
    expect(result).toEqual(envelopes);
  });
});
