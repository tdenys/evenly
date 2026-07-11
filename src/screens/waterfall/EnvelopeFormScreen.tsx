import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import type { Amount } from '@/core/waterfall/types';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import { runWaterfall } from '@/core/waterfall/engine';
import AmountEditor from '@/components/AmountEditor';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { coupleIncome, coupleLabels } from '@/lib/couple';
import { formatAmountWithPct } from '@/lib/format';
import { colors, ink } from '@/theme/colors';
import { fonts, type } from '@/theme/typography';
import SectionCard from '@/components/ui/SectionCard';
import AppSwitch from '@/components/ui/AppSwitch';
import Stepper from '@/components/ui/Stepper';
import { ChipRow } from '@/components/ui/Chip';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'EnvelopeForm'>;

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
  const [priority, setPriority] = useState(existing?.priority ?? nextPriority);
  const [allocation, setAllocation] = useState<Amount>(
    existing?.allocation ?? { type: 'percent_envelope', pct: 0 }
  );
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [fundedBy, setFundedBy] = useState<'A' | 'B' | 'both' | null>(existing?.fundedBy ?? null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) {
      notify('Libellé manquant', 'Donne un nom à cette enveloppe.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        label: label.trim(),
        emoji: emoji.trim() || '💰',
        priority,
        allocation,
        enabled,
        fundedBy,
      };
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
    setPriority(nextPriority);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Modifier l\'enveloppe' : 'Nouvelle enveloppe',
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
  }, [navigation, existing, saving, label, emoji, priority, allocation, enabled, fundedBy]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionCard label="Détails">
        <View style={styles.emojiLabelRow}>
          <TextInput style={styles.emojiInput} value={emoji} onChangeText={setEmoji} maxLength={2} />
          <TextInput
            style={[styles.input, styles.labelInput]}
            placeholder="Ex : Investissement"
            value={label}
            onChangeText={setLabel}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Priorité (1 = remplie en premier)</Text>
          <Stepper value={priority} onChange={setPriority} min={1} max={99} />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Enveloppe active</Text>
          <AppSwitch value={enabled} onValueChange={setEnabled} />
        </View>
      </SectionCard>

      <SectionCard label="Allocation">
        <Text style={styles.availableHint}>
          Reste disponible ici : {formatAmountWithPct(available, parentAmount)}
        </Text>
        <TouchableOpacity style={styles.fillButton} onPress={handleFillRemainder}>
          <Text style={styles.fillButtonText}>Combler avec le reste</Text>
        </TouchableOpacity>
        <AmountEditor value={allocation} onChange={setAllocation} personLabels={personLabels} />
      </SectionCard>

      <SectionCard label="Financée par">
        <ChipRow>
          {(
            [
              [null, 'Aucun'],
              ['A', personLabels.A],
              ['B', personLabels.B],
              ['both', 'Les deux'],
            ] as const
          ).map(([value, chipLabel]) => (
            <Chip
              key={chipLabel}
              label={chipLabel}
              selected={fundedBy === value}
              onPress={() => setFundedBy(value)}
              gradient={value === 'both'}
            />
          ))}
        </ChipRow>
      </SectionCard>

      {existing && <Button title="Supprimer l'enveloppe" variant="text-danger" onPress={handleDelete} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  headerAction: { fontFamily: fonts.karlaSemiBold, fontSize: 14.5, color: ink(0.55), paddingHorizontal: 4 },
  headerActionPrimary: { color: colors.primary, fontFamily: fonts.karlaBold },
  headerActionDisabled: { opacity: 0.5 },
  emojiLabelRow: { flexDirection: 'row', gap: 10 },
  emojiInput: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    fontSize: 22,
    textAlign: 'center',
    width: 56,
  },
  labelInput: { flex: 1 },
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
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { ...type.fieldLabel, color: ink(0.6), flexShrink: 1 },
  availableHint: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: colors.warning },
  fillButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  fillButtonText: { fontFamily: fonts.karlaBold, fontSize: 12.5, color: colors.primary },
});
