import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Bell, Pencil, TriangleAlert } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { round2, runPayday } from '@/core/payday/engine';
import type { ManualPaydayAmount, PaydayAction, PaydayAmount } from '@/core/payday/types';
import { resolveEnvelopeAmount } from '@/core/payday/fromEnvelope';
import { runWaterfall } from '@/core/waterfall/engine';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import { coupleIncome, orderCouple } from '@/lib/couple';
import { formatAmountWithPct } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import {
  cancelPaydayReminder,
  getNotificationPermissionGranted,
  requestNotificationPermission,
  schedulePaydayReminder,
  sendTestNotification,
} from '@/lib/notifications';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import SectionCard from '@/components/ui/SectionCard';
import Stepper from '@/components/ui/Stepper';
import AppSwitch from '@/components/ui/AppSwitch';
import Button from '@/components/ui/Button';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Payday'>,
  NativeStackScreenProps<RootStackParamList>
>;

function describeManualAmount(amount: ManualPaydayAmount): string {
  switch (amount.type) {
    case 'fixed':
      return `${amount.value} € fixe`;
    case 'percent_salary':
      return `${amount.pct}% du salaire`;
    case 'percent_remaining':
      return `${amount.pct}% du reste`;
    case 'remainder':
      return 'Le reste';
  }
}

interface DisplayAction {
  id: string;
  ownerId: string;
  label: string;
  description: string; // note libre saisie par l'utilisateur (peut être vide)
  amountDescription: string; // texte auto-généré à partir du type de montant
  priority: number;
  isLinked: boolean;
  runtimeAmount: PaydayAmount; // ce qui est réellement passé à runPayday (résolu si lié)
}

