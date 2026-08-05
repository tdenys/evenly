import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native';
import type { RootEnvelopeTrendSeries } from '@/core/history/rootEnvelopeTrend';
import { formatPeriodShort } from '@/lib/format';
import { chartSeries, colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  series: RootEnvelopeTrendSeries[];
}

/** Graphique d'évolution des enveloppes de premier niveau (Historique) — une ligne par
 * enveloppe racine, sur les mois clôturés les plus récents (voir buildRootEnvelopeTrend).
 * Rien à afficher tant qu'aucune série n'a au moins 2 points (une ligne à 1 point est juste un
 * point isolé, pas une évolution lisible). */
export default function RootEnvelopeTrendChart({ series }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 32;

  if (!series.some((s) => s.points.length >= 2)) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Évolution des enveloppes</Text>
      <VictoryChart
        width={chartWidth}
        height={200}
        domainPadding={{ x: 24, y: 16 }}
        padding={{ top: 8, bottom: 32, left: 44, right: 16 }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: colors.borderInput },
            tickLabels: { fontFamily: fonts.medium, fontSize: 10, fill: colors.secondary },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(amount: number) => `${Math.round(amount)}€`}
          style={{
            axis: { stroke: 'transparent' },
            grid: { stroke: colors.borderSubtle },
            tickLabels: { fontFamily: fonts.medium, fontSize: 10, fill: colors.secondary },
          }}
        />
        {series.map((s, i) => (
          <VictoryLine
            key={s.label}
            data={s.points.map((p) => ({ x: formatPeriodShort(p.period), y: p.amount }))}
            interpolation="monotoneX"
            style={{ data: { stroke: chartSeries[i % chartSeries.length], strokeWidth: 2.5 } }}
          />
        ))}
      </VictoryChart>
      <View style={styles.legendRow}>
        {series.map((s, i) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: chartSeries[i % chartSeries.length] }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {s.emoji} {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '48%' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.secondary, flexShrink: 1 },
});
