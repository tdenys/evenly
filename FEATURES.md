# Budget Couple — Fonctionnalités (état actuel)

Document de référence exhaustif de ce que l'application fait aujourd'hui, écrit pour servir de
base à une refonte design/UI. Il décrit le comportement fonctionnel écran par écran, le modèle
de données, et les choix visuels actuels (qui sont fonctionnels mais **non designés** — c'est
tout l'enjeu de la collaboration à venir).

Contexte produit : application mobile (React Native + Expo) strictement pour **2 utilisateurs**
(un couple), pas une app commerciale multi-tenant. Objectif déclaré : "On ne se pose plus la
question de l'équité" dans la gestion financière du couple.

---

## 1. Arborescence de navigation

```
Non connecté
├── Connexion (Login)
└── Créer un compte (SignUp)

Connecté, sans couple
└── Créer ou rejoindre un couple (CreateOrJoinCouple)

Connecté, couple créé mais partenaire pas encore arrivé
└── En attente du/de la partenaire (WaitingForPartner)

Connecté, couple complet (2 personnes) — écran d'accueil : Budget
├── Budget (Waterfall) — écran d'accueil
│   ├── → Enveloppe (créer/éditer)
│   ├── → Revenus (Income)
│   ├── → Répartition (Payday)
│   │   └── → Action (créer/éditer une action de dispatch)
│   └── → Abonnements (Subscriptions)
│       └── → Abonnement (créer/éditer)
```

Tout l'écran "Main" est une pile React Navigation (native-stack) : chaque écran affiche un
header avec titre + flèche retour, sauf Login/SignUp (pas de header).

Ancien MVP (dépenses partagées 50/50, solde "tu dois X€", bouton Solder, écran Dashboard,
écran "Ajouter une dépense") : **entièrement supprimé**. Budget (ex-Waterfall) est désormais le
tout premier écran après connexion.

---

## 2. Authentification & onboarding

### Connexion (Login)
- Champs : Email, Mot de passe.
- Lien vers l'inscription : "Pas encore de compte ? S'inscrire".

### Inscription (SignUp)
- Champs : "Ton prénom", Email, Mot de passe.
- À l'inscription, un déclencheur base de données crée automatiquement la ligne `profiles`
  (pas de couple associé au départ).

### Créer ou rejoindre un couple (CreateOrJoinCouple)
- Deux options : "Créer un couple" (génère un code d'invitation à 6 caractères,
  alphabet restreint sans caractères ambigus) ou saisir un "Code d'invitation" reçu du/de la
  partenaire pour rejoindre.

### En attente du/de la partenaire (WaitingForPartner)
- Affiche le code d'invitation à partager, poll régulièrement pour détecter l'arrivée du/de la
  partenaire (pas besoin de recharger la page).

---

## 3. Budget — écran d'accueil (Waterfall)

Concept central : l'argent "coule" depuis le revenu total du couple vers des enveloppes, qui
peuvent elles-mêmes se subdiviser en sous-enveloppes à volonté (récursif, profondeur illimitée).

### Carte de résumé (haut d'écran)
- "Revenu total du couple" + montant (somme des revenus nets déclarés des 2 personnes).
- Ligne d'alerte sous le montant si pertinent :
  - ⚠️ rouge "`X€ (Y%) demandés en trop`" si la somme des enveloppes dépasse le revenu.
  - Orange "`X€ (Y%) non alloué`" s'il reste du revenu non affecté.
  - Rien si tout est alloué exactement.

### Liste des enveloppes (arbre récursif)
Chaque ligne d'enveloppe affiche, sur 2 lignes de texte :
- **Ligne 1** : chevron (▸ replié / ▾ déplié) + emoji + libellé + montant en € (aligné à
  droite).
- **Ligne 2** : description de l'allocation (ex: "50% du revenu", "300.00 € fixe", "Prorata
  revenus (Alice)") + éventuel suffixe " · 💸 {qui finance}" si liée au Payday Flow + éventuel
  suffixe " · Désactivée" + pourcentage par rapport au parent, aligné à droite (juste sous le
  montant en €, même colonne).
- Un **switch** (interrupteur) actif/inactif à droite du montant — désactive l'enveloppe (vaut
  0€, ne consomme rien du pool, profite à la sœur suivante par priorité) sans la supprimer. Cas
  d'usage typique : un "matelas de sécurité" qu'on arrête d'alimenter une fois plein.
