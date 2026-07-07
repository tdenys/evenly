import { resolveEnvelopeAmount } from './fromEnvelope';
import type { Amount } from '@/core/waterfall/types';

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
