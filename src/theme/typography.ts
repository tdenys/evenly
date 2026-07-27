// Police unique : Inter, toutes graisses, y compris les montants — noms exacts exposés par
// @expo-google-fonts/inter, chargés dans App.tsx.

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

/** Tailles/poids par rôle, tels que définis dans le handoff design. */
export const type = {
  amountHero: { fontFamily: fonts.semiBold, fontSize: 32, lineHeight: 36 },
  amountSecondary: { fontFamily: fonts.semiBold, fontSize: 26, lineHeight: 30 },
  amountRow: { fontFamily: fonts.semiBold, fontSize: 15 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16.5 },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 14.5 },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 12 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14 },
  rowSubtitle: { fontFamily: fonts.medium, fontSize: 11.5 },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  chip: { fontFamily: fonts.semiBold, fontSize: 12 },
  tabLabel: { fontFamily: fonts.bold, fontSize: 10 },
} as const;
