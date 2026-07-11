import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { Subscription, SubscriptionFrequency } from '@/core/subscriptions/types';
import { monthlyCost } from '@/core/subscriptions/monthlyCost';
import { orderCouple } from '@/lib/couple';
import { formatAmount } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';

type Props = NativeStackScreenProps<MainStackParamList, 'Subscriptions'>;

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

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Coût mensuel total</Text>
        <Text style={styles.summaryAmount}>{formatAmount(total)}</Text>
      </View>

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
            onPress={() => navigation.navigate('SubscriptionForm', { subscriptionId: sub.id })}
            hitSlop={8}
          >
            <Text style={styles.edit}>✏️</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('SubscriptionForm', {})}>
        <Text style={styles.addButtonText}>+ Ajouter un abonnement</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  // 4 onglets : wrap en 2x2 sur mobile plutôt que de les écraser sur une seule ligne (le nom
  // du/de la partenaire peut être long).
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tab: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabSelected: { backgroundColor: '#2563eb' },
  tabText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  tabTextSelected: { color: '#fff' },
  summaryCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 13, color: '#555' },
  summaryAmount: { fontSize: 24, fontWeight: '800' },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDescription: { fontSize: 12, color: '#888', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  edit: { fontSize: 15 },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
