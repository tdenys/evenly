import { resolveEnvelopeAmount, resolveOwnerActions } from './fromEnvelope';
import type { Amount, Envelope, WaterfallResult } from '@/core/waterfall/types';
import type { PaydayAction } from './types';

describe('resolveEnvelopeAmount', () => {
  it('une enveloppe "boîte à reste" (100% du reste) devient remainder, peu importe la part', () => {
    const allocation: Amount = { type: 'percent_remaining', pct: 100 };
    expect(resolveEnvelopeAmount(allocation, 400)).toEqual({ type: 'remainder' });
    expect(resolveEnvelopeAmount(allocation, 0)).toEqual({ type: 'remainder' });
  });

  it('un % du reste inférieur à 100% devient un montant fixe (pas remainder)', () => {
    const allocation: Amount = { type: 'percent_remaining', pct: 50 };
    expect(resolveEnvelopeAmount(allocation, 400)).toEqual({ type: 'fixed', value: 400 });
  });

  it('fixed devient un montant fixe sur la part calculée', () => {
    const allocation: Amount = { type: 'fixed', value: 1000 };
    expect(resolveEnvelopeAmount(allocation, 600)).toEqual({ type: 'fixed', value: 600 });
  });

  it('percent_envelope devient un montant fixe sur la part calculée', () => {
    const allocation: Amount = { type: 'percent_envelope', pct: 20 };
    expect(resolveEnvelopeAmount(allocation, 210)).toEqual({ type: 'fixed', value: 210 });
  });

  it('prorata_income devient un montant fixe sur la part calculée', () => {
    const allocation: Amount = { type: 'prorata_income', who: 'A' };
    expect(resolveEnvelopeAmount(allocation, 210)).toEqual({ type: 'fixed', value: 210 });
  });

  it('arrondit la part à 2 décimales', () => {
    const allocation: Amount = { type: 'fixed', value: 1000 };
    expect(resolveEnvelopeAmount(allocation, 333.333)).toEqual({ type: 'fixed', value: 333.33 });
  });
});

describe('resolveOwnerActions', () => {
  const envelopes: Envelope[] = [
    {
      id: 'besoins',
      label: 'Besoins',
      emoji: '🏠',
      priority: 1,
      allocation: { type: 'percent_envelope', pct: 50 },
      enabled: true,
      fundedBy: 'both',
      children: [],
    },
  ];

  const waterfallResult: WaterfallResult = {
    totalIncome: 5000,
    remainingIncome: 0,
    envelopeResults: [{ envelopeId: 'besoins', amount: 2500, requestedAmount: 2500, children: [] }],
  };

  it('laisse une action manuelle inchangée', () => {
    const actions: PaydayAction[] = [
      { id: 'a1', label: 'Épargne perso', description: '', priority: 1, amount: { type: 'fixed', value: 400 } },
    ];
    const result = resolveOwnerActions(actions, envelopes, waterfallResult, 1);
    expect(result).toEqual([{ action: actions[0], envelope: null, resolvedAmount: { type: 'fixed', value: 400 } }]);
  });

  it('résout une action liée à une enveloppe encore présente', () => {
    const actions: PaydayAction[] = [
      { id: 'a1', label: '🏠 Besoins', description: '', priority: 1, amount: { type: 'envelope', envelopeId: 'besoins' } },
    ];
    const result = resolveOwnerActions(actions, envelopes, waterfallResult, 1);
    expect(result[0].envelope).toBe(envelopes[0]);
    expect(result[0].resolvedAmount).toEqual({ type: 'fixed', value: 2500 });
  });

  it('applique share pour fundedBy: both', () => {
    const actions: PaydayAction[] = [
      { id: 'a1', label: '🏠 Besoins', description: '', priority: 1, amount: { type: 'envelope', envelopeId: 'besoins' } },
    ];
    const result = resolveOwnerActions(actions, envelopes, waterfallResult, 0.6);
    expect(result[0].resolvedAmount).toEqual({ type: 'fixed', value: 1500 });
  });

  it('ignore share (traite comme 1) si fundedBy n\'est pas both', () => {
    const singleOwnerEnvelopes: Envelope[] = [{ ...envelopes[0], fundedBy: 'A' }];
    const actions: PaydayAction[] = [
      { id: 'a1', label: '🏠 Besoins', description: '', priority: 1, amount: { type: 'envelope', envelopeId: 'besoins' } },
    ];
    const result = resolveOwnerActions(actions, singleOwnerEnvelopes, waterfallResult, 0.6);
    expect(result[0].resolvedAmount).toEqual({ type: 'fixed', value: 2500 });
  });

  it('enveloppe supprimée → montant 0, envelope null', () => {
    const actions: PaydayAction[] = [
      { id: 'a1', label: 'Enveloppe supprimée', description: '', priority: 1, amount: { type: 'envelope', envelopeId: 'inconnue' } },
    ];
    const result = resolveOwnerActions(actions, envelopes, waterfallResult, 1);
    expect(result[0]).toEqual({ action: actions[0], envelope: null, resolvedAmount: { type: 'fixed', value: 0 } });
  });
});
