import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { Amount } from '@/core/waterfall/types';
import { findEnvelope } from '@/core/waterfall/tree';
import AmountEditor from '@/components/AmountEditor';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { coupleLabels } from '@/lib/couple';

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
  // enveloppes racines si parentId est absent) — pas parmi toutes les enveloppes de l'arbre.
  const siblings = parentId ? (findEnvelope(envelopes, parentId)?.children ?? []) : envelopes;
  const nextPriority = siblings.length > 0 ? Math.max(...siblings.map((e) => e.priority)) + 1 : 1;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '💰');
  const [priority, setPriority] = useState(String(existing?.priority ?? nextPriority));
  const [allocation, setAllocation] = useState<Amount>(
    existing?.allocation ?? { type: 'percent_envelope', pct: 0 }
  );
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
      const input = { label: label.trim(), emoji: emoji.trim() || '💰', priority: parsedPriority, allocation };
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

      <Text style={styles.label}>Allocation</Text>
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
