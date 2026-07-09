import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MainStackParamList } from '@/navigation/RootNavigator';
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

type Props = NativeStackScreenProps<MainStackParamList, 'Payday'>;

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
  priority: number;
  description: string;
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
  const [salaryText, setSalaryText] = useState('0');
  // Ajustements ponctuels pour ce dispatch uniquement (jamais persistés) — voir CLAUDE.md :
  // les montants sont modifiables à la main sans changer la règle permanente. N'existe pas pour
  // les actions liées à une enveloppe (montant en lecture seule, dérivé de Waterfall).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [paydayDayText, setPaydayDayText] = useState('');
  const [savingDay, setSavingDay] = useState(false);
  const updateMyPaydayDay = useStore((s) => s.updateMyPaydayDay);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(), loadPaydayActions(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, loadPaydayActions, refresh])
  );

  // Reprogramme silencieusement le rappel local si le jour enregistré a changé ailleurs (ex:
  // après réinstallation de l'app) — seulement si la permission est déjà accordée, sans jamais
  // la demander automatiquement (ça doit toujours venir d'une action explicite).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || !profile?.paydayDay) return;
      getNotificationPermissionGranted().then((granted) => {
        if (granted && profile.paydayDay) void schedulePaydayReminder(profile.paydayDay);
      });
    }, [profile?.paydayDay])
  );

  useEffect(() => {
    setPaydayDayText(profile?.paydayDay ? String(profile.paydayDay) : '');
  }, [profile?.paydayDay]);

  const handleSavePaydayDay = async () => {
    const trimmed = paydayDayText.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 31)) {
      notify('Jour invalide', 'Renseigne un jour entre 1 et 31, ou laisse vide.');
      return;
    }
    setSavingDay(true);
    try {
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

  const effectiveOwnerId = viewedOwnerId ?? profile?.id ?? null;
  const viewedNetIncome = effectiveOwnerId === partner?.id ? (partner?.netIncome ?? 0) : (profile?.netIncome ?? 0);

  // Pré-remplit le salaire avec le revenu net déclaré de la personne affichée — mais seulement
  // si la valeur numérique diverge (ne pas écraser une saisie ponctuelle en cours), même
  // principe que IncomeField dans IncomeScreen.tsx. Change de personne : repart d'une ardoise
  // vierge (les ajustements ponctuels d'un dispatch n'ont pas de sens pour l'autre personne).
  useEffect(() => {
    const numeric = Number(salaryText.replace(',', '.')) || 0;
    if (numeric !== viewedNetIncome) {
      setSalaryText(String(viewedNetIncome));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOwnerId, viewedNetIncome]);

  useEffect(() => {
    setOverrides({});
  }, [effectiveOwnerId]);

  const salary = Number(salaryText.replace(',', '.')) || 0;

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
            priority: action.priority,
            description: describeManualAmount(action.amount),
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
            priority: action.priority,
            description: 'Enveloppe supprimée',
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
          priority: action.priority,
          description: `Suit l'enveloppe ${envelope.emoji} ${envelope.label}`,
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
    () => displayActions.map((d) => ({ id: d.id, label: d.label, priority: d.priority, amount: d.runtimeAmount })),
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
    summary = { text: `⚠️ ${formatAmountWithPct(overflow, salary)} demandés en trop`, isOverflow: true };
  } else if (result.remainder > 0.01) {
    summary = { text: `${formatAmountWithPct(result.remainder, salary)} non alloué`, isOverflow: false };
  }

  const partnerLabel = partner?.displayName ?? 'ton/ta partenaire';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, effectiveOwnerId === profile?.id && styles.tabSelected]}
          onPress={() => profile && setViewedOwnerId(profile.id)}
        >
          <Text style={[styles.tabText, effectiveOwnerId === profile?.id && styles.tabTextSelected]}>
            Mon salaire
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, effectiveOwnerId === partner?.id && styles.tabSelected]}
          onPress={() => partner && setViewedOwnerId(partner.id)}
        >
          <Text style={[styles.tabText, effectiveOwnerId === partner?.id && styles.tabTextSelected]}>
            Salaire de {partnerLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {Platform.OS !== 'web' && effectiveOwnerId === profile?.id && (
        <View style={styles.reminderBlock}>
          <Text style={styles.label}>Jour de versement (1-31)</Text>
          <View style={styles.reminderRow}>
            <TextInput
              style={styles.dayInput}
              keyboardType="number-pad"
              placeholder="ex: 28"
              value={paydayDayText}
              onChangeText={setPaydayDayText}
            />
            <TouchableOpacity
              style={styles.reminderButton}
              onPress={() => void handleSavePaydayDay()}
              disabled={savingDay}
            >
              <Text style={styles.reminderButtonText}>{savingDay ? '...' : 'Enregistrer'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderButton} onPress={() => void handleTestNotification()}>
              <Text style={styles.reminderButtonText}>🔔 Tester</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.label}>Montant du salaire</Text>
      <TextInput style={styles.salaryInput} keyboardType="decimal-pad" value={salaryText} onChangeText={setSalaryText} />

      {summary && (
        <Text style={summary.isOverflow ? styles.overflow : styles.remaining}>{summary.text}</Text>
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
              <Text style={styles.rowDescription}>{action.description}</Text>
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
              onPress={() =>
                navigation.navigate('PaydayActionForm', { actionId: action.id, ownerId: action.ownerId })
              }
              hitSlop={8}
            >
              <Text style={styles.edit}>✏️</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => effectiveOwnerId && navigation.navigate('PaydayActionForm', { ownerId: effectiveOwnerId })}
      >
        <Text style={styles.addButtonText}>+ Ajouter une action</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabSelected: { backgroundColor: '#2563eb' },
  tabText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  tabTextSelected: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  reminderBlock: { marginBottom: 16 },
  reminderRow: { flexDirection: 'row', gap: 8 },
  dayInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    width: 70,
  },
  reminderButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  reminderButtonText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  salaryInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  remaining: { fontSize: 13, color: '#b45309', marginBottom: 12 },
  overflow: { fontSize: 13, color: '#dc2626', fontWeight: '600', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDescription: { fontSize: 12, color: '#888', marginTop: 2 },
  amountInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    fontWeight: '700',
    width: 90,
    textAlign: 'right',
  },
  // Montant dérivé d'une enveloppe : pas de bordure de champ de saisie, pour signaler
  // visuellement que ce n'est pas éditable ici (ça se change depuis l'écran Budget).
  amountReadOnly: { fontSize: 15, fontWeight: '700', width: 90, textAlign: 'right' },
  edit: { fontSize: 15 },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
