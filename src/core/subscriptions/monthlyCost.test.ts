import { monthlyCost } from './monthlyCost';

describe('monthlyCost', () => {
  it('mensuel : renvoie le coût tel quel', () => {
    expect(monthlyCost(15, 'monthly')).toBe(15);
  });

  it('annuel : divise par 12', () => {
    expect(monthlyCost(120, 'yearly')).toBe(10);
  });

  it('trimestriel : divise par 3', () => {
    expect(monthlyCost(30, 'quarterly')).toBe(10);
  });

  it('hebdomadaire : multiplie par 52/12 (moyenne exacte de semaines par mois)', () => {
    expect(monthlyCost(10, 'weekly')).toBe(43.33);
  });

  it('arrondit à 2 décimales', () => {
    expect(monthlyCost(100, 'yearly')).toBe(8.33);
  });
});
