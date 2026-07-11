// Polices : Spectral (montants, affichage) + Karla (texte courant) — noms exacts exposés par
// @expo-google-fonts/spectral et @expo-google-fonts/karla, chargés dans App.tsx.

export const fonts = {
  spectralMedium: 'Spectral_500Medium',
  spectralSemiBold: 'Spectral_600SemiBold',
  spectralBold: 'Spectral_700Bold',
  karlaRegular: 'Karla_400Regular',
  karlaMedium: 'Karla_500Medium',
  karlaSemiBold: 'Karla_600SemiBold',
  karlaBold: 'Karla_700Bold',
  karlaExtraBold: 'Karla_800ExtraBold',
} as const;

/** Tailles/poids par rôle, tels que définis dans le handoff design. */
export const type = {
  amountHero: { fontFamily: fonts.spectralSemiBold, fontSize: 32, lineHeight: 36 },
  amountSecondary: { fontFamily: fonts.spectralSemiBold, fontSize: 26, lineHeight: 30 },
  amountRow: { fontFamily: fonts.spectralSemiBold, fontSize: 15 },
  headerTitle: { fontFamily: fonts.karlaBold, fontSize: 16.5 },
  buttonLabel: { fontFamily: fonts.karlaBold, fontSize: 14.5 },
  fieldLabel: { fontFamily: fonts.karlaSemiBold, fontSize: 12 },
  rowTitle: { fontFamily: fonts.karlaBold, fontSize: 14 },
  rowSubtitle: { fontFamily: fonts.karlaMedium, fontSize: 11.5 },
  sectionLabel: {
    fontFamily: fonts.karlaBold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  chip: { fontFamily: fonts.karlaSemiBold, fontSize: 12 },
  tabLabel: { fontFamily: fonts.karlaBold, fontSize: 10 },
} as const;
