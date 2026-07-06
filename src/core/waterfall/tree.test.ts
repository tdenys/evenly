import { summarizeChildren, type ChildrenSummary } from './tree';
import type { EnvelopeResult } from './types';

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
