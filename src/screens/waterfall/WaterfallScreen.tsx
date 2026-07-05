import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { runWaterfall } from '@/core/waterfall/engine';
import type { Envelope } from '@/core/waterfall/types';
import { formatAmount } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';

type Props = NativeStackScreenProps<MainStackParamList, 'Waterfall'>;

export default function WaterfallScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);

  // useFocusEffect (pas useEffect) : native-stack garde cet écran monté en arrière-plan quand
  // on va sur "Revenus", donc un simple effet "au montage" ne se redéclencherait pas au retour.
  // refresh() recharge aussi profile/partner (donc leur net_income) — sans ça, un revenu que
  // le/la partenaire vient de changer sur son propre appareil resterait affiché comme périmé.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, refresh])
  );

  const result = useMemo(
    () =>
      runWaterfall({
        income: { a: profile?.netIncome ?? 0, b: partner?.netIncome ?? 0 },
        envelopes,
      }),
    [envelopes, profile?.netIncome, partner?.netIncome]
  );

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEnvelopes(), refresh()]);
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const renderEnvelope = ({ item }: { item: Envelope }) => {
    const amount = result.envelopeResults.find((e) => e.envelopeId === item.id)?.amount ?? 0;
    return (
      <TouchableOpacity
        style={styles.envelopeRow}
        onPress={() => navigation.navigate('EnvelopeForm', { envelopeId: item.id })}
      >
        <Text style={styles.envelopeLabel}>
          {item.emoji} {item.label}
        </Text>
        <Text style={styles.envelopeAmount}>{formatAmount(amount)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Revenu total du couple</Text>
        <Text style={styles.summaryAmount}>{formatAmount(result.totalIncome)}</Text>
        {result.remainingIncome > 0.01 && (
          <Text style={styles.remaining}>{formatAmount(result.remainingIncome)} non alloué</Text>
        )}
      </View>

      <FlatList
        data={envelopes}
        keyExtractor={(item) => item.id}
        renderItem={renderEnvelope}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void handleRefresh()} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Aucune enveloppe pour l'instant.</Text> : null
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('EnvelopeForm', { envelopeId: undefined })}
      >
        <Text style={styles.addButtonText}>+ Ajouter une enveloppe</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.incomeButton} onPress={() => navigation.navigate('Income')}>
        <Text style={styles.incomeButtonText}>💶 Revenus</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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
  remaining: { fontSize: 13, color: '#b45309', marginTop: 4 },
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  envelopeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  envelopeLabel: { fontSize: 16, fontWeight: '600' },
  envelopeAmount: { fontSize: 16, fontWeight: '700' },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  incomeButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  incomeButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
