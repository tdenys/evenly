import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** Remplace un TextInput numérique brut pour des plages de petite taille (priorité, jour de
 * versement 1-31) — plus rapide à ajuster à une main sur mobile qu'un clavier numérique. */
export default function Stepper({ value, onChange, min = 1, max = 99 }: Props) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        hitSlop={4}
      >
        <Text style={[styles.btnLabel, !canDecrement && styles.disabled]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        hitSlop={4}
      >
        <Text style={[styles.btnLabel, !canIncrement && styles.disabled]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  btn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { fontFamily: fonts.karlaBold, fontSize: 16, color: ink(0.5) },
  disabled: { opacity: 0.35 },
  value: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: fonts.karlaBold,
    fontSize: 14.5,
    color: colors.ink,
  },
});
