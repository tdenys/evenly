// Module pur, indépendant des autres modules de src/core — même principe d'isolation.

export interface EnvelopeSnapshot {
  id: string;
  label: string;
  emoji: string;
  amount: number;
  children: EnvelopeSnapshot[];
}

export interface BudgetSnapshot {
  id: string;
  period: string; // 'YYYY-MM-01'
  totalIncome: number;
  incomeA: number;
  incomeB: number;
  envelopes: EnvelopeSnapshot[];
}
