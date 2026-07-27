// Palette "Ardoise + Bleu" — importée depuis le projet Claude Design (App Redesign.dc.html) :
// fond blanc, remplissages gris clair, encre ardoise, un unique accent bleu utilisé partout
// (boutons, tab active, chips sélectionnées, carte calendrier) — plus de duo de couleurs par
// personne ni de dégradé, contrairement à l'ancienne palette "Duo bicolore".

export const colors = {
  bg: '#FFFFFF', // Fond app
  surface: '#FFFFFF', // Fond carte/élevé (écrans, inputs remplis)
  section: '#F5F6F8', // Fond section (regroupements de champs de formulaire, cartes de résumé)
  borderSubtle: '#F2F3F6', // Séparateurs de lignes (hairline), plus clair que borderInput
  borderInput: '#ECEFF3', // Bordure des cartes/champs de saisie/pastilles non sélectionnées
  ink: '#0F172A', // Texte principal
  primary: '#3559E9', // Accent unique : boutons pleins, tab active, switch "on", liens
  primaryTint: '#EAF0FE', // Tinte de l'accent : badges emoji, fond de carte "hero"
  secondary: '#475569', // Texte secondaire
  tertiary: '#94A3B8', // Texte tertiaire, icônes de tab inactives
  disabled: '#CBD5E1', // Icônes/éléments désactivés très clairs
  danger: '#EF4444', // Dépassements, bouton Supprimer
  warning: '#F59E0B', // Montants non alloués
} as const;

/** Encre à une opacité donnée (0-1) — pour les opacités ponctuelles qui ne correspondent à
 * aucun token flat (secondary/tertiary/disabled couvrent les rôles de texte les plus courants). */
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
