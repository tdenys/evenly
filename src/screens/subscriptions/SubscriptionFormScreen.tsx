import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { SubscriptionFrequency } from '@/core/subscriptions/types';
import { monthlyCost } from '@/core/subscriptions/monthlyCost';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { coupleLabels } from '@/lib/couple';
import { formatAmount } from '@/lib/format';

type Props = NativeStackScreenProps<MainStackParamList, 'SubscriptionForm'>;

const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

const FREQUENCIES: SubscriptionFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export default function SubscriptionFormScreen({ route, navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const subscriptions = useStore((s) => s.subscriptions);
  const createSubscription = useStore((s) => s.createSubscription);
  const updateSubscription = useStore((s) => s.updateSubscription);
  const deleteSubscription = useStore((s) => s.deleteSubscription);

  const personLabels = coupleLabels(profile, partner);

  const { subscriptionId } = route.params;
  const existing = subscriptionId ? subscriptions.find((s) => s.id === subscriptionId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [costText, setCostText] = useState(existing ? String(existing.cost) : '');
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(existing?.frequency ?? 'monthly');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [assignedTo, setAssignedTo] = useState<'A' | 'B' | 'both'>(existing?.assignedTo ?? 'both');
  const [saving, setSaving] = useState(false);

  const cost = Number(costText.replace(',', '.')) || 0;

  const handleSave = async () => {
    if (!title.trim()) {
      notify('Titre manquant', 'Donne un nom à cet abonnement.');
      return;
    }
    const parsedCost = Number(costText.replace(',', '.'));
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      notify('Coût invalide', 'Renseigne un coût valide.');
      return;
    }

    setSaving(true);
    try {
      const input = { title: title.trim(), cost: parsedCost, frequency, category: category.trim(), assignedTo };
      if (existing) {
        await updateSubscription(existing.id, input);
      } else {
        await createSubscription(input);
      }
      navigation.goBack();
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    confirmAction("Supprimer l'abonnement", `Supprimer "${existing.title}" ?`, async () => {
      try {
        await deleteSubscription(existing.id);
        navigation.goBack();
      } catch (err) {
        notify('Erreur', errorMessage(err));
      }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Titre</Text>
      <TextInput style={styles.input} placeholder="Ex : Netflix" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Coût</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Montant en €"
        value={costText}
        onChangeText={setCostText}
      />

      <Text style={styles.label}>Fréquence</Text>
      <View style={styles.chips}>
        {FREQUENCIES.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, frequency === f && styles.chipSelected]}
            onPress={() => setFrequency(f)}
          >
            <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
              {FREQUENCY_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>≈ {formatAmount(monthlyCost(cost, frequency))} / mois</Text>

      <Text style={styles.label}>Catégorie</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex : Streaming"
        value={category}
        onChangeText={setCategory}
      />

      <Text style={styles.label}>Assigné à</Text>
      <View style={styles.chips}>
        {(
          [
            ['A', personLabels.A],
            ['B', personLabels.B],
            ['both', 'Les deux'],
          ] as const
        ).map(([value, chipLabel]) => (
          <TouchableOpacity
            key={value}
            style={[styles.chip, assignedTo === value && styles.chipSelected]}
            onPress={() => setAssignedTo(value)}
          >
            <Text style={[styles.chipText, assignedTo === value && styles.chipTextSelected]}>{chipLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>

      {existing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Supprimer l'abonnement</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 8, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  hint: { fontSize: 13, color: '#b45309', marginTop: 8 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 16, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
