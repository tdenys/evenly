import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown, Check, FlaskConical, Plus, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { runWaterfall } from '@/core/waterfall/engine';
import { applyAllocationOverrides, findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import type { Amount } from '@/core/waterfall/types';
import { describeChildrenSummary, SiblingEnvelopeList } from '@/components/EnvelopeTreeRow';
import SimulationEnvelopeRow from '@/components/SimulationEnvelopeRow';
import PeriodNavigatorCard from '@/components/PeriodNavigatorCard';
import { currentPeriod, formatAmount, formatPct } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { coupleIncome, coupleLabels } from '@/lib/couple';
import { chartSeries, colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import SummaryCard from '@/components/ui/SummaryCard';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Waterfall'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function WaterfallScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const envelopes = useStore((s) => s.envelopes);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const reorderEnvelopeTo = useStore((s) => s.reorderEnvelopeTo);
  const setEnvelopeEnabled = useStore((s) => s.setEnvelopeEnabled);
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const updateEnvelopeGoalBalance = useStore((s) => s.updateEnvelopeGoalBalance);
  const deleteEnvelope = useStore((s) => s.deleteEnvelope);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  // Mois affiché sur Budget — chaque mois a son propre budget indépendant. N'affecte QUE cet
  // écran : Répartition/Abonnements/Historique restent épinglés sur currentPeriod() quel que
  // soit le mois navigué ici (voir CLAUDE.md).
  const [selectedPeriod, setSelectedPeriod] = useState(() => currentPeriod());
  // Mode simulation ("et si") : jamais sauvegardé, purement local à l'écran — revenu simulé +
  // overrides d'allocation par enveloppe, rejoués sur une copie de l'arbre réel via
  // applyAllocationOverrides (voir plus bas). Mutuellement exclusif avec reorderMode : les deux
  // gestes (glisser, taper pour simuler) entreraient en conflit sur les mêmes lignes.
  const [simulationMode, setSimulationMode] = useState(false);
  const [simIncomeAText, setSimIncomeAText] = useState('');
  const [simIncomeBText, setSimIncomeBText] = useState('');
  const [simOverrides, setSimOverrides] = useState<Record<string, Amount>>({});

  // useFocusEffect (pas useEffect) : native-stack garde cet écran monté en arrière-plan quand
  // on va sur "Revenus"/"Enveloppe"/un autre onglet, donc un simple effet "au montage" ne se
  // redéclencherait pas au retour. refresh() recharge aussi profile/partner (donc leur
  // net_income) — sans ça, un revenu que le/la partenaire vient de changer resterait affiché
  // comme périmé.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(selectedPeriod), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, refresh, selectedPeriod])
  );

  const handleChangePeriod = (period: string) => {
    setSelectedPeriod(period);
    setReorderMode(false);
    setSimulationMode(false);
  };

  const income = profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 };
  const result = useMemo(
    () => runWaterfall({ income, envelopes }),
    [income, envelopes]
  );

  const getResult = (id: string) => findEnvelopeResult(result.envelopeResults, id);
  const summary = describeChildrenSummary(result.totalIncome, result.envelopeResults, 'non alloué');

  // Répartition visuelle du revenu entre enveloppes racines actives — palette à 4 couleurs qui
  // boucle (mêmes teintes que le reste de l'app, pas de couleur propre à chaque enveloppe).
  const proportionSegments = useMemo(() => {
    if (result.totalIncome <= 0) return [];
    return envelopes
      .filter((e) => e.enabled)
      .map((e, i) => ({
        id: e.id,
        pct: ((findEnvelopeResult(result.envelopeResults, e.id)?.amount ?? 0) / result.totalIncome) * 100,
        color: chartSeries[i % chartSeries.length],
      }))
      .filter((s) => s.pct > 0.5);
  }, [envelopes, result]);

  // Toujours calculé (même hors simulation) pour que le toggle démarre avec les vrais revenus
  // pré-remplis — coût négligeable, ce sont les mêmes fonctions pures que le reste de l'écran.
  const simIncome = { a: Number(simIncomeAText.replace(',', '.')) || 0, b: Number(simIncomeBText.replace(',', '.')) || 0 };
  const simEnvelopes = useMemo(
    () => applyAllocationOverrides(envelopes, simOverrides),
    [envelopes, simOverrides]
  );
  const simResult = useMemo(
    () => runWaterfall({ income: simIncome, envelopes: simEnvelopes }),
    [simIncome, simEnvelopes]
  );
  const getSimResult = (id: string) => findEnvelopeResult(simResult.envelopeResults, id);

  const handleToggleSimulation = () => {
    setSimulationMode((active) => {
      const next = !active;
      if (next) {
        setReorderMode(false);
        setSimIncomeAText(String(income.a));
        setSimIncomeBText(String(income.b));
        setSimOverrides({});
      }
      return next;
    });
  };

  const handleChangeSimAllocation = (envelopeId: string, allocation: Amount) => {
    setSimOverrides((prev) => ({ ...prev, [envelopeId]: allocation }));
  };

  const personLabels = coupleLabels(profile, partner);
  // Détail par personne sous le total — utile pour comprendre d'où viennent les montants
  // "prorata revenus" (répartis exactement selon ce ratio), pas affiché ailleurs dans l'app.
  const incomeBreakdown =
    profile && partner
      ? [
          { label: `Salaire ${personLabels.A}`, amount: formatAmount(income.a), pct: formatPct(income.a, result.totalIncome) ?? '0%' },
          { label: `Salaire ${personLabels.B}`, amount: formatAmount(income.b), pct: formatPct(income.b, result.totalIncome) ?? '0%' },
        ]
      : undefined;

  const handleReorder = (id: string, targetIndex: number) => {
    reorderEnvelopeTo(id, targetIndex, selectedPeriod).catch((err) => notify('Erreur', errorMessage(err)));
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    setEnvelopeEnabled(id, enabled, selectedPeriod).catch((err) => notify('Erreur', errorMessage(err)));
  };

  // Sauvegarde rapide depuis la pop-up €/% (tap sur le montant d'une ligne) — updateEnvelope
  // exige tous les champs, donc on reconstruit l'input à partir de l'enveloppe déjà en mémoire,
  // seule `allocation` change réellement.
  const handleUpdateAllocation = (id: string, allocation: Amount) => {
    const target = findEnvelope(envelopes, id);
    if (!target) return;
    updateEnvelope(id, {
      label: target.label,
      emoji: target.emoji,
      priority: target.priority,
      allocation,
      enabled: target.enabled,
      fundedBy: target.fundedBy,
      goal: target.goal,
      period: selectedPeriod,
    }).catch((err) => notify('Erreur', errorMessage(err)));
  };

  // Suppression rapide depuis le menu ⋯ d'une ligne (confirmation déjà faite par l'appelant).
  const handleDeleteEnvelope = (id: string) => {
    deleteEnvelope(id, selectedPeriod).catch((err) => notify('Erreur', errorMessage(err)));
  };

  // Mise à jour rapide du solde d'objectif depuis le menu ⋯ (pop-up dédiée) — mutateur direct,
  // pas updateEnvelope complet (même précédent que handleToggleEnabled/setEnvelopeEnabled).
  const handleUpdateGoalBalance = (id: string, current: number) => {
    updateEnvelopeGoalBalance(id, current, selectedPeriod).catch((err) => notify('Erreur', errorMessage(err)));
  };

  // Bouton "+" d'en-tête géré ici (pas dans RootNavigator.tsx) : il doit connaître
  // selectedPeriod, ce qui n'est possible que depuis l'intérieur de cet écran.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }: { tintColor?: string }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EnvelopeForm', { period: selectedPeriod })}
          hitSlop={8}
          style={styles.headerAddButton}
        >
          <Plus size={16} color={tintColor ?? colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, selectedPeriod]);

  return (
    <View style={styles.container}>
      <View style={styles.inset}>
        <PeriodNavigatorCard period={selectedPeriod} onChange={handleChangePeriod} />
      </View>

      <View style={[styles.inset, styles.incomeCard]}>
        <SummaryCard
          label="Revenu total du couple"
          amount={formatAmount(result.totalIncome)}
          breakdown={incomeBreakdown}
          alert={summary ? { text: summary.text, variant: summary.isOverflow ? 'danger' : 'warning' } : null}
          variant="hero"
          onPress={() => navigation.navigate('IncomeForm')}
        />
      </View>

      {proportionSegments.length > 0 && (
        <View style={[styles.inset, styles.proportionBar]}>
          {proportionSegments.map((s) => (
            <View key={s.id} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
          ))}
        </View>
      )}

      <View style={[styles.inset, styles.reorderRow]}>
        {!simulationMode && (
          <TouchableOpacity
            style={styles.reorderButton}
            onPress={() => setReorderMode((m) => !m)}
            hitSlop={8}
          >
            {reorderMode ? (
              <Check size={14} color={colors.primary} />
            ) : (
              <ArrowUpDown size={14} color={ink(0.5)} />
            )}
            <Text style={[styles.reorderToggle, reorderMode && styles.reorderToggleActive]}>
              {reorderMode ? 'Terminer' : 'Réordonner'}
            </Text>
          </TouchableOpacity>
        )}
        {!reorderMode && (
          <TouchableOpacity style={styles.reorderButton} onPress={handleToggleSimulation} hitSlop={8}>
            {simulationMode ? (
              <X size={14} color={colors.primary} />
            ) : (
              <FlaskConical size={14} color={ink(0.5)} />
            )}
            <Text style={[styles.reorderToggle, simulationMode && styles.reorderToggleActive]}>
              {simulationMode ? 'Quitter la simulation' : 'Simulation'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {simulationMode && (
        <View style={[styles.inset, styles.simCard]}>
          <Text style={styles.simHint}>
            Revenus simulés — rien n'est enregistré, ferme la simulation pour revenir aux vraies valeurs.
          </Text>
          <View style={styles.simIncomeRow}>
            <View style={styles.simIncomeField}>
              <Text style={styles.simIncomeLabel}>{personLabels.A}</Text>
              <TextInput
                style={styles.simIncomeInput}
                keyboardType="decimal-pad"
                value={simIncomeAText}
                onChangeText={setSimIncomeAText}
              />
            </View>
            <View style={styles.simIncomeField}>
              <Text style={styles.simIncomeLabel}>{personLabels.B}</Text>
              <TextInput
                style={styles.simIncomeInput}
                keyboardType="decimal-pad"
                value={simIncomeBText}
                onChangeText={setSimIncomeBText}
              />
            </View>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
      >
        {envelopes.length === 0 && !loading && (
          <Text style={[styles.empty, styles.inset]}>Aucune enveloppe pour l'instant.</Text>
        )}
        {simulationMode ? (
          <SimulationEnvelopeRow
            envelopes={simEnvelopes}
            depth={0}
            parentAmount={simResult.totalIncome}
            getResult={getSimResult}
            getRealResult={getResult}
            personLabels={personLabels}
            onChangeAllocation={handleChangeSimAllocation}
          />
        ) : (
          <SiblingEnvelopeList
            envelopes={envelopes}
            depth={0}
            parentAmount={result.totalIncome}
            getResult={getResult}
            personLabels={personLabels}
            onReorder={handleReorder}
            onAddChild={(parentId) => navigation.navigate('EnvelopeForm', { parentId, period: selectedPeriod })}
            onEdit={(envelopeId) => navigation.navigate('EnvelopeForm', { envelopeId, period: selectedPeriod })}
            onToggleEnabled={handleToggleEnabled}
            onUpdateAllocation={handleUpdateAllocation}
            onUpdateGoalBalance={handleUpdateGoalBalance}
            onDelete={handleDeleteEnvelope}
            onDragStateChange={setDragging}
            reorderMode={reorderMode}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 16, paddingBottom: 16 },
  // Le contenu de la liste d'enveloppes doit pouvoir s'étendre d'un bord à l'autre de l'écran
  // (pas de marge droite/gauche) — cette marge horizontale est donc appliquée au cas par cas aux
  // autres éléments (carte de résumé, boutons) plutôt qu'au conteneur entier.
  inset: { marginHorizontal: 16 },
  headerAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.section,
  },
  incomeCard: { marginTop: 16 },
  proportionBar: {
    marginTop: 16,
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: colors.borderSubtle,
  },
  reorderRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16, marginBottom: 4 },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
  },
  reorderToggle: { fontFamily: fonts.bold, fontSize: 12.5, color: ink(0.65) },
  reorderToggleActive: { color: colors.primary },
  simCard: {
    borderRadius: 14,
    backgroundColor: colors.section,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  simHint: { fontFamily: fonts.medium, fontSize: 11.5, color: ink(0.55), fontStyle: 'italic' },
  simIncomeRow: { flexDirection: 'row', gap: 10 },
  simIncomeField: { flex: 1, gap: 4 },
  simIncomeLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: ink(0.55) },
  simIncomeInput: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 10,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.ink,
  },
  // Sur mobile web, un pull vers le bas en haut de la liste peut déclencher le "tirer pour
  // actualiser" natif du navigateur (Chrome/Safari), en plus de notre propre glisser-déposer —
  // overscrollBehaviorY le désactive au niveau CSS (sans effet sur natif/Expo Go).
  scroll: Platform.OS === 'web' ? ({ overscrollBehaviorY: 'contain' } as object) : {},
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { fontFamily: fonts.medium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
});
