import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  label: string;
  children: ReactNode;
}

/** Regroupement de champs de formulaire — chaque formulaire (Enveloppe, Action, Abonnement)
 * est découpé en 2-3 SectionCard plutôt qu'une liste de champs à plat, pour la lisibilité. */
export default function SectionCard({ label, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: colors.section,
    borderWidth: 1,
    borderColor: colors.borderInput,
    padding: 14,
    gap: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ink(0.42),
  },
});
