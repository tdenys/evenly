import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { Amount } from '@/core/waterfall/types';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import { runWaterfall } from '@/core/waterfall/engine';
import AmountEditor from '@/components/AmountEditor';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { coupleIncome, coupleLabels } from '@/lib/couple';
import { formatAmountWithPct } from '@/lib/format';

type Props = NativeStackScreenProps<MainStackParamList, 'EnvelopeForm'>;

export default function EnvelopeFormScreen({ route, navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const createEnvelope = useStore((s) => s.createEnvelope);
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const deleteEnvelope = useStore((s) => s.deleteEnvelope);

  const personLabels = coupleLabels(profile, partner);

  const { envelopeId, parentId } = route.params;
  const existing = envelopeId ? findEnvelope(envelopes, envelopeId) : undefined;
  // Priorité par défaut calculée parmi les enveloppes sœurs (enfants du même parent, ou
  // enveloppes racines si parentId est absent) — pas parmi toutes les enveloppes de l'arbre —
  // et en excluant l'enveloppe en cours d'édition elle-même.
  const siblings = parentId ? (findEnvelope(envelopes, parentId)?.children ?? []) : envelopes;
  const siblingsExcludingSelf = siblings.filter((s) => s.id !== existing?.id);
  const nextPriority =
    siblingsExcludingSelf.length > 0 ? Math.max(...siblingsExcludingSelf.map((e) => e.priority)) + 1 : 1;

  // Calcule ce qu'il reste de disponible dans le pool direct (revenu total à la racine, ou
  // montant du parent) une fois retiré ce que prennent déjà les AUTRES enveloppes sœurs — sert
  // à afficher un repère et à alimenter "Combler avec le reste".
  const income = profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 };
  const result = runWaterfall({ income, envelopes });
  const parentAmount = parentId
    ? (findEnvelopeResult(result.envelopeResults, parentId)?.amount ?? 0)
    : result.totalIncome;
  const consumedByOthers = siblingsExcludingSelf.reduce(
    (sum, s) => sum + (findEnvelopeResult(result.envelopeResults, s.id)?.amount ?? 0),
    0
  );
  const available = Math.max(parentAmount - consumedByOthers, 0);

  const [label, setLabel] = useState(existing?.label ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '💰');
  const [priority, setPriority] = useState(String(existing?.priority ?? nextPriority));
  const [allocation, setAllocation] = useState<Amount>(
    existing?.allocation ?? { type: 'percent_envelope', pct: 0 }
  );
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      notify('Libellé manquant', 'Donne un nom à cette enveloppe.');
      return;
    }
    const parsedPriority = Number(priority);
    if (!Number.isInteger(parsedPriority)) {
      notify('Priorité invalide', 'La priorité doit être un nombre entier.');
      return;
    }

    setSaving(true);
    try {
      const input = { label: label.trim(), emoji: emoji.trim() || '💰', priority: parsedPriority, allocation, enabled };
      if (existing) {
        await updateEnvelope(existing.id, input);
      } else {
        await createEnvelope({ ...input, parentId: parentId ?? null });
      }
      navigation.goBack();
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleFillRemainder = () => {
    // "% du reste à 100%" ne consomme réellement TOUT ce qu'il reste que si cette enveloppe est
    // traitée en dernier — on la pousse donc systématiquement à la priorité la plus basse.
    setAllocation({ type: 'percent_remaining', pct: 100 });
    setPriority(String(nextPriority));
  };

  const handleDelete = () => {
    if (!existing) return;
    confirmAction('Supprimer l\'enveloppe', `Supprimer "${existing.label}" ?`, async () => {
      try {
        await deleteEnvelope(existing.id);
        navigation.goBack();
      } catch (err) {
        notify('Erreur', errorMessage(err));
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Emoji</Text>
      <TextInput style={styles.emojiInput} value={emoji} onChangeText={setEmoji} maxLength={2} />

      <Text style={styles.label}>Libellé</Text>
      <TextInput style={styles.input} placeholder="Ex : Investissement" value={label} onChangeText={setLabel} />

      <Text style={styles.label}>Priorité (1 = remplie en premier)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={priority}
        onChangeText={setPriority}
      />

      <View style={styles.enabledRow}>
        <Text style={styles.label}>Enveloppe active</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      <Text style={styles.label}>Allocation</Text>
      <Text style={styles.availableHint}>
        Reste disponible ici : {formatAmountWithPct(available, parentAmount)}
      </Text>
      <TouchableOpacity style={styles.fillButton} onPress={handleFillRemainder}>
        <Text style={styles.fillButtonText}>Combler avec le reste</Text>
      </TouchableOpacity>
      <AmountEditor value={allocation} onChange={setAllocation} personLabels={personLabels} />

      <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>

      {existing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Supprimer l'enveloppe</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  emojiInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    textAlign: 'center',
    width: 64,
  },
  availableHint: { fontSize: 13, color: '#b45309', marginBottom: 8 },
  enabledRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  fillButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  fillButtonText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
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
