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

// Montant cible + solde courant saisi à la main (pas de connexion bancaire) — objet imbriqué
// nullable plutôt que 2 champs plats indépendamment nullables : "cible sans solde" (ou
// l'inverse) doit rester irreprésentable au niveau du type, pas seulement vérifié à l'usage.
export interface EnvelopeGoal {
  target: number;
  current: number;
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
  // Qui vire l'argent vers cette enveloppe depuis son salaire (Payday Flow) — indépendant du
  // type d'allocation ci-dessus (ex: une enveloppe "prorata_income who:A" pourrait très bien
  // être financée par B, l'app ne force pas la cohérence entre les deux). `null` = pas liée au
  // payday (la plupart des enveloppes, notamment les subdivisions internes).
  fundedBy: 'A' | 'B' | 'both' | null;
  // `null` = pas d'objectif. Une fois `current >= target`, l'enveloppe est automatiquement
  // skip par le moteur (voir isGoalReached dans engine.ts) — même mécanisme que `enabled: false`.
  goal: EnvelopeGoal | null;
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
