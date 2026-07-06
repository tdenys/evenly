import type { Envelope, EnvelopeResult } from './types';

export function findEnvelope(envelopes: Envelope[], id: string): Envelope | undefined {
  for (const envelope of envelopes) {
    if (envelope.id === id) return envelope;
    const found = findEnvelope(envelope.children, id);
    if (found) return found;
  }
  return undefined;
}

export function findEnvelopeResult(results: EnvelopeResult[], id: string): EnvelopeResult | undefined {
  for (const result of results) {
    if (result.envelopeId === id) return result;
    const found = findEnvelopeResult(result.children, id);
    if (found) return found;
  }
  return undefined;
}

/** Renvoie le tableau (racine ou enfants d'un parent) qui contient directement cet id. */
export function findSiblings(envelopes: Envelope[], id: string): Envelope[] | undefined {
  if (envelopes.some((e) => e.id === id)) return envelopes;
  for (const envelope of envelopes) {
    const found = findSiblings(envelope.children, id);
    if (found) return found;
  }
  return undefined;
}
