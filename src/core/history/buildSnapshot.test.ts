import { buildEnvelopeSnapshot } from './buildSnapshot';
import type { Envelope, EnvelopeResult } from '@/core/waterfall/types';

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
  {
    id: 'envies',
    label: 'Envies',
    emoji: '🎉',
    priority: 2,
    allocation: { type: 'percent_envelope', pct: 30 },
    enabled: true,
    fundedBy: null,
    children: [],
  },
];

const results: EnvelopeResult[] = [
  {
    envelopeId: 'besoins',
    amount: 2500,
    requestedAmount: 2500,
    children: [{ envelopeId: 'loyer', amount: 800, requestedAmount: 800, children: [] }],
  },
  // 'envies' volontairement absent — simule un résultat manquant pour un id donné.
];

describe('buildEnvelopeSnapshot', () => {
  it('zippe label/emoji vivants avec le montant calculé, récursivement', () => {
    const snapshot = buildEnvelopeSnapshot(envelopes, results);
    expect(snapshot[0]).toEqual({
      id: 'besoins',
      label: 'Besoins',
      emoji: '🏠',
      amount: 2500,
      children: [{ id: 'loyer', label: 'Loyer', emoji: '🔑', amount: 800, children: [] }],
    });
  });

  it("montant à 0 si aucun résultat ne correspond à l'id de l'enveloppe", () => {
    const snapshot = buildEnvelopeSnapshot(envelopes, results);
    expect(snapshot[1]).toEqual({ id: 'envies', label: 'Envies', emoji: '🎉', amount: 0, children: [] });
  });
});
