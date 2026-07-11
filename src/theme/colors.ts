// Palette "Duo bicolore" — convertie précisément depuis les tokens oklch du design system
// (calcul OKLab→sRGB, pas une estimation à l'oeil — voir le handoff design pour les valeurs
// oklch d'origine).

export const colors = {
  bg: '#F6F3EF', // Fond app
  surface: '#FDFBF9', // Fond carte/élevé (écrans, inputs remplis)
  section: '#F6F4F1', // Fond section (regroupements de champs de formulaire)
  borderSubtle: '#E3E1DD', // Séparateurs de lignes, bordures de header/tabbar
  borderInput: '#DAD7D2', // Bordure des champs de saisie, chips non sélectionnées
  ink: '#27241F', // Texte principal
  primary: '#4D473C', // Boutons pleins neutres, tab active, switch "on"
  accentA: '#A55795', // Personne A (stable, pas "moi")
  accentB: '#008F64', // Personne B (stable, pas "partenaire")
  danger: '#C92F33', // Dépassements, bouton Supprimer
  warning: '#CF6F19', // Montants non alloués
} as const;

/** Encre à une opacité donnée (0-1) — l'ancre de la hiérarchie de texte secondaire/tertiaire. */
export function ink(alpha: number): string {
  return withOpacity(colors.ink, alpha);
}

/** Convertit un hex #RRGGBB en rgba(...) avec l'opacité donnée (0-1). */
export function withOpacity(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dégradé 135° Accent A → Accent B, pour les éléments "Les deux" (expo-linear-gradient). */
export const personGradient: [string, string] = [colors.accentA, colors.accentB];
