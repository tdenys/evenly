import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { ManualPaydayAmount } from '@/core/payday/types';
import { findEnvelope } from '@/core/waterfall/tree';
import PaydayAmountEditor from '@/components/PaydayAmountEditor';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts, type } from '@/theme/typography';
import SectionCard from '@/components/ui/SectionCard';
import Stepper from '@/components/ui/Stepper';
import Chip, { ChipRow } from '@/components/ui/Chip';
import Button from '@/components/ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'PaydayActionForm'>;

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
  const [priority, setPriority] = useState(existing?.priority ?? nextPriority);
  const [amount, setAmount] = useState<ManualPaydayAmount>(
    existing && existing.amount.type !== 'envelope' ? existing.amount : { type: 'fixed', value: 0 }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      notify('Libellé manquant', 'Donne un nom à cette action.');
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
        priority,
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Modifier l\'action' : 'Nouvelle action',
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
  }, [navigation, existing, saving, ownerId, label, description, priority, amount]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionCard label="Détails">
        <Text style={styles.fieldLabel}>Salaire concerné</Text>
        <ChipRow>
          {profile && <Chip label="Moi" selected={ownerId === profile.id} onPress={() => setOwnerId(profile.id)} />}
          {partner && (
            <Chip
              label={partner.displayName}
              selected={ownerId === partner.id}
              onPress={() => setOwnerId(partner.id)}
            />
          )}
        </ChipRow>

        <Text style={styles.fieldLabel}>Libellé</Text>
        <TextInput style={styles.input} placeholder="Ex : Vire Voyage" value={label} onChangeText={setLabel} />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex : pour les vacances d'été"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Priorité (1 = traité en premier)</Text>
          <Stepper value={priority} onChange={setPriority} min={1} max={99} />
        </View>
      </SectionCard>

      <SectionCard label="Montant">
        {isLinked ? (
          <Text style={styles.linkedHint}>
            Suit l'enveloppe {linkedEnvelope ? `${linkedEnvelope.emoji} ${linkedEnvelope.label}` : '(supprimée)'} —
            modifiable depuis l'écran Budget.
          </Text>
        ) : (
          <PaydayAmountEditor value={amount} onChange={setAmount} />
        )}
      </SectionCard>

      {existing && !isLinked && (
        <Button title="Supprimer l'action" variant="text-danger" onPress={handleDelete} />
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  headerAction: { fontFamily: fonts.karlaSemiBold, fontSize: 14.5, color: ink(0.55), paddingHorizontal: 4 },
  headerActionPrimary: { color: colors.primary, fontFamily: fonts.karlaBold },
  headerActionDisabled: { opacity: 0.5 },
  fieldLabel: { ...type.fieldLabel, color: ink(0.6) },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  linkedHint: { fontFamily: fonts.karlaMedium, fontSize: 13.5, color: ink(0.55), fontStyle: 'italic' },
  linkedDeleteHint: { fontFamily: fonts.karlaMedium, fontSize: 12, color: ink(0.4), textAlign: 'center' },
});
