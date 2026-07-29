import type { Amount, Envelope, EnvelopeResult } from './types';
import { round2 } from './engine';

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

/** Liste plate de toutes les enveloppes de l'arbre (à n'importe quel niveau) dont `fundedBy`
 * n'est pas `null` — sert au store (réconciliation payday_actions) et à PaydayScreen
 * (résolution des montants). */
export function findFundedEnvelopes(envelopes: Envelope[]): Envelope[] {
  return envelopes.flatMap((envelope) => [
    ...(envelope.fundedBy !== null ? [envelope] : []),
    ...findFundedEnvelopes(envelope.children),
  ]);
}

/** Liste plate de toutes les enveloppes de l'arbre (à n'importe quel niveau) ayant un objectif
 * actif (`goal !== null`) — sert à l'écran Accueil pour retrouver l'objectif le plus proche
 * d'être atteint, tous niveaux confondus (racine ou sous-enveloppe). */
export function findEnvelopesWithGoal(envelopes: Envelope[]): Envelope[] {
  return envelopes.flatMap((envelope) => [
    ...(envelope.goal !== null ? [envelope] : []),
    ...findEnvelopesWithGoal(envelope.children),
  ]);
}

export interface FlatEnvelope {
  id: string;
  label: string;
  emoji: string;
  depth: number;
}

/** Liste plate de toutes les enveloppes de l'arbre (racine + sous-enveloppes) avec leur
 * profondeur — sert aux sélecteurs qui doivent proposer n'importe quelle enveloppe, pas
 * seulement un niveau (ex: lier un abonnement à une enveloppe). */
export function flattenEnvelopes(envelopes: Envelope[], depth = 0): FlatEnvelope[] {
  return envelopes.flatMap((envelope) => [
    { id: envelope.id, label: envelope.label, emoji: envelope.emoji, depth },
    ...flattenEnvelopes(envelope.children, depth + 1),
  ]);
}

/** Reconstruit l'arbre en remplaçant l'allocation de chaque enveloppe présente dans `overrides`
 * (par id) — sert au mode simulation ("et si"), qui rejoue runWaterfall sur une copie modifiée
 * de l'arbre réel sans jamais toucher aux enveloppes en base. */
export function applyAllocationOverrides(envelopes: Envelope[], overrides: Record<string, Amount>): Envelope[] {
  return envelopes.map((envelope) => ({
    ...envelope,
    allocation: overrides[envelope.id] ?? envelope.allocation,
    children: applyAllocationOverrides(envelope.children, overrides),
  }));
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

export interface ChildrenSummary {
  remaining: number; // ce qu'il reste à placer dans `parentAmount` (toujours >= 0, grâce au clamp)
  overflow: number; // > 0 si la somme des demandes des enfants dépasse `parentAmount`
}

/** Résumé du remplissage d'une enveloppe (ou du revenu total à la racine) par ses enfants. */
export function summarizeChildren(parentAmount: number, children: EnvelopeResult[]): ChildrenSummary {
  const allocated = children.reduce((sum, c) => sum + c.amount, 0);
  const requested = children.reduce((sum, c) => sum + c.requestedAmount, 0);
  return {
    remaining: round2(parentAmount - allocated),
    overflow: round2(Math.max(requested - parentAmount, 0)),
  };
}
