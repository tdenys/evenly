// Module pur, indépendant de src/core/waterfall/ et src/core/payday/ — même principe
// d'isolation (zéro dépendance externe) que les autres modules de src/core.

export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  title: string;
  cost: number; // coût dans l'unité de sa propre fréquence (ex: 60 pour "60€/an")
  frequency: SubscriptionFrequency;
  category: string; // texte libre, peut être vide
  assignedTo: 'A' | 'B' | 'both';
}
