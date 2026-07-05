@AGENTS.md

# Budget Couple — Contexte projet pour Claude Code

## Ce qu'est ce projet

Application mobile personnelle pour gérer équitablement les finances d'un couple.
**Exactement 2 utilisateurs** — pas une app commerciale, pas de multi-tenant.

Problème résolu : le couple gérait ses finances via Google Sheets, outil trop rigide pour
modéliser des règles financières conditionnelles et en cascade. L'app remplace le tableur
par un moteur de règles paramétrable avec une interface mobile simple.

Définition du succès : "On ne se pose plus la question de l'équité."

---

## Stack technique

| Couche | Choix |
|---|---|
| Mobile | React Native + Expo (blank-typescript) |
| Langage | TypeScript strict |
| State | Zustand |
| Navigation | React Navigation |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Tests | Jest |

**Pourquoi React Native plutôt que Flutter** : meilleur marché de l'emploi (atout CV),
TypeScript est proche de Java/Kotlin (background du développeur).

**Pourquoi Expo** : abstrait la configuration native iOS/Android, suffisant pour ce projet
(aucune API native exotique requise).

**Pourquoi Supabase** : remplace un serveur PostgreSQL + API REST + Auth + Storage + Realtime.
Gratuit pour 2 utilisateurs. Plan Free largement suffisant (limite : 50 000 users / 500 MB BDD).

---

## Architecture du code

```
src/
├── core/
│   └── waterfall/
│       ├── types.ts          → tous les types métier (Amount, Rule, Envelope, Condition...)
│       ├── engine.ts         → algorithme de cascade — TypeScript PUR, aucune dépendance externe
│       └── engine.test.ts    → tests Jest du moteur
│
├── lib/
│   └── supabase.ts           → client Supabase (instance unique)
│
├── store/
│   └── useStore.ts           → état global Zustand
│
└── screens/
    ├── DashboardScreen.tsx   → solde en temps réel
    ├── AddExpenseScreen.tsx  → saisie dépense
    └── PaydayScreen.tsx      → dispatch de salaire
```

**Principe fondamental** : `src/core/waterfall/engine.ts` est du TypeScript pur.
Zéro import React Native, zéro import Supabase. Seulement des fonctions qui prennent
des données et retournent des résultats. Testable avec Jest sans lancer l'app.

---

## Le concept central : Waterfall budgétaire

L'argent coule comme une cascade depuis les revenus vers des enveloppes, qui peuvent
elles-mêmes se subdiviser en sous-enveloppes, à volonté (récursif).

### Niveau 1 — Les enveloppes

```
Revenus nets du couple (ex: 5 000€)
│
├── 🏠 BESOINS          50% → 2 500€
├── 🎉 ENVIES           30% → 1 500€
└── 📈 INVESTISSEMENT   20% → 1 000€
```

### Niveau 2 — Les sous-enveloppes (au sein de chaque enveloppe)

Une sous-enveloppe a **exactement la même forme qu'une enveloppe** (label, emoji, priorité,
allocation) — pas de notion de destination (`recipient`) ni de condition, juste une subdivision
de budget. Rien n'empêche une sous-enveloppe d'avoir elle-même des sous-enveloppes.

```
✈️ VOYAGE (300€)
│
├── 🗾 Voyage Japon        50% → 150€
└── ⛺ Camping Normandie   50% → 150€
```

```
📈 INVESTISSEMENT (1 000€)
│
├── [P1] Matelas sécurité    300€ fixe
│         Reste = 700€
│
├── [P2] Apport immobilier   50% du reste → 350€
│         Reste = 350€
│
├── [P3] PEA de A (prorata revenus)   → 210€  (60% des revenus du couple)
└── [P4] PEA de B (prorata revenus)   → 140€  (40% des revenus du couple)
```

`A`/`B` sont assignés une fois pour toutes de façon stable (ex: tri par id de profil) — pas
"moi"/"mon·ma partenaire" — sinon `who: "A"` désignerait une personne différente selon qui
consulte l'app. Des sous-enveloppes `prorata_income` **consécutives** (par priorité) se
partagent le même reste figé au début du groupe : A prend `reste × partA`, B prend
`reste × partB`, et `partA + partB = 1` garantit qu'elles se partagent exactement le total —
contrairement à un enchaînement naïf où B recevrait sa part d'un reste déjà amputé par A.

