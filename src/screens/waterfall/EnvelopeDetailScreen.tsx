import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { runWaterfall } from '@/core/waterfall/engine';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import type { Envelope } from '@/core/waterfall/types';
import { formatAmount } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { coupleIncome } from '@/lib/couple';

type Props = NativeStackScreenProps<MainStackParamList, 'EnvelopeDetail'>;

export default function EnvelopeDetailScreen({ route, navigation }: Props) {
  const { envelopeId } = route.params;
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);

  // useFocusEffect (pas useEffect) : cet écran reste monté en arrière-plan quand on va sur
  // EnvelopeForm, donc un simple effet "au montage" ne se redéclencherait pas au retour.
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
        income: profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 },
        envelopes,
      }),
    [envelopes, profile, partner]
  );

  const envelope = findEnvelope(envelopes, envelopeId);
  const envelopeResult = findEnvelopeResult(result.envelopeResults, envelopeId);

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

  const renderChild = ({ item }: { item: Envelope }) => {
    const amount = envelopeResult?.children.find((c) => c.envelopeId === item.id)?.amount ?? 0;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.push('EnvelopeDetail', { envelopeId: item.id })}
      >
        <Text style={styles.rowLabel}>
          {item.emoji} {item.label}
        </Text>
        <Text style={styles.rowAmount}>{formatAmount(amount)}</Text>
      </TouchableOpacity>
    );
  };

  if (!envelope) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Enveloppe introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {envelope.emoji} {envelope.label}
        </Text>
        <Text style={styles.summaryAmount}>{formatAmount(envelopeResult?.amount ?? 0)}</Text>
      </View>

      <FlatList
        data={envelope.children}
        keyExtractor={(item) => item.id}
        renderItem={renderChild}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void handleRefresh()} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Aucune sous-enveloppe pour l'instant.</Text> : null
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('EnvelopeForm', { parentId: envelope.id })}
      >
        <Text style={styles.addButtonText}>+ Ajouter une sous-enveloppe</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EnvelopeForm', { envelopeId: envelope.id })}
      >
        <Text style={styles.editButtonText}>Modifier cette enveloppe</Text>
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
  summaryLabel: { fontSize: 16, fontWeight: '600' },
  summaryAmount: { fontSize: 24, fontWeight: '800' },
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowAmount: { fontSize: 16, fontWeight: '700' },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  editButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
