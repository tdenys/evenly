import { buildRootEnvelopeTrend } from './rootEnvelopeTrend';
import type { BudgetSnapshot } from './types';

function snapshot(period: string, envelopes: BudgetSnapshot['envelopes']): BudgetSnapshot {
  return { id: `snap-${period}`, period, totalIncome: 0, incomeA: 0, incomeB: 0, envelopes };
}

describe('buildRootEnvelopeTrend', () => {
  it('groupe par label (pas par id) à travers plusieurs mois', () => {
    const snapshots = [
      snapshot('2026-05-01', [{ id: 'a', label: 'Besoins', emoji: '🏠', amount: 800, children: [] }]),
      snapshot('2026-06-01', [{ id: 'b', label: 'Besoins', emoji: '🏠', amount: 850, children: [] }]),
    ];
    const trend = buildRootEnvelopeTrend(snapshots);
    expect(trend).toEqual([
      {
        label: 'Besoins',
        emoji: '🏠',
        points: [
          { period: '2026-05-01', amount: 800 },
          { period: '2026-06-01', amount: 850 },
        ],
      },
    ]);
  });

  it('ne descend jamais dans les sous-enveloppes (premier niveau seulement)', () => {
    const snapshots = [
      snapshot('2026-06-01', [
        {
          id: 'a',
          label: 'Besoins',
          emoji: '🏠',
          amount: 800,
          children: [{ id: 'loyer', label: 'Loyer', emoji: '🔑', amount: 600, children: [] }],
        },
      ]),
    ];
    expect(buildRootEnvelopeTrend(snapshots).map((s) => s.label)).toEqual(['Besoins']);
  });

  it('une enveloppe absente un mois donné produit moins de points, jamais un point à 0€', () => {
    const snapshots = [
      snapshot('2026-05-01', [{ id: 'a', label: 'Besoins', emoji: '🏠', amount: 800, children: [] }]),
      snapshot('2026-06-01', [
        { id: 'b', label: 'Besoins', emoji: '🏠', amount: 850, children: [] },
        { id: 'c', label: 'Envies', emoji: '🎉', amount: 400, children: [] },
      ]),
    ];
    const trend = buildRootEnvelopeTrend(snapshots);
    const envies = trend.find((s) => s.label === 'Envies');
    expect(envies?.points).toEqual([{ period: '2026-06-01', amount: 400 }]);
  });

  it('reprend l\'emoji le plus récent si celui-ci a changé, en gardant le même label', () => {
    const snapshots = [
      snapshot('2026-05-01', [{ id: 'a', label: 'Besoins', emoji: '🏠', amount: 800, children: [] }]),
      snapshot('2026-06-01', [{ id: 'b', label: 'Besoins', emoji: '🏡', amount: 850, children: [] }]),
    ];
    const trend = buildRootEnvelopeTrend(snapshots);
    expect(trend).toHaveLength(1);
    expect(trend[0].emoji).toBe('🏡');
  });

  it('ne garde que les monthsBack mois les plus récents, en ordre chronologique croissant', () => {
    const snapshots = [
      snapshot('2026-01-01', [{ id: '1', label: 'Besoins', emoji: '🏠', amount: 100, children: [] }]),
      snapshot('2026-02-01', [{ id: '2', label: 'Besoins', emoji: '🏠', amount: 200, children: [] }]),
      snapshot('2026-03-01', [{ id: '3', label: 'Besoins', emoji: '🏠', amount: 300, children: [] }]),
    ];
    const trend = buildRootEnvelopeTrend(snapshots, 2);
    expect(trend[0].points.map((p) => p.period)).toEqual(['2026-02-01', '2026-03-01']);
  });

  it("l'ordre d'entrée des snapshots n'a pas d'importance, le tri se fait par period", () => {
    const snapshots = [
      snapshot('2026-06-01', [{ id: 'b', label: 'Besoins', emoji: '🏠', amount: 850, children: [] }]),
      snapshot('2026-05-01', [{ id: 'a', label: 'Besoins', emoji: '🏠', amount: 800, children: [] }]),
    ];
    expect(buildRootEnvelopeTrend(snapshots)[0].points.map((p) => p.amount)).toEqual([800, 850]);
  });

  it('renvoie un tableau vide sans snapshot', () => {
    expect(buildRootEnvelopeTrend([])).toEqual([]);
  });
});