- Une icône ✏️ pour éditer.
- Une **poignée de glisser-déposer** (icône ⠿, zone dédiée de 48px de large à l'extrême droite)
  pour réordonner les enveloppes sœurs par glisser — implémentation main (PanResponder), pas de
  librairie tierce.
- Tap sur la ligne (hors poignée/switch/crayon) : déplie/replie les sous-enveloppes.
- Une fois dépliée : ses sous-enveloppes s'affichent indentées (20px par niveau de profondeur),
  suivies d'un bouton "+ Ajouter une sous-enveloppe" et, si pertinent, d'une ligne de résumé
  ("X€ restant" / "⚠️ X€ demandés en trop") sur le budget de CETTE enveloppe (pas le revenu
  total).
- Les lignes s'étendent sur toute la largeur de l'écran (pas de marge droite/gauche).

### Formulaire Enveloppe (créer/éditer)
Champs, dans l'ordre :
1. **Emoji** (champ texte court, max 2 caractères).
2. **Libellé** (texte).
3. **Priorité** (nombre entier — "1 = remplie en premier"), pré-rempli au numéro suivant
   disponible parmi les enveloppes sœurs.
4. **Enveloppe active** (switch, défaut : activée).
5. **Allocation** :
   - Indice "Reste disponible ici : X€ (Y%)" (calculé en excluant les autres enveloppes sœurs).
   - Bouton "Combler avec le reste" (raccourci : bascule le type sur "% du reste" à 100% ET pousse
     la priorité à la toute dernière position, puisqu'un "100% du reste" n'a de sens qu'en
     dernier).
   - 4 types sélectionnables via chips : **Montant fixe** (valeur en €), **% du revenu** (% de
     la capacité initiale du pool à ce niveau), **% du reste** (% de ce qu'il reste au moment de
     l'évaluation), **Prorata revenus** (part proportionnelle au revenu d'une personne A ou B
     précise — chips avec les vrais prénoms).
6. **Financée par** (lien vers le Payday Flow) : chips "Aucun / {prénom A} / {prénom B} /
   Les deux". Si non-"Aucun", une action correspondante apparaît automatiquement dans
   Répartition (voir section 5) — référence vivante, jamais une copie figée du montant.
7. Bouton **Enregistrer**.
8. Si édition d'une enveloppe existante : bouton **Supprimer l'enveloppe** (avec confirmation).

### Boutons de navigation (bas de l'écran Budget)
- **+ Ajouter une enveloppe** (bouton plein, bleu).
- **💶 Revenus** (bouton contour bleu).
- **🔀 Répartition** (bouton contour bleu).
- **📱 Abonnements** (bouton contour bleu).

---

## 4. Revenus (Income)

- Deux blocs identiques, l'un pour "Mon revenu net", l'autre pour "Revenu de {prénom
  partenaire}" — **les deux sont éditables depuis n'importe quel compte** (pas seulement le
  sien).
- Chaque bloc : champ numérique + bouton "Enregistrer" dédié.
- La modification du revenu du/de la partenaire passe par une fonction serveur dédiée
  (`update_partner_income`) car les policies de sécurité (RLS) n'autorisent par défaut que la
  modification de sa propre ligne.

---

## 5. Répartition — Payday Flow (dispatch de salaire)

Concept : à chaque salaire, générer un plan d'action ordonné et personnalisé indiquant quoi
faire avec l'argent (garder X€, virer Y€ vers telle enveloppe...).

### Sélecteur de personne
- 2 onglets : "Mon salaire" / "Salaire de {prénom partenaire}".

### Rappel de versement (uniquement sur mobile natif, absent sur web)
- Champ "Jour de versement (1-31)" — éditable pour **n'importe qui**, sur les deux onglets (je
  peux renseigner le jour de mon/ma partenaire).
