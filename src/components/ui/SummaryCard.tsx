import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, ink, personGradient, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Alert {
  text: string;
  variant: 'warning' | 'danger';
}

interface Props {
  label: string;
  amount: string;
  alert?: Alert | null;
  /** hero = dégradé Accent A/B à 12% (carte "Revenu total du couple"), secondary = fond neutre
   * (les autres totaux, ex. "Coût mensuel total" des Abonnements). */
  variant?: 'hero' | 'secondary';
}

export default function SummaryCard({ label, amount, alert, variant = 'secondary' }: Props) {
  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{amount}</Text>
      {alert && (
        <Text style={[styles.alert, { color: alert.variant === 'danger' ? colors.danger : colors.warning }]}>
          {alert.text}
        </Text>
      )}
    </>
  );

  if (variant === 'hero') {
    return (
      <LinearGradient
        colors={[withOpacity(personGradient[0], 0.12), withOpacity(personGradient[1], 0.12)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {content}
      </LinearGradient>
    );
  }

  return <View style={[styles.card, { backgroundColor: colors.section }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, alignItems: 'center', gap: 2 },
  label: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: ink(0.6) },
  amount: { fontFamily: fonts.spectralSemiBold, fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 2 },
  alert: { fontFamily: fonts.karlaBold, fontSize: 12, marginTop: 6 },
});
