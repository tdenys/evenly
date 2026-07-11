import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { SubscriptionFrequency } from '@/core/subscriptions/types';
import { monthlyCost } from '@/core/subscriptions/monthlyCost';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { coupleLabels } from '@/lib/couple';
import { formatAmount } from '@/lib/format';
import { colors, ink } from '@/theme/colors';
import { fonts, type } from '@/theme/typography';
import SectionCard from '@/components/ui/SectionCard';
import Chip, { ChipRow } from '@/components/ui/Chip';
import Button from '@/components/ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionForm'>;

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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Modifier l\'abonnement' : 'Nouvel abonnement',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.headerAction}>Annuler</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => void handleSave()} disabled={saving} hitSlop={8}>
          <Text style={[styles.headerAction, styles.headerActionPrimary, saving && styles.headerActionDisabled]}>
            {saving ? '...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, existing, saving, title, costText, frequency, category, assignedTo]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionCard label="Détails">
        <Text style={styles.fieldLabel}>Titre</Text>
        <TextInput style={styles.input} placeholder="Ex : Netflix" value={title} onChangeText={setTitle} />

        <Text style={styles.fieldLabel}>Coût</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="Montant en €"
          value={costText}
          onChangeText={setCostText}
        />

        <Text style={styles.fieldLabel}>Fréquence</Text>
        <ChipRow>
          {FREQUENCIES.map((f) => (
            <Chip key={f} label={FREQUENCY_LABELS[f]} selected={frequency === f} onPress={() => setFrequency(f)} />
          ))}
        </ChipRow>
        <Text style={styles.hint}>≈ {formatAmount(monthlyCost(cost, frequency))} / mois</Text>

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <TextInput style={styles.input} placeholder="Ex : Streaming" value={category} onChangeText={setCategory} />
      </SectionCard>

      <SectionCard label="Assigné à">
        <ChipRow>
          {(
            [
              ['A', personLabels.A],
              ['B', personLabels.B],
              ['both', 'Les deux'],
            ] as const
          ).map(([value, chipLabel]) => (
            <Chip
              key={value}
              label={chipLabel}
              selected={assignedTo === value}
              onPress={() => setAssignedTo(value)}
              gradient={value === 'both'}
            />
          ))}
        </ChipRow>
      </SectionCard>

      {existing && <Button title="Supprimer l'abonnement" variant="text-danger" onPress={handleDelete} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  headerAction: { fontFamily: fonts.karlaSemiBold, fontSize: 14.5, color: ink(0.55), paddingHorizontal: 4 },
  headerActionPrimary: { color: colors.primary, fontFamily: fonts.karlaBold },
  headerActionDisabled: { opacity: 0.5 },
  fieldLabel: { ...type.fieldLabel, color: ink(0.6) },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    fontFamily: fonts.karlaMedium,
    fontSize: 15,
    color: colors.ink,
  },
  hint: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: colors.warning },
});
