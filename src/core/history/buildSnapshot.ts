import type { Envelope, EnvelopeResult } from '@/core/waterfall/types';
import type { EnvelopeSnapshot } from './types';

// Reste pleinement récursif comme runWaterfall/EnvelopeTreeRow, même si l'UI plafonne
// aujourd'hui la profondeur à 2 niveaux — cette limite est purement UI, pas typée ici.
export function buildEnvelopeSnapshot(envelopes: Envelope[], results: EnvelopeResult[]): EnvelopeSnapshot[] {
  return envelopes.map((envelope) => {
    const result = results.find((r) => r.envelopeId === envelope.id);
    return {
      id: envelope.id,
      label: envelope.label,
      emoji: envelope.emoji,
      amount: result?.amount ?? 0,
      children: buildEnvelopeSnapshot(envelope.children, result?.children ?? []),
    };
  });
}
