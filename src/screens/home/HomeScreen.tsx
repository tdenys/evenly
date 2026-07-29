import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Target } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { findEnvelopesWithGoal } from '@/core/waterfall/tree';
import { isGoalReached } from '@/core/waterfall/engine';
import type { Envelope } from '@/core/waterfall/types';
import { currentPeriod, formatAmount, formatPct } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import ProgressRing from '@/components/ui/ProgressRing';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Objectif (racine ou sous-enveloppe) le plus proche d'être atteint parmi ceux pas encore
 * atteints — `null` si aucun objectif actif n'existe. "Le plus proche" = celui dont il reste le
 * moins de pourcentage à parcourir, pas le montant restant le plus faible en valeur absolue. */
function closestGoal(envelopes: Envelope[]): Envelope | null {
  const candidates = findEnvelopesWithGoal(envelopes).filter((e) => !isGoalReached(e));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, e) =>
    (e.goal!.current / e.goal!.target) > (best.goal!.current / best.goal!.target) ? e : best
  );
}

export default function HomeScreen({ navigation }: Props) {
  const envelopes = useStore((s) => s.envelopes);
  const paydayActions = useStore((s) => s.paydayActions);
  const paydayChecks = useStore((s) => s.paydayChecks);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const loadPaydayActions = useStore((s) => s.loadPaydayActions);
  const loadPaydayChecks = useStore((s) => s.loadPaydayChecks);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);

  // Toujours le vrai mois calendaire courant, jamais un mois navigué sur Budget (même principe
  // que Répartition/Abonnements/Historique — voir CLAUDE.md).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(currentPeriod()), loadPaydayActions(), loadPaydayChecks(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, loadPaydayActions, loadPaydayChecks, refresh])
  );

  const actionIds = useMemo(() => new Set(paydayActions.map((a) => a.id)), [paydayActions]);
  const doneCount = useMemo(
    () => paydayChecks.filter((c) => actionIds.has(c.actionId)).length,
    [paydayChecks, actionIds]
  );
  const totalActions = paydayActions.length;

  const rootGoals = useMemo(() => envelopes.filter((e) => e.goal !== null), [envelopes]);
  const banner = useMemo(() => closestGoal(envelopes), [envelopes]);

  const nothingToShow = !loading && totalActions === 0 && rootGoals.length === 0 && !banner;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {totalActions > 0 && (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Payday')} activeOpacity={0.8}>
          <ProgressRing pct={(doneCount / totalActions) * 100} size={56} strokeWidth={6}>
            <Text style={styles.ringText}>
              {doneCount}/{totalActions}
            </Text>
          </ProgressRing>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Payday du mois</Text>
            <Text style={styles.cardSubtitle}>
              {doneCount >= totalActions
                ? 'Tous les virements sont faits'
                : `Il reste ${totalActions - doneCount} virement${totalActions - doneCount > 1 ? 's' : ''} à faire`}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {rootGoals.length > 0 && (
        <View style={styles.tileRow}>
          {rootGoals.map((e) => (
            <View key={e.id} style={styles.tile}>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {e.label}
              </Text>
              <Text style={styles.tileValue}>{formatPct(e.goal!.current, e.goal!.target) ?? '0%'}</Text>
            </View>
          ))}
        </View>
      )}

      {banner && (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Target size={16} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.bannerTitle}>
              {banner.emoji} {banner.label} : {formatPct(banner.goal!.current, banner.goal!.target) ?? '0%'} rempli
            </Text>
            <Text style={styles.bannerSubtitle}>
              Plus que {formatAmount(banner.goal!.target - banner.goal!.current)} avant d'atteindre l'objectif.
            </Text>
          </View>
        </View>
      )}

      {nothingToShow && (
        <Text style={styles.empty}>Rien à afficher pour l'instant — configure ton budget dans les autres onglets.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
    padding: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  ringText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  cardSubtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.secondary },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  tileLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.secondary },
  tileValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    padding: 16,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  bannerSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: ink(0.6), marginTop: 2 },
  empty: { fontFamily: fonts.medium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
});
