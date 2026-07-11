import { Platform, StyleSheet, Switch, View } from 'react-native';
import { colors } from '@/theme/colors';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** Wrapper autour du Switch natif plutôt qu'un composant réécrit en Pressable+Animated — cette
 * session a déjà eu un vrai bug de propagation d'événement web avec des gestes custom
 * (résolu avec un stopPropagation ciblé sur EnvelopeTreeRow.tsx) ; réinventer le composant
 * réaugmenterait ce risque pour un gain de fidélité marginal. `scale` + marge négative
 * rapprochent le gabarit visuel du design (34×20) sans changer le comportement natif éprouvé. */
export default function AppSwitch({ value, onValueChange }: Props) {
  return (
    <View
      style={styles.wrap}
      // Sur web, le clic sur le Switch (un <input> natif) bubble en DOM jusqu'au
      // TouchableOpacity parent d'une ligne tappable — coupe la propagation pour ne pas
      // déclencher l'action de la ligne en plus de basculer le switch.
      {...(Platform.OS === 'web' ? { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() } : null)}
    >
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderInput, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.borderInput}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  switch: { transform: [{ scale: 0.8 }] },
});
