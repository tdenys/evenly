import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { Subscription, SubscriptionFrequency } from '@/core/subscriptions/types';
import { monthlyCost } from '@/core/subscriptions/monthlyCost';
import { runWaterfall } from '@/core/waterfall/engine';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import type { Envelope } from '@/core/waterfall/types';
import { coupleIncome, orderCouple } from '@/lib/couple';
import { formatAmount, formatPct } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import SummaryCard from '@/components/ui/SummaryCard';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Subscriptions'>,
  NativeStackScreenProps<RootStackParamList>
>;

const FREQUENCY_SUFFIX: Record<SubscriptionFrequency, string> = {
  weekly: '/semaine',
  monthly: '/mois',
  quarterly: '/trimestre',
  yearly: '/an',
};

function describeSubscription(sub: Subscription): string {
  const parts = [`${formatAmount(sub.cost)}${FREQUENCY_SUFFIX[sub.frequency]}`];
  if (sub.category) parts.unshift(sub.category);
  return parts.join(' · ');
}

type Filter = 'all' | 'shared' | 'me' | 'partner';

export default function SubscriptionsScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const subscriptions = useStore((s) => s.subscriptions);
  const envelopes = useStore((s) => s.envelopes);
  const loadSubscriptions = useStore((s) => s.loadSubscriptions);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadSubscriptions(), loadEnvelopes(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadSubscriptions, loadEnvelopes, refresh])
  );

  // Premier pont entre Abonnements et Waterfall : sert à savoir quelle part du budget d'une
  // enveloppe ses abonnements liés représentent, pour détecter une dérive (ex: 890€/mois
  // d'abonnements sur une enveloppe qui n'en prévoit que 800€).
  const income = profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 };
  const waterfallResult = useMemo(() => runWaterfall({ income, envelopes }), [income, envelopes]);

  const myLetter = profile && partner ? orderCouple(profile, partner).personA.id === profile.id ? 'A' : 'B' : 'A';
  const partnerLetter = myLetter === 'A' ? 'B' : 'A';

  // Les filtres individuels ("Moi"/partenaire) montrent uniquement CE qui appartient en propre
  // à cette personne (ex: son budget plaisir perso) — les abonnements communs ont leur propre
  // filtre dédié, "Commun", pour ne pas les mélanger.
  const filtered = useMemo(() => {
    switch (filter) {
      case 'all':
        return subscriptions;
      case 'shared':
        return subscriptions.filter((s) => s.assignedTo === 'both');
      case 'me':
        return subscriptions.filter((s) => s.assignedTo === myLetter);
      case 'partner':
        return subscriptions.filter((s) => s.assignedTo === partnerLetter);
    }
  }, [subscriptions, filter, myLetter, partnerLetter]);

  const total = useMemo(
    () => filtered.reduce((sum, s) => sum + monthlyCost(s.cost, s.frequency), 0),
    [filtered]
  );

  // Regroupe les abonnements liés (dans le filtre courant) par enveloppe, pour afficher le %
  // combiné — un seul abonnement peut déjà dépasser 100% à lui seul, mais c'est surtout la
  // somme de plusieurs qui révèle une vraie dérive budgétaire.
  const envelopeGroups = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sub of filtered) {
      if (!sub.envelopeId) continue;
      totals.set(sub.envelopeId, (totals.get(sub.envelopeId) ?? 0) + monthlyCost(sub.cost, sub.frequency));
    }
    const groups: { envelope: Envelope; linkedTotal: number; envelopeAmount: number }[] = [];
    for (const [envelopeId, linkedTotal] of totals) {
      const envelope = findEnvelope(envelopes, envelopeId);
      if (!envelope) continue;
      const envelopeAmount = findEnvelopeResult(waterfallResult.envelopeResults, envelope.id)?.amount ?? 0;
      groups.push({ envelope, linkedTotal, envelopeAmount });
    }
    return groups;
  }, [filtered, envelopes, waterfallResult]);

  const partnerLabel = partner?.displayName ?? 'ton/ta partenaire';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, filter === 'all' && styles.tabSelected]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextSelected]}>Tous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'shared' && styles.tabSelected]}
          onPress={() => setFilter('shared')}
        >
          <Text style={[styles.tabText, filter === 'shared' && styles.tabTextSelected]}>Commun</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'me' && styles.tabSelected]} onPress={() => setFilter('me')}>
          <Text style={[styles.tabText, filter === 'me' && styles.tabTextSelected]}>Moi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'partner' && styles.tabSelected]}
          onPress={() => setFilter('partner')}
        >
          <Text style={[styles.tabText, filter === 'partner' && styles.tabTextSelected]} numberOfLines={1}>
            {partnerLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <SummaryCard label="Coût mensuel total" amount={formatAmount(total)} />

      {envelopeGroups.length > 0 && (
        <View style={styles.groupCard}>
          {envelopeGroups.map(({ envelope, linkedTotal, envelopeAmount }) => {
            const isOver = linkedTotal > envelopeAmount + 0.01;
            return (
              <View key={envelope.id} style={styles.groupRow}>
                <Text style={styles.groupLabel} numberOfLines={1}>
                  {envelope.emoji} {envelope.label}
                </Text>
                <Text style={styles.groupAmount}>{formatAmount(linkedTotal)}</Text>
                <Text style={[styles.groupPct, isOver && styles.groupPctOver]}>
                  {formatPct(linkedTotal, envelopeAmount) ?? '0%'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {filtered.length === 0 && !loading && (
        <Text style={styles.empty}>Aucun abonnement pour l'instant.</Text>
      )}

      {filtered.map((sub) => {
        const linkedEnvelope = sub.envelopeId ? findEnvelope(envelopes, sub.envelopeId) : undefined;
        const linkedAmount = linkedEnvelope
          ? findEnvelopeResult(waterfallResult.envelopeResults, linkedEnvelope.id)?.amount ?? 0
          : 0;
        const subMonthlyCost = monthlyCost(sub.cost, sub.frequency);
        const linkedPct = linkedEnvelope ? formatPct(subMonthlyCost, linkedAmount) : null;
        const linkedIsOver = linkedEnvelope ? subMonthlyCost > linkedAmount + 0.01 : false;

        return (
          <View key={sub.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {sub.title}
              </Text>
              <Text style={styles.rowDescription} numberOfLines={1}>
                {describeSubscription(sub)}
              </Text>
              {linkedEnvelope && (
                <Text style={[styles.rowLinked, linkedIsOver && styles.rowLinkedOver]} numberOfLines={1}>
                  {linkedEnvelope.emoji} {linkedEnvelope.label} · {linkedPct ?? '0%'}
                </Text>
              )}
            </View>

            <Text style={styles.rowAmount}>{formatAmount(subMonthlyCost)}</Text>

            <TouchableOpacity
              style={styles.editZone}
              onPress={() => navigation.navigate('SubscriptionForm', { subscriptionId: sub.id })}
              hitSlop={8}
            >
              <Pencil size={16} color={ink(0.45)} />
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  // Une seule rangée de 4 pills (pas de grille 2x2) — padding réduit pour tenir à 390px, quitte
  // à tronquer le prénom du/de la partenaire (numberOfLines) plutôt que de repasser en grille.
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.karlaSemiBold, fontSize: 11, color: ink(0.65) },
  tabTextSelected: { color: '#fff', fontFamily: fonts.karlaBold },
  empty: { fontFamily: fonts.karlaMedium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.karlaBold, fontSize: 14, color: colors.ink },
  rowDescription: { fontFamily: fonts.karlaMedium, fontSize: 11.5, color: ink(0.5), marginTop: 2 },
  rowLinked: { fontFamily: fonts.karlaSemiBold, fontSize: 11, color: ink(0.45), marginTop: 2 },
  rowLinkedOver: { color: colors.danger },
  rowAmount: { fontFamily: fonts.spectralSemiBold, fontSize: 15, color: colors.ink },
  groupCard: {
    borderRadius: 14,
    backgroundColor: colors.section,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    padding: 12,
    gap: 8,
  },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupLabel: { flex: 1, fontFamily: fonts.karlaSemiBold, fontSize: 13, color: colors.ink },
  groupAmount: { fontFamily: fonts.spectralSemiBold, fontSize: 13.5, color: colors.ink },
  groupPct: { fontFamily: fonts.karlaBold, fontSize: 12.5, color: ink(0.5), width: 50, textAlign: 'right' },
  groupPctOver: { color: colors.danger },
  editZone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
