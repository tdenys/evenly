@AGENTS.md

# Budget Couple ("Evenly") — Contexte projet pour Claude Code

## Ce qu'est ce projet

Application mobile personnelle pour gérer équitablement les finances d'un couple, affichée sous
le nom **Evenly** dans l'UI (voir écran de connexion) — le slug technique (`app.json`,
`package.json`, repo) reste `budget-couple`, jamais renommé au niveau config.
**Exactement 2 utilisateurs** — pas une app commerciale, pas de multi-tenant.

Problème résolu : le couple gérait ses finances via Google Sheets, outil trop rigide pour
modéliser des règles financières conditionnelles et en cascade. L'app remplace le tableur
par un moteur de règles paramétrable avec une interface mobile simple.

Définition du succès : "On ne se pose plus la question de l'équité."

Le MVP initial (dépenses ponctuelles + règle de partage 50/50 + solde "qui doit quoi à qui")
a été abandonné en cours de route au profit du modèle **Waterfall + Payday Flow** décrit
ci-dessous, qui est désormais le cœur réel de l'app (pas juste une idée V2 — c'est ce qui est
construit et utilisé). Les tables `expenses`/`settlements` existent encore dans
`supabase/migration.sql` (résidu du MVP V1) mais **ne sont plus lues par aucun écran actuel** —
ne pas construire dessus, elles peuvent être ignorées ou nettoyées un jour sans risque.

---

## Stack technique

