import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function Chip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      <Text style={selected ? styles.selectedLabel : styles.unselectedLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 20, paddingVertical: 9, paddingHorizontal: 15 },
  selected: { backgroundColor: colors.primary },
  unselected: { borderWidth: 1.5, borderColor: colors.borderInput },
  selectedLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: '#fff' },
  unselectedLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: ink(0.65) },
});

// Réexporté pour les listes de chips en ligne (fréquence, type de montant...).
export const ChipRow = ({ children }: { children: ReactNode }) => (
  <View style={rowStyles.row}>{children}</View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
