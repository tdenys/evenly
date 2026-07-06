import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { runWaterfall } from '@/core/waterfall/engine';
import { findEnvelopeResult } from '@/core/waterfall/tree';
import { SiblingEnvelopeList } from '@/components/EnvelopeTreeRow';
import { formatAmount } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { coupleIncome, coupleLabels } from '@/lib/couple';

type Props = NativeStackScreenProps<MainStackParamList, 'Waterfall'>;

export default function WaterfallScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const reorderEnvelopeTo = useStore((s) => s.reorderEnvelopeTo);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  // useFocusEffect (pas useEffect) : native-stack garde cet écran monté en arrière-plan quand
  // on va sur "Revenus"/"Enveloppe", donc un simple effet "au montage" ne se redéclencherait
  // pas au retour. refresh() recharge aussi profile/partner (donc leur net_income) — sans ça,
  // un revenu que le/la partenaire vient de changer resterait affiché comme périmé.
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

  const getAmount = (id: string) => findEnvelopeResult(result.envelopeResults, id)?.amount ?? 0;

  const personLabels = coupleLabels(profile, partner);

  const handleReorder = (id: string, targetIndex: number) => {
    reorderEnvelopeTo(id, targetIndex).catch((err) => notify('Erreur', errorMessage(err)));
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        scrollEnabled={!dragging}
      >
        {envelopes.length === 0 && !loading && (
          <Text style={styles.empty}>Aucune enveloppe pour l'instant.</Text>
        )}
        <SiblingEnvelopeList
          envelopes={envelopes}
          depth={0}
          getAmount={getAmount}
          personLabels={personLabels}
          onReorder={handleReorder}
          onAddChild={(parentId) => navigation.navigate('EnvelopeForm', { parentId })}
          onEdit={(envelopeId) => navigation.navigate('EnvelopeForm', { envelopeId })}
          onDragStateChange={setDragging}
        />
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('EnvelopeForm', {})}>
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
  // Sur mobile web, un pull vers le bas en haut de la liste peut déclencher le "tirer pour
  // actualiser" natif du navigateur (Chrome/Safari), en plus de notre propre glisser-déposer —
  // overscrollBehaviorY le désactive au niveau CSS (sans effet sur natif/Expo Go).
  scroll: Platform.OS === 'web' ? ({ overscrollBehaviorY: 'contain' } as object) : {},
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
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