---

## Les types TypeScript fondamentaux

```typescript
// Les 4 types d'allocation — couvrent tous les cas réels
type Amount =
  | { type: "fixed"; value: number }
  | { type: "percent_envelope"; pct: number }   // % de la capacité initiale du pool à ce niveau
  | { type: "percent_remaining"; pct: number }  // % de ce qu'il reste au moment de l'évaluation
  | { type: "prorata_income"; who: "A" | "B" }  // part de ce qu'il reste proportionnelle au revenu de A ou B

interface Envelope {
  id: string
  label: string
  emoji: string
  priority: number        // ordre de remplissage parmi les enveloppes sœurs
  allocation: Amount
  children: Envelope[]    // sous-enveloppes, même forme, récursif
}
```

`Rule`, `Recipient` et `Condition` (destination de l'argent + conditions type
`skip_if_goal_reached`/`skip_if_pot_above`/`active_from_date`) restent définis dans
`src/core/waterfall/types.ts` mais **ne sont plus utilisés par le moteur** : la subdivision
d'une enveloppe se fait via `children`, pas via des règles avec destination. Ces types sont
conservés au cas où un besoin de "verser vers X, sauf si Y" refasse surface plus tard — mais
tant que rien ne les utilise, ne pas les câbler dans l'UI ou le moteur.

---

## Le Payday Flow (dispatch de salaire)

À chaque salaire reçu, l'app génère un plan d'action personnalisé pour chaque partenaire.

```
Salaire de Laura = 2 500€

① Garde sur toi (Plaisir perso)    650€   [fixed]
② Vire Voyage                       250€   [percent_salary: 10%]
③ Vire Besoins                      800€   [fixed]
④ Vire PEA                          400€   [percent_remaining: 50%]
⑤ Épargne perso                     400€   [remainder]
```

Les 4 types de montant dans le dispatch :

```typescript
type PaydayAmount =
  | { type: "fixed"; value: number }
  | { type: "percent_salary"; pct: number }
  | { type: "percent_remaining"; pct: number }
  | { type: "remainder" }
```

**Important** : les montants sont modifiables à la main au moment du dispatch
(ponctuel, sans changer la règle permanente). Couvre les mois atypiques (prime, etc.).

---

## MVP — Ce qui est dans la V1

- Créer un couple (invitation par lien ou code)
- Saisir une dépense (montant, catégorie, qui a payé)
- Règle de partage unique : 50/50 ou proportionnel aux revenus
- Solde en temps réel : "Tu dois 34€ à X"
- Bouton "Solder"

**C'est tout.** Ne pas ajouter de fonctionnalités V2 pendant le développement du MVP.

---

## Hors scope — Ne pas implémenter

- Plus de 2 utilisateurs
- Connexion bancaire / agrégation de comptes
- Waterfall complet avec règles en cascade → V2
- Payday Flow paramétrable → V2
- Objectifs avec suivi → V3
- Statistiques et graphiques → V4
- Photos de tickets, dépenses récurrentes → V5
- Export PDF → V5

---

## Conventions de code

- **TypeScript strict** : `strict: true` dans tsconfig, pas de `any`
- **Fichiers** : PascalCase pour les composants (`AddExpenseScreen.tsx`),
  camelCase pour le reste (`useStore.ts`, `engine.ts`)
- **Composants** : functional components avec hooks uniquement, pas de classes
- **Imports** : chemins absolus depuis `src/` (configurer dans tsconfig)
- **Tests** : un fichier `.test.ts` par module core, Jest
- **Nommage** : noms en anglais dans le code, labels UI en français

---

## Supabase — Notes importantes

- Le client Supabase est instancié une seule fois dans `src/lib/supabase.ts`
- Row Level Security (RLS) activé sur toutes les tables — un utilisateur ne voit
  que les données de son couple
- Le plan Free se met en pause après 1 semaine d'inactivité (~10s de réveil)
  → prévoir un ping automatique en production

---

## Ce que le développeur apporte

- Background Java/Kotlin — TypeScript est immédiatement lisible
- Développeur back-end — l'isolation du moteur waterfall en TypeScript pur est naturelle
- Pas d'expérience React Native — favoriser les patterns simples et documentés