// Les 4 types d'allocation — couvrent tous les cas réels.
// `income.a`/`income.b` désignent des personnes stables (pas "moi"/"mon·ma partenaire" — voir
// le commentaire sur `Income` plus bas), donc `who` a le même sens quel que soit qui consulte
// l'app.
export type Amount =
  | { type: 'fixed'; value: number }
  | { type: 'percent_envelope'; pct: number }
  | { type: 'percent_remaining'; pct: number }
  | { type: 'prorata_income'; who: 'A' | 'B' };

// Conservés fidèles au concept initial (CLAUDE.md) mais non utilisés par le moteur pour
// l'instant : la subdivision d'une enveloppe se fait via des enveloppes filles
// (Envelope.children), pas via des Rule avec recipient/condition.
export type Condition =
  | { type: 'skip_if_goal_reached'; goalId: string }
  | { type: 'skip_if_pot_above'; potId: string; threshold: number }
  | { type: 'active_from_date'; date: string };

export type Recipient =
  | { type: 'shared_pot'; potId: string }
  | { type: 'person'; who: 'A' | 'B' }
  | { type: 'prorata' }
  | { type: 'personal_pocket' };

export interface Rule {
  id: string;
  label: string;
  priority: number;
  amount: Amount;
  recipient: Recipient;
  condition?: Condition;
}

export interface Envelope {
  id: string;
  label: string;
  emoji: string;
  priority: number; // ordre de remplissage parmi les enveloppes sœurs
  allocation: Amount;
  // Interrupteur manuel (pas de suivi automatique de solde/objectif) : une enveloppe désactivée
  // vaut 0€ et ne consomme rien du pool, donc ce qu'elle aurait pris profite à la sœur suivante.
  enabled: boolean;
  children: Envelope[]; // sous-enveloppes, même forme, récursif
}

// a/b doivent être assignés de façon STABLE (ex: tri par id de profil), pas "moi"/"partenaire" —
// sinon `who: 'A'` dans un Amount désignerait une personne différente selon qui regarde l'app.
// Voir src/lib/couple.ts pour le helper qui construit cet objet correctement.
export interface Income {
  a: number;
  b: number;
}

export interface WaterfallInput {
  income: Income;
  envelopes: Envelope[];
}

export interface EnvelopeResult {
  envelopeId: string;
  amount: number;
  requestedAmount: number; // demandé avant plafonnement — > amount signale un dépassement
  children: EnvelopeResult[];
}

export interface WaterfallResult {
  totalIncome: number;
  envelopeResults: EnvelopeResult[];
  remainingIncome: number;
}
