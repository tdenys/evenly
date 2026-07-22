import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, TriangleAlert } from 'lucide-react-native';
import { colors, ink, personGradient, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Alert {
  text: string;
  variant: 'warning' | 'danger';
}

interface BreakdownItem {
  label: string;
  amount: string;
  pct: string;
}

interface Props {
  label: string;
  amount: string;
  /** Lignes de détail affichées au-dessus du total, en plus petit (ex: le salaire de chaque
   * personne et sa part du revenu total du couple — utile pour comprendre d'où viennent les
   * montants "prorata revenus"). */
  breakdown?: BreakdownItem[];
  alert?: Alert | null;
  /** hero = dégradé Accent A/B à 12% (carte "Revenu total du couple"), secondary = fond neutre
   * (les autres totaux, ex. "Coût mensuel total" des Abonnements). */
  variant?: 'hero' | 'secondary';
  /** Rend la carte tappable (ex: "Revenu total du couple" ouvre l'édition des revenus). Affiche
   * aussi un petit crayon en haut à droite pour signaler que la carte est éditable. */
  onPress?: () => void;
}

export default function SummaryCard({ label, amount, breakdown, alert, variant = 'secondary', onPress }: Props) {
  const content = (
    <>
      {breakdown && breakdown.length > 0 && (
        <View style={styles.breakdown}>
          {breakdown.map((item, i) => (
            <Text key={i} style={styles.breakdownText}>
              {item.label} : {item.amount} ({item.pct})
            </Text>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount}>{amount}</Text>
      </View>
      {alert && (
        <View style={styles.alertRow}>
          <TriangleAlert size={12} color={alert.variant === 'danger' ? colors.danger : colors.warning} />
          <Text style={[styles.alert, { color: alert.variant === 'danger' ? colors.danger : colors.warning }]}>
            {alert.text}
          </Text>
        </View>
      )}
      {onPress && (
        <View style={styles.editHint} pointerEvents="none">
          <Pencil size={12} color={ink(0.35)} />
        </View>
      )}
    </>
  );

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.8 } : {};

  if (variant === 'hero') {
    return (
      <Wrapper {...wrapperProps}>
        <LinearGradient
          colors={[withOpacity(personGradient[0], 0.12), withOpacity(personGradient[1], 0.12)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {content}
        </LinearGradient>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps} style={[styles.card, { backgroundColor: colors.section }]}>
      {content}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  // Ligne label/montant plutôt qu'un empilement centré (libellé, gros montant, alerte) — prend
  // beaucoup moins de hauteur, laisse plus de place à la liste d'enveloppes qui est le vrai
  // contenu principal de l'écran.
  card: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  breakdown: { gap: 1, marginBottom: 2 },
  breakdownText: { fontFamily: fonts.karlaMedium, fontSize: 10.5, color: ink(0.5) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: ink(0.6) },
  amount: { fontFamily: fonts.spectralSemiBold, fontSize: 22, color: colors.ink },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  alert: { fontFamily: fonts.karlaBold, fontSize: 11.5 },
  editHint: { position: 'absolute', top: 10, right: 12 },
});
