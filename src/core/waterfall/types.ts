// Les 4 types d'allocation — couvrent tous les cas réels
export type Amount =
  | { type: 'fixed'; value: number }
  | { type: 'percent_envelope'; pct: number }
  | { type: 'percent_remaining'; pct: number }
  | { type: 'prorata_income' };

// Conditions optionnelles sur une règle
export type Condition =
  | { type: 'skip_if_goal_reached'; goalId: string }
  | { type: 'skip_if_pot_above'; potId: string; threshold: number }
  | { type: 'active_from_date'; date: string };

// Destination de l'argent alloué par une règle
export type Recipient =
  | { type: 'shared_pot'; potId: string }
  | { type: 'person'; who: 'A' | 'B' }
  | { type: 'prorata' }
  | { type: 'personal_pocket' };

export interface Rule {
  id: string;
  label: string;
  priority: number; // ordre d'exécution dans l'enveloppe (1 = premier)
  amount: Amount;
  recipient: Recipient;
  condition?: Condition;
}

export interface Envelope {
  id: string;
  label: string;
  emoji: string;
  priority: number; // ordre de remplissage des enveloppes
  allocation: Amount;
  rules: Rule[];
}

export interface Income {
  a: number;
  b: number;
}

export interface GoalsState {
  [goalId: string]: { current: number; target: number };
}

export interface PotsState {
  [potId: string]: number;
}

export interface WaterfallInput {
  income: Income;
  envelopes: Envelope[];
  goals?: GoalsState;
  pots?: PotsState;
  today?: string; // ISO date, défaut = aujourd'hui
}

export interface RuleAllocation {
  envelopeId: string;
  ruleId: string;
  amount: number;
  skipped: boolean;
  recipient: Recipient;
  split?: { a: number; b: number }; // uniquement si recipient.type === "prorata"
}

export interface EnvelopeResult {
  envelopeId: string;
  amount: number;
  ruleAllocations: RuleAllocation[];
}

export interface WaterfallResult {
  totalIncome: number;
  envelopeResults: EnvelopeResult[];
  remainingIncome: number;
}