- Bouton **Enregistrer** : programme une notification locale mensuelle récurrente (rappel
  générique "C'est le jour de versement — va voir ta répartition", pas de montants dedans car
  pas connus à l'avance). Si je modifie le jour de mon/ma partenaire depuis mon téléphone, la
  notification ne se programme réellement que lorsque cette personne rouvre l'app sur SON
  propre appareil (limite technique : une notification locale ne peut se programmer que sur
  l'appareil concerné).
- Bouton **🔔 Tester** (uniquement visible sur mon propre onglet) : déclenche immédiatement une
  notification de test, pour vérifier que ça marche sans attendre le jour programmé.
- Tap sur la notification → ouvre l'app directement sur l'écran Répartition.

### Montant du salaire
- Champ numérique, pré-rempli avec le revenu net déclaré de la personne affichée, mais
  **modifiable ponctuellement** sans toucher au revenu permanent (couvre les mois avec prime,
  etc.).

### Ligne de résumé
- ⚠️ rouge "X€ demandés en trop" si le total dépasse le salaire, orange "X€ non alloué" sinon.

### Liste des actions (triées par priorité)
Chaque ligne :
- Libellé + description auto-générée du type de montant (ex: "10% du salaire", "Le reste",
  "Suit l'enveloppe 🏠 Besoins") + **description libre** optionnelle (note personnelle,
  italique, sur une 3ᵉ ligne si renseignée).
- Montant : **champ éditable** pour une action manuelle (l'ajustement est ponctuel, non
  persisté — revient à sa valeur normale si on quitte et revient sur l'écran) ; **texte en
  lecture seule** pour une action liée à une enveloppe (le montant est toujours recalculé
  depuis Budget, jamais modifiable ici directement).
- Icône ✏️ vers le formulaire d'action.

4 types de montant pour une action manuelle : **Montant fixe**, **% du salaire** (calculé sur
le salaire total, constant), **% du reste** (recalculé à chaque étape), **Le reste** (absorbe
tout ce qui reste — typiquement la dernière action). Un 5ᵉ type interne "lié à une enveloppe"
existe mais n'est jamais choisi à la main : il apparaît automatiquement via "Financée par" côté
Budget.

### Formulaire Action (créer/éditer)
1. **Salaire concerné** : chips "Moi" / prénom partenaire.
2. **Libellé** (texte).
3. **Description** (texte libre, multiligne, optionnel).
4. **Priorité** (nombre entier).
5. **Montant** : soit l'éditeur à 4 types (comme ci-dessus), soit — si l'action est liée à une
   enveloppe — un texte "Suit l'enveloppe {emoji} {libellé} — modifiable depuis l'écran Budget"
   à la place, sans éditeur de montant.
6. Bouton Enregistrer.
7. Si édition : bouton Supprimer (masqué et remplacé par un texte explicatif si l'action est
   liée à une enveloppe — la suppression se fait alors depuis Budget en repassant "Financée
   par" à "Aucun").

---

## 6. Abonnements (Subscriptions)

Registre autonome (pas connecté à Budget/Répartition) des abonnements récurrents du couple.

### Filtres (4 onglets, disposés en grille 2x2)
- **Tous** : aucune restriction.
- **Commun** : uniquement les abonnements assignés aux deux personnes.
- **Moi** : uniquement MES abonnements individuels (exclut "Commun").
- **{prénom partenaire}** : uniquement les abonnements individuels du/de la partenaire (exclut
  "Commun"). Cas d'usage cité : voir les abonnements personnels d'quelqu'un sur son "budget
  plaisir".

### Carte de résumé
- "Coût mensuel total" — somme des coûts mensuels équivalents de la liste **filtrée** affichée
  (se recalcule selon l'onglet actif).

### Liste des abonnements filtrés
Chaque ligne : titre, puis en dessous "{catégorie} · {coût d'origine}/{fréquence}" (ex:
"Streaming · 60.00 €/an"), puis à droite le **coût mensuel équivalent** (toujours normalisé en
€/mois peu importe la fréquence réelle), puis icône ✏️.

Conversion en coût mensuel : mensuel inchangé, annuel ÷12, trimestriel ÷3, hebdomadaire
×(52/12) — pas ×4, pour ne pas sous-estimer (52/12 est la moyenne exacte de semaines par mois).

### Formulaire Abonnement (créer/éditer)
1. **Titre** (texte).
2. **Coût** (numérique, dans l'unité de sa propre fréquence).
3. **Fréquence** : chips Hebdomadaire / Mensuel / Trimestriel / Annuel.
4. Indice live "≈ X€ / mois" sous Coût/Fréquence (recalculé à la volée).
5. **Catégorie** (texte libre, ex: "Streaming", "Sport" — pas de liste prédéfinie).
6. **Assigné à** : chips {prénom A} / {prénom B} / Les deux.
7. Bouton Enregistrer, bouton Supprimer si édition.

---

## 7. Modèle de données (concepts clés)

### Enveloppe (`Envelope`)
```
id, label, emoji, priority, allocation (Amount), enabled (bool),
fundedBy ('A' | 'B' | 'both' | null), children (Envelope[], récursif)
```
`Amount` = `fixed(value)` | `percent_envelope(pct)` | `percent_remaining(pct)` |
`prorata_income(who: A|B)`.

### Action de dispatch (`PaydayAction`)
```
id, label, description, priority, amount (PaydayAmount)
```
`PaydayAmount` = `fixed(value)` | `percent_salary(pct)` | `percent_remaining(pct)` |
`remainder` | `envelope(envelopeId)` (référence vivante, jamais choisie à la main).

### Abonnement (`Subscription`)
```
id, title, cost, frequency (weekly|monthly|quarterly|yearly), category, assignedTo (A|B|both)
```

### Profil (`Profile`)
```
id, displayName, coupleId, netIncome, paydayDay (1-31 | null)
```

### Identité stable A/B
Les personnes d'un couple sont ordonnées de façon stable (tri par id de profil, PAS
"moi"/"partenaire") — `who: 'A'` désigne toujours la même personne peu importe qui consulte
l'app. Les libellés affichés utilisent toujours les vrais prénoms, jamais "A"/"B" à l'écran.

---

## 8. Palette de couleurs actuellement utilisée (non designée — points de départ bruts)

| Couleur | Hex | Usage actuel |
|---|---|---|
| Bleu primaire | `#2563eb` | Boutons principaux, bordures de boutons secondaires, chips sélectionnées, onglets actifs, liens |
| Blanc | `#fff` | Texte sur fond bleu, fonds de carte |
| Gris bordure | `#ccc` | Bordures de champs de saisie |
| Gris texte label | `#555` | Labels de champs, texte secondaire |
| Gris texte tertiaire | `#999` | Chevrons, texte désactivé, placeholders |
| Rouge danger | `#dc2626` | Erreurs, dépassements de budget, boutons "Supprimer" |
| Orange avertissement | `#b45309` | Montants "restants"/"non alloués" (pas une erreur, juste une info) |
| Gris texte quaternaire | `#333` | Texte de chip non sélectionnée |
| Gris description | `#888` | Descriptions auto-générées sous les libellés |
| Fond carte résumé | `#eef2ff` | Cartes "Revenu total"/"Coût mensuel total" |
| Gris bordure claire | `#ddd` | Séparateurs de lignes de liste |

### Patterns de composants récurrents
- **Chips** : boutons pilule (`borderRadius: 20`), bordure grise non sélectionnée, fond bleu
  plein + texte blanc sélectionnée. Utilisées pour tous les choix à options multiples
  (fréquence, type de montant, assignation A/B/both, financée par...).
- **Cartes de résumé** : fond `#eef2ff`, coins arrondis (`borderRadius: 12`), centrées, montant
  en gros (`24px`, `800`).
- **Onglets** : boutons contour bleu pleine largeur (`flex:1`), fond bleu plein quand actif.
- **Lignes de liste** : titre en gras à gauche, montant aligné à droite, séparateur fin
  (`hairlineWidth`) en bas, icône ✏️ à l'extrême droite.
- **Formulaires** : toujours dans un `ScrollView` (bug vécu : un formulaire sans ScrollView peut
  rendre le bouton Enregistrer inatteignable sur petit écran), label en gras gris au-dessus de
  chaque champ, bouton Enregistrer plein bleu en bas, bouton Supprimer textuel rouge en dessous.
- **Icônes** : exclusivement des emojis (pas de librairie d'icônes) — 📊 budget, 💶 revenus,
  🔀 répartition, 📱 abonnements, 🔔 notification, ✏️ éditer, ⠿ glisser, ▸/▾ chevrons,
  ⚠️ avertissement, 💸 financement.
- Aucune gestion de mode sombre actuellement.

---

## 9. Explicitement hors scope aujourd'hui

- Suivi de dépenses partagées / solde / "Solder" (existait en V1, entièrement retiré).
- Connexion bancaire ou agrégation de comptes.
- Lien entre Abonnements et Budget/Répartition (registre volontairement indépendant).
- Notifications par SMS ou push serveur (uniquement notifications locales sur l'appareil).
- Mode sombre / thèmes.
- Plus de 2 utilisateurs par couple.
- Catégories prédéfinies pour les abonnements (texte libre uniquement).
- Objectifs financiers avec suivi de progression, statistiques, graphiques, export PDF.
