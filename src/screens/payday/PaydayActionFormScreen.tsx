import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { ManualPaydayAmount } from '@/core/payday/types';
import { findEnvelope } from '@/core/waterfall/tree';
import PaydayAmountEditor from '@/components/PaydayAmountEditor';
import { confirmAction, errorMessage, notify } from '@/lib/alert';

type Props = NativeStackScreenProps<MainStackParamList, 'PaydayActionForm'>;

export default function PaydayActionFormScreen({ route, navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const paydayActions = useStore((s) => s.paydayActions);
  const createPaydayAction = useStore((s) => s.createPaydayAction);
  const updatePaydayAction = useStore((s) => s.updatePaydayAction);
  const deletePaydayAction = useStore((s) => s.deletePaydayAction);

  const { actionId, ownerId: initialOwnerId } = route.params;
  const existing = actionId ? paydayActions.find((a) => a.id === actionId) : undefined;

  // Référence vivante vers une enveloppe (voir EnvelopeFormScreen "Financée par") : montant en
  // lecture seule, pas de suppression ici (la source de vérité est l'enveloppe elle-même).
  const linkedEnvelope =
    existing?.amount.type === 'envelope' ? findEnvelope(envelopes, existing.amount.envelopeId) : undefined;
  const isLinked = existing?.amount.type === 'envelope';

  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? initialOwnerId);
  // Priorité par défaut calculée parmi les actions de la même personne (pas toutes les actions
  // du couple), en excluant l'action en cours d'édition elle-même — même principe que
  // EnvelopeFormScreen.
  const siblingsExcludingSelf = paydayActions.filter((a) => a.ownerId === ownerId && a.id !== existing?.id);
  const nextPriority =
    siblingsExcludingSelf.length > 0 ? Math.max(...siblingsExcludingSelf.map((a) => a.priority)) + 1 : 1;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState(String(existing?.priority ?? nextPriority));
  const [amount, setAmount] = useState<ManualPaydayAmount>(
    existing && existing.amount.type !== 'envelope' ? existing.amount : { type: 'fixed', value: 0 }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      notify('Libellé manquant', 'Donne un nom à cette action.');
      return;
    }
    const parsedPriority = Number(priority);
    if (!Number.isInteger(parsedPriority)) {
      notify('Priorité invalide', 'La priorité doit être un nombre entier.');
      return;
    }

    setSaving(true);
    try {
      // Une action liée garde toujours son amount d'origine ({type:'envelope',...}) — jamais
      // écrasé par l'état local `amount` (qui ne sert qu'aux actions manuelles).
      const input = {
        ownerId,
        label: label.trim(),
        description: description.trim(),
        priority: parsedPriority,
        amount: existing && isLinked ? existing.amount : amount,
      };
      if (existing) {
        await updatePaydayAction(existing.id, input);
      } else {
        await createPaydayAction(input);
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
    confirmAction("Supprimer l'action", `Supprimer "${existing.label}" ?`, async () => {
      try {
        await deletePaydayAction(existing.id);
        navigation.goBack();
      } catch (err) {
        notify('Erreur', errorMessage(err));
      }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Salaire concerné</Text>
      <View style={styles.chips}>
        {profile && (
          <TouchableOpacity
            style={[styles.chip, ownerId === profile.id && styles.chipSelected]}
            onPress={() => setOwnerId(profile.id)}
          >
            <Text style={[styles.chipText, ownerId === profile.id && styles.chipTextSelected]}>Moi</Text>
          </TouchableOpacity>
        )}
        {partner && (
          <TouchableOpacity
            style={[styles.chip, ownerId === partner.id && styles.chipSelected]}
            onPress={() => setOwnerId(partner.id)}
          >
            <Text style={[styles.chipText, ownerId === partner.id && styles.chipTextSelected]}>
              {partner.displayName}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>Libellé</Text>
      <TextInput style={styles.input} placeholder="Ex : Vire Voyage" value={label} onChangeText={setLabel} />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex : pour les vacances d'été"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Priorité (1 = traité en premier)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={priority} onChangeText={setPriority} />

      <Text style={styles.label}>Montant</Text>
      {isLinked ? (
        <Text style={styles.linkedHint}>
          Suit l'enveloppe {linkedEnvelope ? `${linkedEnvelope.emoji} ${linkedEnvelope.label}` : '(supprimée)'} —
          modifiable depuis l'écran Budget.
        </Text>
      ) : (
        <PaydayAmountEditor value={amount} onChange={setAmount} />
      )}

      <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>

      {existing && !isLinked && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Supprimer l'action</Text>
        </TouchableOpacity>
      )}
      {existing && isLinked && (
        <Text style={styles.linkedDeleteHint}>
          Pour retirer cette action, repasse "Financée par" à "Aucun" sur l'enveloppe correspondante.
        </Text>
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
  linkedHint: { fontSize: 14, color: '#555', fontStyle: 'italic' },
  linkedDeleteHint: { marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' },
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
