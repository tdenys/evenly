import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, ink, personGradient } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Rend un dégradé Accent A→B en fond quand sélectionnée — pour "Les deux". */
  gradient?: boolean;
}

export default function Chip({ label, selected, onPress, gradient = false }: Props) {
  if (selected && gradient) {
    return (
      <TouchableOpacity onPress={onPress}>
        <LinearGradient
          colors={personGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}
        >
          <Text style={styles.selectedLabel}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

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
  selectedLabel: { fontFamily: fonts.karlaSemiBold, fontSize: 12, color: '#fff' },
  unselectedLabel: { fontFamily: fonts.karlaSemiBold, fontSize: 12, color: ink(0.65) },
});

// Réexporté pour les listes de chips en ligne (fréquence, type de montant...).
export const ChipRow = ({ children }: { children: ReactNode }) => (
  <View style={rowStyles.row}>{children}</View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