export default function PaydayScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const paydayActions = useStore((s) => s.paydayActions);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const loadPaydayActions = useStore((s) => s.loadPaydayActions);
  const refresh = useStore((s) => s.refresh);
  const [loading, setLoading] = useState(true);
  const [viewedOwnerId, setViewedOwnerId] = useState<string | null>(null);
  // Ajustements ponctuels pour ce dispatch uniquement (jamais persistés) — voir CLAUDE.md :
  // les montants sont modifiables à la main sans changer la règle permanente. N'existe pas pour
  // les actions liées à une enveloppe (montant en lecture seule, dérivé de Waterfall).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [paydayDayText, setPaydayDayText] = useState('');
  const [savingDay, setSavingDay] = useState(false);
  const updateMyPaydayDay = useStore((s) => s.updateMyPaydayDay);
  const updatePartnerPaydayDay = useStore((s) => s.updatePartnerPaydayDay);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(), loadPaydayActions(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, loadPaydayActions, refresh])
  );

  // Reprogramme silencieusement le rappel local si MON jour enregistré a changé — que ce soit
  // moi ou mon/ma partenaire qui l'ait modifié (édition croisée) — seulement si la permission
  // est déjà accordée, sans jamais la demander automatiquement (ça doit toujours venir d'une
  // action explicite). C'est ce mécanisme qui active effectivement le rappel côté partenaire
  // quand c'est moi qui ai renseigné son jour depuis mon téléphone.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || !profile?.paydayDay) return;
      getNotificationPermissionGranted().then((granted) => {
        if (granted && profile.paydayDay) void schedulePaydayReminder(profile.paydayDay);
      });
    }, [profile?.paydayDay])
  );

  const effectiveOwnerId = viewedOwnerId ?? profile?.id ?? null;
  const viewedNetIncome = effectiveOwnerId === partner?.id ? (partner?.netIncome ?? 0) : (profile?.netIncome ?? 0);
  const viewedPaydayDay = effectiveOwnerId === partner?.id ? (partner?.paydayDay ?? null) : (profile?.paydayDay ?? null);
  const partnerLabel = partner?.displayName ?? 'ton/ta partenaire';

  // Le jour de versement est éditable pour n'importe quelle personne depuis n'importe quel
  // compte (comme le revenu) — resynchronisé au changement d'onglet ou si la valeur diverge.
  useEffect(() => {
    setPaydayDayText(viewedPaydayDay ? String(viewedPaydayDay) : '');
  }, [effectiveOwnerId, viewedPaydayDay]);

  const reminderEnabled = paydayDayText.trim() !== '';
  const dayValue = Number(paydayDayText) || 1;

  const handleToggleReminder = (enabled: boolean) => {
    setPaydayDayText(enabled ? String(dayValue) : '');
  };

  const handleSavePaydayDay = async () => {
    const trimmed = paydayDayText.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 31)) {
      notify('Jour invalide', 'Renseigne un jour entre 1 et 31, ou laisse vide.');
      return;
    }
    const editingOwnDay = effectiveOwnerId === profile?.id;
    setSavingDay(true);
    try {
      if (editingOwnDay) {
        await updateMyPaydayDay(parsed);
        if (parsed === null) {
          await cancelPaydayReminder();
        } else {
          const granted = await requestNotificationPermission();
          if (granted) {
            await schedulePaydayReminder(parsed);
          } else {
            notify('Permission refusée', "Le rappel ne pourra pas se déclencher sans autorisation de notification.");
          }
        }
        notify('Enregistré', parsed ? 'Rappel programmé chaque mois.' : 'Rappel désactivé.');
      } else {
        // Impossible de programmer/demander la permission sur l'appareil de l'autre personne
        // depuis ici — seule la valeur en base change, le rappel s'active réellement quand
        // cette personne rouvre l'app sur SON téléphone (cf. la réconciliation ci-dessus).
        await updatePartnerPaydayDay(parsed);
        notify(
          'Enregistré',
          parsed
            ? `${partnerLabel} doit ouvrir l'app sur son téléphone pour activer le rappel.`
            : 'Rappel désactivé.'
        );
      }
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSavingDay(false);
    }
  };

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      notify('Permission refusée', 'Autorise les notifications pour tester le rappel.');
      return;
    }
    await sendTestNotification();
  };

  useEffect(() => {
    setOverrides({});
  }, [effectiveOwnerId]);

  // Le salaire utilisé pour la répartition est toujours le revenu net déclaré dans Budget — pas
  // de champ de saisie ponctuel ici, pour éviter la confusion entre les deux (voir historique :
  // ça semait le doute sur laquelle des deux valeurs faisait foi).
  const salary = viewedNetIncome;

  const income = profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 };
  const waterfallResult = useMemo(() => runWaterfall({ income, envelopes }), [income, envelopes]);

  // Part de la personne affichée dans un montant financé "les deux" — proportionnelle aux
  // revenus, même calcul que prorata_income dans le moteur waterfall.
  const shareForViewedOwner = useMemo(() => {
    if (!profile || !partner) return 0.5;
    const { personA } = orderCouple(profile, partner);
    const total = income.a + income.b;
    if (total <= 0) return 0.5;
    return effectiveOwnerId === personA.id ? income.a / total : income.b / total;
  }, [profile, partner, income, effectiveOwnerId]);

  const actionsForOwner = useMemo(
    () => paydayActions.filter((a) => a.ownerId === effectiveOwnerId).sort((a, b) => a.priority - b.priority),
    [paydayActions, effectiveOwnerId]
  );

  // Traduit chaque action stockée en ce qui doit réellement être passé à runPayday — une action
  // liée à une enveloppe (amount.type === 'envelope') est toujours résolue en un montant concret
  // ici, jamais transmise telle quelle au moteur (voir le throw dans payday/engine.ts).
  const displayActions: DisplayAction[] = useMemo(
    () =>
      actionsForOwner.map((action) => {
        if (action.amount.type !== 'envelope') {
          return {
            id: action.id,
            ownerId: action.ownerId,
            label: action.label,
            description: action.description,
            amountDescription: describeManualAmount(action.amount),
            priority: action.priority,
            isLinked: false,
            runtimeAmount: action.amount,
          };
        }
        const envelope = findEnvelope(envelopes, action.amount.envelopeId);
        if (!envelope) {
          return {
            id: action.id,
            ownerId: action.ownerId,
            label: action.label,
            description: action.description,
            amountDescription: 'Enveloppe supprimée',
            priority: action.priority,
            isLinked: true,
            runtimeAmount: { type: 'fixed', value: 0 },
          };
        }
        const envelopeAmount = findEnvelopeResult(waterfallResult.envelopeResults, envelope.id)?.amount ?? 0;
        const share = envelope.fundedBy === 'both' ? shareForViewedOwner : 1;
        return {
          id: action.id,
          ownerId: action.ownerId,
          label: action.label,
          description: action.description,
          amountDescription: `Suit l'enveloppe ${envelope.emoji} ${envelope.label}`,
          priority: action.priority,
          isLinked: true,
          runtimeAmount: resolveEnvelopeAmount(envelope.allocation, envelopeAmount * share),
        };
      }),
    [actionsForOwner, envelopes, waterfallResult, shareForViewedOwner]
  );

  const overridesNumeric = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [id, text] of Object.entries(overrides)) {
      const n = Number(text.replace(',', '.'));
      if (!Number.isNaN(n)) result[id] = n;
    }
    return result;
  }, [overrides]);

  const runtimeActions: PaydayAction[] = useMemo(
    () =>
      displayActions.map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        priority: d.priority,
        amount: d.runtimeAmount,
      })),
    [displayActions]
  );

  const result = useMemo(
    () => runPayday(salary, runtimeActions, overridesNumeric),
    [salary, runtimeActions, overridesNumeric]
  );

  const totalRequested = result.actionResults.reduce((sum, r) => sum + r.requestedAmount, 0);
  const overflow = round2(totalRequested - salary);
  let summary: { text: string; isOverflow: boolean } | null = null;
  if (overflow > 0.01) {
    summary = { text: `${formatAmountWithPct(overflow, salary)} demandés en trop`, isOverflow: true };
  } else if (result.remainder > 0.01) {
    summary = { text: `${formatAmountWithPct(result.remainder, salary)} non alloué`, isOverflow: false };
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pillContainer}>
        <TouchableOpacity
          style={[styles.pill, effectiveOwnerId === profile?.id && styles.pillSelected]}
          onPress={() => profile && setViewedOwnerId(profile.id)}
        >
          <Text style={[styles.pillText, effectiveOwnerId === profile?.id && styles.pillTextSelected]}>
            Mon salaire
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, effectiveOwnerId === partner?.id && styles.pillSelected]}
          onPress={() => partner && setViewedOwnerId(partner.id)}
        >
          <Text style={[styles.pillText, effectiveOwnerId === partner?.id && styles.pillTextSelected]} numberOfLines={1}>
            Salaire de {partnerLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {Platform.OS !== 'web' && (
        <SectionCard label="Jour de versement">
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Rappel activé</Text>
            <AppSwitch value={reminderEnabled} onValueChange={handleToggleReminder} />
          </View>
          {reminderEnabled && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Jour du mois</Text>
              <View style={styles.stepperRow}>
                <Stepper value={dayValue} onChange={(v) => setPaydayDayText(String(v))} min={1} max={31} />
                {effectiveOwnerId === profile?.id && (
                  <TouchableOpacity
                    style={styles.bellButton}
                    onPress={() => void handleTestNotification()}
                    hitSlop={4}
                  >
                    <Bell size={18} color={ink(0.5)} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <Button
            title={savingDay ? '...' : 'Enregistrer'}
            onPress={() => void handleSavePaydayDay()}
            disabled={savingDay}
            compact
          />
        </SectionCard>
      )}

      {summary && (
        <View style={styles.summaryRow}>
          {summary.isOverflow && <TriangleAlert size={13} color={colors.danger} />}
          <Text style={summary.isOverflow ? styles.overflow : styles.remaining}>{summary.text}</Text>
        </View>
      )}

      {displayActions.length === 0 && !loading && (
        <Text style={styles.empty}>Aucune action pour l'instant.</Text>
      )}

      {displayActions.map((action) => {
        const computed = result.actionResults.find((r) => r.actionId === action.id)?.amount ?? 0;
        const displayText = overrides[action.id] ?? String(computed);
        return (
          <View key={action.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {action.label}
              </Text>
              <Text style={styles.rowDescription}>{action.amountDescription}</Text>
              {action.description !== '' && (
                <Text style={styles.rowNote} numberOfLines={2}>
                  {action.description}
                </Text>
              )}
            </View>

            {action.isLinked ? (
              <Text style={styles.amountReadOnly}>{computed}</Text>
            ) : (
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                value={displayText}
                onChangeText={(text) => setOverrides((prev) => ({ ...prev, [action.id]: text }))}
              />
            )}

            <TouchableOpacity
              style={styles.editZone}
              onPress={() =>
                navigation.navigate('PaydayActionForm', { actionId: action.id, ownerId: action.ownerId })
              }
              hitSlop={8}
            >
              <Pencil size={16} color={ink(0.45)} />
            </TouchableOpacity>
          </View>
        );
      })}

      <Button
        title="+ Ajouter une action"
        onPress={() => effectiveOwnerId && navigation.navigate('PaydayActionForm', { ownerId: effectiveOwnerId })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: colors.section,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  pill: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  pillSelected: { backgroundColor: colors.primary },
  pillText: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: ink(0.55) },
  pillTextSelected: { color: '#fff', fontFamily: fonts.karlaBold },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: ink(0.6) },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  remaining: { fontFamily: fonts.karlaSemiBold, fontSize: 12.5, color: colors.warning },
  overflow: { fontFamily: fonts.karlaBold, fontSize: 12.5, color: colors.danger },
  empty: { fontFamily: fonts.karlaMedium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.karlaBold, fontSize: 14, color: colors.ink },
  rowDescription: { fontFamily: fonts.karlaMedium, fontSize: 11.5, color: ink(0.5), marginTop: 2 },
  rowNote: { fontFamily: fonts.karlaMedium, fontSize: 11.5, color: ink(0.55), fontStyle: 'italic', marginTop: 2 },
  amountInput: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 8,
    fontFamily: fonts.spectralSemiBold,
    fontSize: 15,
    width: 90,
    textAlign: 'right',
    color: colors.ink,
  },
  // Montant dérivé d'une enveloppe : pas de bordure de champ de saisie, pour signaler
  // visuellement que ce n'est pas éditable ici (ça se change depuis l'écran Budget).
  amountReadOnly: { fontFamily: fonts.spectralSemiBold, fontSize: 15, width: 90, textAlign: 'right', color: colors.ink },
  editZone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
