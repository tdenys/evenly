import type { PaydayAction, PaydayResult } from './types';

export const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, remaining: number) => Math.min(Math.max(value, 0), Math.max(remaining, 0));

function byPriority(actions: PaydayAction[]): PaydayAction[] {
  return [...actions].sort((a, b) => a.priority - b.priority);
}

/** `overrides` permet d'ajuster ponctuellement le montant d'une action (mois atypique, prime...)
 * sans toucher à sa règle permanente — l'action suivante voit quand même le `remaining` corrigé
 * en conséquence (ex: un `remainder` en bout de cascade absorbe automatiquement l'écart). */
export function runPayday(
  salary: number,
  actions: PaydayAction[],
  overrides: Record<string, number> = {}
): PaydayResult {
  let remaining = salary;

  const actionResults = byPriority(actions).map((action) => {
    let raw: number;
    if (action.id in overrides) {
      raw = overrides[action.id];
    } else {
      switch (action.amount.type) {
        case 'fixed':
          raw = action.amount.value;
          break;
        case 'percent_salary':
          raw = (action.amount.pct / 100) * salary;
          break;
        case 'percent_remaining':
          raw = (action.amount.pct / 100) * remaining;
          break;
        case 'remainder':
          raw = remaining;
          break;
        case 'envelope':
          // Doit toujours avoir été résolu en `fixed`/`remainder` par l'appelant (voir
          // src/core/payday/fromEnvelope.ts) — ce moteur pur ne connaît pas les enveloppes
          // Waterfall, même principe que `prorata_income` dans waterfall/engine.ts.
          throw new Error('envelope amounts must be resolved before calling runPayday');
      }
    }

    const requestedAmount = round2(Math.max(raw, 0));
    const amount = round2(clamp(raw, remaining));
    remaining = round2(remaining - amount);

    return { actionId: action.id, amount, requestedAmount };
  });

  return { salary, actionResults, remainder: remaining };
}
