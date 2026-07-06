export function formatAmount(amount: number): string {
  return `${amount.toFixed(2)} €`;
}

/** Ex: "300.00 € (8.33%)" — omet le pourcentage si `ofTotal` est nul (rien à rapporter). */
export function formatAmountWithPct(amount: number, ofTotal: number): string {
  if (ofTotal <= 0.01) return formatAmount(amount);
  const pct = (amount / ofTotal) * 100;
  return `${formatAmount(amount)} (${pct.toFixed(2)}%)`;
}

/** Juste le pourcentage, ex: "8.33%" — `null` si `ofTotal` est nul (rien à rapporter). */
export function formatPct(amount: number, ofTotal: number): string | null {
  if (ofTotal <= 0.01) return null;
  return `${((amount / ofTotal) * 100).toFixed(2)}%`;
}
