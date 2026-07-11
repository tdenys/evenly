import { runPayday } from './engine';
import type { PaydayAction } from './types';

function action(overrides: Partial<PaydayAction> & Pick<PaydayAction, 'id' | 'priority' | 'amount'>): PaydayAction {
  return { label: overrides.id, description: '', ...overrides };
}

describe('runPayday — exemple CLAUDE.md', () => {
  it('salaire 2500€ → 650 / 250 / 800 / 400 / 400, rien de non alloué', () => {
    const actions: PaydayAction[] = [
      action({ id: 'garde', priority: 1, amount: { type: 'fixed', value: 650 } }),
      action({ id: 'voyage', priority: 2, amount: { type: 'percent_salary', pct: 10 } }),
      action({ id: 'besoins', priority: 3, amount: { type: 'fixed', value: 800 } }),
      action({ id: 'pea', priority: 4, amount: { type: 'percent_remaining', pct: 50 } }),
      action({ id: 'epargne', priority: 5, amount: { type: 'remainder' } }),
    ];

    const result = runPayday(2500, actions);

    expect(result.actionResults.map((a) => [a.actionId, a.amount])).toEqual([
      ['garde', 650],
      ['voyage', 250],
      ['besoins', 800],
      ['pea', 400],
      ['epargne', 400],
    ]);
    expect(result.remainder).toBe(0);
  });
});

describe('runPayday — percent_salary', () => {
  it('se calcule toujours sur le salaire total, pas sur le reste', () => {
    const actions: PaydayAction[] = [
      action({ id: 'gros-fixe', priority: 1, amount: { type: 'fixed', value: 2000 } }),
      // 10% de 2500 = 250, même si le reste n'est plus que 500 à cette étape.
      action({ id: 'part-salaire', priority: 2, amount: { type: 'percent_salary', pct: 10 } }),
    ];

    const result = runPayday(2500, actions);

    expect(result.actionResults[1].amount).toBe(250);
  });
});

describe('runPayday — cas limites', () => {
  it('plafonne quand la somme des montants fixes dépasse le salaire', () => {
    const actions: PaydayAction[] = [
      action({ id: 'a', priority: 1, amount: { type: 'fixed', value: 2000 } }),
      action({ id: 'b', priority: 2, amount: { type: 'fixed', value: 2000 } }),
    ];

    const result = runPayday(2500, actions);

    expect(result.actionResults.map((a) => a.amount)).toEqual([2000, 500]);
    // Le demandé n'est pas plafonné, lui — permet de signaler le dépassement.
    expect(result.actionResults.map((a) => a.requestedAmount)).toEqual([2000, 2000]);
  });
});

describe('runPayday — overrides ponctuels', () => {
  it("un ajustement en cours de cascade modifie ce que récupère l'action suivante", () => {
    const actions: PaydayAction[] = [
      action({ id: 'voyage', priority: 1, amount: { type: 'fixed', value: 250 } }),
      action({ id: 'epargne', priority: 2, amount: { type: 'remainder' } }),
    ];

    const withoutOverride = runPayday(2500, actions);
    expect(withoutOverride.actionResults.map((a) => a.amount)).toEqual([250, 2250]);

    // Mois avec prime : on décide ponctuellement de virer 300€ au lieu de 250€ sur "voyage",
    // sans changer la règle permanente (toujours `fixed 250` dans `actions`) — l'épargne
    // (remainder) doit automatiquement absorber la différence.
    const withOverride = runPayday(2500, actions, { voyage: 300 });
    expect(withOverride.actionResults.map((a) => [a.actionId, a.amount])).toEqual([
      ['voyage', 300],
      ['epargne', 2200],
    ]);
  });
});
