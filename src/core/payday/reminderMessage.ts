export interface PendingTransfer {
  label: string;
  formattedAmount: string; // déjà formaté (pas un number) — voir note ci-dessous
}

/** Corps du rappel local — une ligne de résumé (nombre de virements, sans montant total) suivie
 * du détail de chaque virement encore à faire, un par ligne. Un corps de notification
 * multi-lignes est replié sur la 1re ligne côté OS (iOS/Android) et affiche le détail complet
 * une fois dépliée — rien à configurer côté expo-notifications pour ce comportement.
 * `formattedAmount` est déjà formaté (pas un number) pour ne jamais importer src/lib depuis
 * src/core (core reste indépendant de lib) — l'appelant fait `formatAmount(...)` avant. */
export function describeReminderBody(pending: PendingTransfer[]): string {
  if (pending.length === 0) return 'Tous tes virements sont déjà faits ce mois-ci ✓';
  const count = pending.length;
  const summary = `${count} virement${count > 1 ? 's' : ''} à faire`;
  const lines = pending.map((p) => `${p.label} : ${p.formattedAmount}`);
  return [summary, ...lines].join('\n');
}