| Couche | Choix |
|---|---|
| Mobile | React Native + Expo **SDK 57** (voir `AGENTS.md` — API changée, vérifier les docs versionnées avant d'écrire du code Expo) |
| Langage | TypeScript strict |
| State | Zustand (un seul store, `src/store/useStore.ts`) |
| Navigation | React Navigation (bottom-tabs + native-stack pour les modales) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Icônes | `lucide-react-native` pour tout le chrome UI (jamais d'emoji d'interface) |
| Build/déploiement | EAS Build (natif) + EAS Update (OTA JS-only) |
| Tests | Jest |

**Pourquoi React Native plutôt que Flutter** : meilleur marché de l'emploi (atout CV),
TypeScript est proche de Java/Kotlin (background du développeur).

**Pourquoi Expo** : abstrait la configuration native iOS/Android, suffisant pour ce projet
(aucune API native exotique requise).

**Pourquoi Supabase** : remplace un serveur PostgreSQL + API REST + Auth + Storage + Realtime.
Gratuit pour 2 utilisateurs. Plan Free largement suffisant (limite : 50 000 users / 500 MB BDD).

**EAS Build vs EAS Update** : un changement de dépendance native (ex: `expo-clipboard`,
`react-native-svg`) exige un `eas build` complet. Un changement JS/TS pur peut être livré par
`eas update --channel preview --environment preview` sur un build déjà installé sur l'appareil
(pas besoin de repasser par le store/une install manuelle). `expo-updates` est configuré pour
vérifier et appliquer les mises à jour au lancement (`src/lib/updates.ts`,
`checkAndApplyUpdate()`), avec un bouton manuel de secours dans Paramètres.

---

## Architecture du code

```
src/
├── core/                          → TypeScript PUR, zéro import React Native/Supabase.
│   │                                Un dossier par domaine métier, chacun testable au Jest
│   │                                sans lancer l'app (un .test.ts colocalisé par module).
│   ├── waterfall/
│   │   ├── types.ts               → Amount, Envelope, Income, WaterfallResult...
│   │   ├── engine.ts               → runWaterfall() — cascade de répartition en enveloppes
│   │   ├── tree.ts                 → helpers de parcours d'arbre (findEnvelope, findSiblings...)
│   │   └── *.test.ts
│   ├── payday/
│   │   ├── types.ts                → PaydayAmount, PaydayAction, PaydayResult...
│   │   ├── engine.ts                → runPayday() — cascade du dispatch de salaire
│   │   ├── fromEnvelope.ts          → résout une action "liée à une enveloppe" en montant concret
│   │   └── *.test.ts
│   ├── subscriptions/
│   │   ├── types.ts                → Subscription, SubscriptionFrequency
│   │   └── monthlyCost.ts           → normalise un coût (semaine/mois/trimestre/an) en équivalent mensuel
│   ├── accounts/
│   │   └── types.ts                → Account (compte de destination bancaire)
│   └── history/
│       ├── types.ts                → EnvelopeSnapshot, BudgetSnapshot (instantané figé)
│       └── buildSnapshot.ts         → zip récursif Envelope[] + EnvelopeResult[] → snapshot figé
│
├── lib/
│   ├── supabase.ts                 → client Supabase (instance unique)
│   ├── couple.ts                    → orderCouple/coupleIncome/coupleLabels (identité A/B stable)
│   ├── format.ts                    → formatAmount/formatPct/formatPeriodLabel...
│   ├── alert.ts                     → notify()/confirmAction()/errorMessage() (wrappers Alert natifs)
│   ├── notifications.ts             → rappel local de jour de versement (expo-notifications)
│   └── updates.ts                   → checkAndApplyUpdate() (EAS Update au lancement)
│
├── theme/
│   ├── colors.ts                    → palette + ink()/withOpacity() (opacité sur l'encre de base)
│   └── typography.ts                 → familles de polices (Karla/Spectral) + styles de texte partagés
│
├── components/
│   ├── ui/                          → primitives partagées (Button, Chip/ChipRow, SectionCard,
│   │                                   SummaryCard, Stepper, AppSwitch, LoadingScreen)
│   ├── EnvelopeTreeRow.tsx            → rendu INTERACTIF de l'arbre d'enveloppes (drag, menu ⋯, édition)
│   ├── HistoryEnvelopeRow.tsx          → rendu LECTURE SEULE d'un EnvelopeSnapshot (pas le même composant,
│   │                                     volontairement — pas de logique interactive à neutraliser)
│   ├── AmountEditor.tsx                → popup €/% pour Amount (Waterfall)
│   └── PaydayAmountEditor.tsx          → équivalent pour PaydayAmount
│
├── store/
│   └── useStore.ts                  → état global Zustand, un slice CRUD par domaine (voir plus bas)
│
├── navigation/
│   └── RootNavigator.tsx             → AuthStack / onboarding / MainTabs (5 onglets) + modales racine
│
└── screens/
    ├── auth/                        → LoginScreen, SignUpScreen
    ├── onboarding/                  → CreateOrJoinCoupleScreen, WaitingForPartnerScreen
    ├── waterfall/                   → WaterfallScreen (onglet "Budget"), EnvelopeFormScreen (modal),
    │                                    IncomeFormScreen (modal, atteint depuis la carte revenu)
    ├── payday/                      → PaydayScreen (onglet "Répartition"), PaydayActionFormScreen (modal)
    ├── subscriptions/               → SubscriptionsScreen (onglet "Abonnements"), SubscriptionFormScreen (modal)
    ├── history/                     → HistoryScreen (onglet "Historique") — pas de modal, tout est inline
    └── settings/                    → SettingsScreen (onglet "Paramètres" : prénoms, comptes, mises à jour)
```

**Principe fondamental inchangé** : tout `src/core/*` est du TypeScript pur — seulement des
fonctions qui prennent des données et retournent des résultats, zéro I/O. Les champs qui sont
des FK vers une autre table (`ownerId` → profiles, `accountId` → accounts) sont **bolted-on
uniquement à la couche store** (ex: `PaydayActionRow = PaydayAction & { ownerId; accountId }`),
jamais dans le type pur du domaine — c'est le principe à reproduire pour toute nouvelle relation
inter-domaines.

---

## Navigation actuelle (5 onglets)

`Budget` (Waterfall) · `Répartition` (Payday) · `Abonnements` (Subscriptions) · `Historique`
(History) · `Paramètres` (Settings) — bottom-tabs persistants. Les formulaires de création/édition
(`EnvelopeForm`, `IncomeForm`, `PaydayActionForm`, `SubscriptionForm`) vivent au niveau racine en
tant que modales par-dessus la tab bar, pas comme des écrans d'onglet. Un onglet qui n'a pas de
flux de création dédié (comme Historique, où "clôturer" est un simple bouton dans l'écran) n'a
besoin d'aucune entrée dans `RootStackParamList`.

---

## Le concept central : Waterfall budgétaire

L'argent coule comme une cascade depuis les revenus vers des enveloppes, qui peuvent
elles-mêmes se subdiviser en sous-enveloppes (2 niveaux max côté UI — limite purement UI, le
moteur et les types restent pleinement récursifs).

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
de budget. L'UI empêche de créer une sous-enveloppe sous une sous-enveloppe (voir
`EnvelopeTreeRow.tsx`), mais ce n'est qu'une restriction d'interface.

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

`A`/`B` sont assignés une fois pour toutes de façon stable (tri par id de profil, voir
`src/lib/couple.ts::orderCouple`) — pas "moi"/"mon·ma partenaire" — sinon `who: "A"` désignerait
une personne différente selon qui consulte l'app. Des sous-enveloppes `prorata_income`
**consécutives** (par priorité) se partagent le même reste figé au début du groupe : A prend
`reste × partA`, B prend `reste × partB`, et `partA + partB = 1` garantit qu'elles se partagent
exactement le total — contrairement à un enchaînement naïf où B recevrait sa part d'un reste
déjà amputé par A.

Une enveloppe a aussi `enabled` (désactivée = 0€, transparente pour le pool) et `fundedBy`
(`'A' | 'B' | 'both' | null` — qui vire l'argent dessus depuis son salaire, indépendant du type
d'allocation, voir Payday Flow ci-dessous).

---

## Les types TypeScript fondamentaux (Waterfall)

```typescript
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
  enabled: boolean
  fundedBy: "A" | "B" | "both" | null
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

À chaque salaire reçu, l'app génère un plan d'action personnalisé pour chaque partenaire
(onglet "Répartition"). Une action peut aussi être une **référence vivante** vers une enveloppe
(`amount.type === 'envelope'`) — son montant est alors toujours recalculé depuis le Waterfall
courant, jamais figé (voir `src/core/payday/fromEnvelope.ts` et `syncPaydayActionsForEnvelope`
dans le store, qui crée/supprime ces actions automatiquement quand `fundedBy` change sur une
enveloppe).

```
Salaire de Laura = 2 500€

① Garde sur toi (Plaisir perso)    650€   [fixed]
② Vire Voyage                       250€   [percent_salary: 10%]
③ Vire Besoins                      800€   [fixed]
④ Vire PEA                          400€   [percent_remaining: 50%]
⑤ Épargne perso                     400€   [remainder]
```

Types de montant manipulables à la main dans le formulaire (`ManualPaydayAmount`) :

```typescript
type ManualPaydayAmount =
  | { type: "fixed"; value: number }
  | { type: "percent_salary"; pct: number }
  | { type: "percent_remaining"; pct: number }
  | { type: "remainder" }
```

**Important** : les montants sont modifiables à la main au moment du dispatch (ponctuel, sans
changer la règle permanente, via `overrides` dans `runPayday`). Couvre les mois atypiques
(prime, etc.).

Chaque action peut aussi être rattachée à un **Compte** (`accountId`, nullable) — la destination
bancaire réelle du virement (ex: "Compte commun Fortuneo"), paramétrable par l'utilisateur depuis
Paramètres (`src/core/accounts/`). Suppression d'un compte = `on delete set null` côté DB,
l'action survit et repasse à "Aucun".

---

## Abonnements (Subscriptions)

Liste de charges récurrentes (loyer, forfaits, streaming...) avec une fréquence
(`weekly | monthly | quarterly | yearly`), normalisées en équivalent mensuel via
`monthlyCost()` (`src/core/subscriptions/monthlyCost.ts`) pour un total comparable. Chaque
abonnement est `assignedTo: 'A' | 'B' | 'both'`. Onglet dédié ("Abonnements"), indépendant du
Waterfall et du Payday Flow — pas (encore) de lien automatique entre un abonnement et une
enveloppe/action.

---

## Historique (snapshots mensuels)

`runWaterfall()` recalcule toujours depuis l'état *courant* et mutable des enveloppes — sans
action explicite, aucune trace du budget d'un mois passé ne survit à une modification
d'enveloppe. L'onglet "Historique" permet de **clôturer un mois** (bouton manuel, pas
d'automatisme) : ça fige un `BudgetSnapshot` autonome (label/emoji/montant de chaque enveloppe
AU MOMENT de la clôture, via `buildEnvelopeSnapshot()`), stocké en jsonb dans
`budget_snapshots`, jamais rejoint dynamiquement contre la table `envelopes` mutable — il reste
donc lisible même si les enveloppes d'origine sont ensuite renommées ou supprimées. Un snapshot
par couple et par mois (`unique(couple_id, period)`), re-clôturer le même mois fait un `upsert`.
**V1 du scope** : capture le Waterfall seulement (pas le Payday) — voir "Hors scope" plus bas
pour la suite envisageable.

---

## Ce qui est construit aujourd'hui

- Auth + création/rejoint de couple par code d'invitation
- Waterfall complet : enveloppes + sous-enveloppes (2 niveaux), les 4 types d'`Amount`, édition
  inline (popup €/%), réordonnancement par glisser-déposer, activer/désactiver
- Payday Flow complet : actions manuelles ou liées à une enveloppe, priorités, comptes de
  destination, override ponctuel par mois, rappel local de jour de versement
- Abonnements avec normalisation mensuelle et filtres par personne
- Comptes de destination paramétrables
- Historique : clôture manuelle mensuelle + consultation des snapshots passés
- EAS Update (OTA) pour les changements JS-only, EAS Build pour les dépendances natives

## Hors scope — Ne pas implémenter sans validation explicite

- Plus de 2 utilisateurs
- Connexion bancaire / agrégation de comptes réelle (les "Comptes" sont juste des libellés
  choisis par l'utilisateur, pas une intégration bancaire)
- Historique du Payday Flow (qui a viré quoi où, mois par mois) — volontairement exclu du scope
  actuel de l'Historique, pourrait être une itération future
- Statistiques/graphiques d'évolution (courbes, comparaisons automatiques) — l'Historique actuel
  est une simple liste consultable, pas un moteur d'analyse
- Photos de tickets, dépenses ponctuelles récurrentes automatisées
- Export PDF
- Objectifs avec suivi de progression (pots/goals) — les types `Condition` vestigiaux y font
  allusion mais rien n'est câblé

---

## Conventions de code

- **TypeScript strict** : `strict: true` dans tsconfig, pas de `any`
- **Fichiers** : PascalCase pour les composants (`WaterfallScreen.tsx`), camelCase pour le reste
  (`useStore.ts`, `engine.ts`)
- **Composants** : functional components avec hooks uniquement, pas de classes
- **Imports** : alias `@/` vers `src/` partout, y compris entre modules de `src/core/*` (ex:
  `payday` importe des types de `waterfall` via `@/core/waterfall/types`, jamais de chemin relatif
  `../../`)
- **Tests** : un fichier `.test.ts` colocalisé par module pur de `src/core/*`, Jest
- **Nommage** : identifiants en anglais dans le code, tous les libellés UI en français
- **Icônes** : `lucide-react-native` pour tout le chrome d'interface (boutons, menus, navigation)
  — jamais d'emoji d'interface. Les emojis choisis par l'utilisateur pour ses enveloppes restent
  intouchés, ce n'est pas du chrome mais du contenu.
- **Popups** : `Modal` (`transparent`, `animationType="fade"`) est le seul pattern de popup de
  l'app (édition €/%, menu ⋯ d'une ligne). Autofocus d'un `TextInput` dans une `Modal` : ni
  `autoFocus` ni l'event `onShow` ne sont fiables sur Android — utiliser un `ref` +
  `useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 200); return () =>
  clearTimeout(t); }, [visible])`.
- **Choix unique parmi plusieurs options** : `Chip`/`ChipRow` (`src/components/ui/Chip.tsx`) est
  le seul pattern de l'app pour ça — pas de Picker/Dropdown, la liste reste toujours courte à
  l'échelle de 2 personnes.
- **Listes** : `ScrollView` + `.map()` partout (jamais `FlatList`) — les listes de ce projet
  restent petites (enveloppes, actions, abonnements, comptes, mois d'historique).
- **CRUD dans le store** : chaque domaine suit le même moule — `load*()` sélectionne filtré par
  `couple_id`, mappe snake_case→camelCase ; `create*`/`update*`/`delete*` mutent puis rappellent
  `load*()` (pas de mise à jour optimiste/partielle). Voir `accounts`/`subscriptions` dans
  `useStore.ts` comme référence la plus simple à copier pour un nouveau domaine.

---

## Supabase — Notes importantes

- Le client Supabase est instancié une seule fois dans `src/lib/supabase.ts`, sans générique
  `Database` (pas de fichier de types générés) — les colonnes `jsonb` se castent directement en
  `as Type` côté store, pas besoin de `as unknown as`.
- **Un seul fichier `supabase/migration.sql`**, historique complet et append-only (sections
  banner-commentées `-- === V2 — ... ===`), pas de fichiers de migration séparés/horodatés.
- RLS activé sur toutes les tables couple-scoped, avec systématiquement les 4 mêmes policies
  (`select/insert/update/delete couple X`, `using/with check (couple_id = auth_couple_id())`)
  puis `grant select, insert, update, delete on X to authenticated` — n'importe quel membre du
  couple gère toutes les lignes de son couple, pas de restriction par utilisateur individuel.
  `auth_couple_id()` est le helper `security definer` qui centralise ça.
- Modifier une donnée qui appartient au/à la **partenaire** (revenu, prénom, jour de versement)
  ne passe jamais par un simple `.update()` — la policy "update own profile" n'autorise que
  `id = auth.uid()`. Ça passe par un RPC dédié `security definer`
  (`update_partner_income`/`update_partner_display_name`/`update_partner_payday_day`).
- Suppression d'une ligne référencée ailleurs : choisir `on delete set null` (l'entité qui
  pointait dessus perd juste l'attribut, ex: `payday_actions.account_id`) vs `on delete cascade`
  (l'entité fille n'a aucun sens sans son parent, ex: `envelopes.parent_id`) selon le cas — jamais
  laisser le `restrict` par défaut de Postgres bloquer une suppression avec une erreur non gérée.
- **Aucun accès direct à la base depuis cet environnement de dev** — toute migration/RPC doit être
  remise à l'utilisateur sous forme de bloc SQL copiable, à coller lui-même dans l'éditeur SQL
  Supabase, jamais exécutée automatiquement ici.
- Le plan Free se met en pause après 1 semaine d'inactivité (~10s de réveil) → prévoir un ping
  automatique en production.

---

## Environnement de dev — particularités connues

- `npx tsc --noEmit` plante avec un stack overflow sur cette machine (reproductible même sur
  d'anciens commits qui passaient — souci d'environnement, pas une vraie régression). Utiliser à
  la place : `node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit`.
- Pas d'automatisation navigateur/appareil disponible ici — la vérification "visuelle/fonctionnelle"
  réelle sur l'app reste toujours à la charge de l'utilisateur, à signaler explicitement plutôt que
  supposée faite.
- Fonctionnalité conséquente ("gros morceau") → développer sur une branche dédiée
  (`git checkout -b feature/...`), jamais directement sur `main`.
- Ne jamais commit/push sans demande explicite de l'utilisateur à ce moment précis (une
  autorisation donnée une fois ne vaut pas pour la suite). `.mcp.json` et `.env` restent toujours
  hors du dépôt.

---

## Ce que le développeur apporte

- Background Java/Kotlin — TypeScript est immédiatement lisible
- Développeur back-end — l'isolation des modules `src/core/*` en TypeScript pur est naturelle
- Expérience React Native acquise en cours de route sur ce projet — patterns déjà établis
  (ci-dessus) à privilégier plutôt qu'en introduire de nouveaux sans raison
