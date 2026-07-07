// Module pur, indépendant de src/core/waterfall/ — même principe d'isolation (zéro dépendance
// externe), pas de couplage entre les deux moteurs même s'ils se ressemblent.

export type PaydayAmount =
  | { type: 'fixed'; value: number }
  | { type: 'percent_salary'; pct: number } // % du salaire total (constant pendant la cascade)
  | { type: 'percent_remaining'; pct: number } // % de ce qu'il reste à cette étape
  | { type: 'remainder' } // tout ce qu'il reste
  // Référence vivante vers une enveloppe Waterfall (voir src/core/payday/fromEnvelope.ts) — sa
  // valeur n'a de sens qu'une fois résolue avec les données Waterfall, donc `runPayday` refuse
  // ce type tel quel : le call-site doit toujours l'avoir remplacé par un montant concret avant.
  | { type: 'envelope'; envelopeId: string };

/** Ce qu'un utilisateur peut choisir à la main dans PaydayAmountEditor — `envelope` n'est jamais
 * saisi manuellement, seulement posé automatiquement via le lien depuis une enveloppe Waterfall
 * (voir EnvelopeFormScreen "Financée par"). */
export type ManualPaydayAmount = Exclude<PaydayAmount, { type: 'envelope' }>;

export interface PaydayAction {
  id: string;
  label: string;
  priority: number; // ordre de traitement parmi les actions de la même personne
  amount: PaydayAmount;
}

export interface PaydayActionResult {
  actionId: string;
  amount: number;
  requestedAmount: number; // avant plafonnement, comme EnvelopeResult — signale un dépassement
}

export interface PaydayResult {
  salary: number;
  actionResults: PaydayActionResult[];
  remainder: number; // ce qu'il reste après la dernière action
}
