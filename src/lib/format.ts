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

/** Ex: "juillet 2026" à partir d'un period 'YYYY-MM-01'. */
export function formatPeriodLabel(period: string): string {
  return new Date(period).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Mois calendaire local (pas UTC) sous forme 'YYYY-MM-01' — le format `period` partagé par
 * budget_snapshots et payday_checks. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
