import type { BudgetSnapshot } from './types';

export interface RootEnvelopeTrendPoint {
  period: string; // 'YYYY-MM-01'
  amount: number;
}

export interface RootEnvelopeTrendSeries {
  label: string;
  emoji: string;
  points: RootEnvelopeTrendPoint[];
}

/** Évolution des enveloppes de PREMIER NIVEAU (racine, jamais les sous-enveloppes) à travers une
 * liste de `BudgetSnapshot`, groupées par `label` — jamais par `id` : chaque mois a ses propres
 * lignes d'enveloppe indépendantes (voir "Le Waterfall daté" dans CLAUDE.md), donc l'id d'une
 * même enveloppe conceptuelle diffère d'un mois à l'autre, seul le libellé reste la clé stable
 * du point de vue de l'utilisateur. Une enveloppe absente d'un mois (créée après coup, ou
 * temporairement désactivée/supprimée) donne simplement une série avec moins de points, pas un
 * point à 0€ — pour ne pas laisser croire à une vraie baisse.
 *
 * Ne garde que les `monthsBack` mois les plus récents, renvoyés en ordre chronologique
 * CROISSANT (le plus ancien en premier) — l'ordre naturel de lecture d'un graphique gauche→droite. */
export function buildRootEnvelopeTrend(snapshots: BudgetSnapshot[], monthsBack = 6): RootEnvelopeTrendSeries[] {
  const recent = [...snapshots].sort((a, b) => (a.period < b.period ? 1 : -1)).slice(0, monthsBack).reverse();

  const seriesByLabel = new Map<string, RootEnvelopeTrendSeries>();
  for (const snapshot of recent) {
    for (const envelope of snapshot.envelopes) {
      const existing = seriesByLabel.get(envelope.label);
      if (existing) {
        existing.emoji = envelope.emoji; // le plus récent l'emporte (on parcourt en ordre croissant)
        existing.points.push({ period: snapshot.period, amount: envelope.amount });
      } else {
        seriesByLabel.set(envelope.label, {
          label: envelope.label,
          emoji: envelope.emoji,
          points: [{ period: snapshot.period, amount: envelope.amount }],
        });
      }
    }
  }
  return [...seriesByLabel.values()];
}
