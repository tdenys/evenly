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
import { orderCouple } from '@/lib/couple';
import { formatAmount } from '@/lib/format';
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
  const loadSubscriptions = useStore((s) => s.loadSubscriptions);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadSubscriptions(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadSubscriptions, refresh])
  );

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

      {filtered.length === 0 && !loading && (
        <Text style={styles.empty}>Aucun abonnement pour l'instant.</Text>
      )}

      {filtered.map((sub) => (
        <View key={sub.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {sub.title}
            </Text>
            <Text style={styles.rowDescription} numberOfLines={1}>
              {describeSubscription(sub)}
            </Text>
          </View>

          <Text style={styles.rowAmount}>{formatAmount(monthlyCost(sub.cost, sub.frequency))}</Text>

          <TouchableOpacity
            style={styles.editZone}
            onPress={() => navigation.navigate('SubscriptionForm', { subscriptionId: sub.id })}
            hitSlop={8}
          >
            <Pencil size={16} color={ink(0.45)} />
          </TouchableOpacity>
        </View>
      ))}
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
  rowAmount: { fontFamily: fonts.spectralSemiBold, fontSize: 15, color: colors.ink },
  editZone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
