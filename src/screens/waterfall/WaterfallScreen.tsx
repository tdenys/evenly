import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown, Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { runWaterfall } from '@/core/waterfall/engine';
import { findEnvelope, findEnvelopeResult } from '@/core/waterfall/tree';
import type { Amount } from '@/core/waterfall/types';
import { describeChildrenSummary, SiblingEnvelopeList } from '@/components/EnvelopeTreeRow';
import { formatAmount, formatPct } from '@/lib/format';
import { errorMessage, notify } from '@/lib/alert';
import { coupleIncome, coupleLabels } from '@/lib/couple';
import { colors, ink } from '@/theme/colors';
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
  const deleteEnvelope = useStore((s) => s.deleteEnvelope);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // useFocusEffect (pas useEffect) : native-stack garde cet écran monté en arrière-plan quand
  // on va sur "Revenus"/"Enveloppe"/un autre onglet, donc un simple effet "au montage" ne se
  // redéclencherait pas au retour. refresh() recharge aussi profile/partner (donc leur
  // net_income) — sans ça, un revenu que le/la partenaire vient de changer resterait affiché
  // comme périmé.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadEnvelopes(), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadEnvelopes, refresh])
  );

  const income = profile && partner ? coupleIncome(profile, partner) : { a: 0, b: 0 };
  const result = useMemo(
    () => runWaterfall({ income, envelopes }),
    [income, envelopes]
  );

  const getResult = (id: string) => findEnvelopeResult(result.envelopeResults, id);
  const summary = describeChildrenSummary(result.totalIncome, result.envelopeResults, 'non alloué');

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
    reorderEnvelopeTo(id, targetIndex).catch((err) => notify('Erreur', errorMessage(err)));
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    setEnvelopeEnabled(id, enabled).catch((err) => notify('Erreur', errorMessage(err)));
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
    }).catch((err) => notify('Erreur', errorMessage(err)));
  };

  // Suppression rapide depuis le menu ⋯ d'une ligne (confirmation déjà faite par l'appelant).
  const handleDeleteEnvelope = (id: string) => {
    deleteEnvelope(id).catch((err) => notify('Erreur', errorMessage(err)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.inset}>
        <SummaryCard
          label="Revenu total du couple"
          amount={formatAmount(result.totalIncome)}
          breakdown={incomeBreakdown}
          alert={summary ? { text: summary.text, variant: summary.isOverflow ? 'danger' : 'warning' } : null}
          variant="hero"
          onPress={() => navigation.navigate('IncomeForm')}
        />
      </View>

      <View style={[styles.inset, styles.reorderRow]}>
        <TouchableOpacity style={styles.reorderButton} onPress={() => setReorderMode((m) => !m)} hitSlop={8}>
          {reorderMode ? (
            <Check size={14} color={colors.primary} />
          ) : (
            <ArrowUpDown size={14} color={ink(0.5)} />
          )}
          <Text style={[styles.reorderToggle, reorderMode && styles.reorderToggleActive]}>
            {reorderMode ? 'Terminer' : 'Réordonner'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
      >
        {envelopes.length === 0 && !loading && (
          <Text style={[styles.empty, styles.inset]}>Aucune enveloppe pour l'instant.</Text>
        )}
        <SiblingEnvelopeList
          envelopes={envelopes}
          depth={0}
          parentAmount={result.totalIncome}
          getResult={getResult}
          personLabels={personLabels}
          onReorder={handleReorder}
          onAddChild={(parentId) => navigation.navigate('EnvelopeForm', { parentId })}
          onEdit={(envelopeId) => navigation.navigate('EnvelopeForm', { envelopeId })}
          onToggleEnabled={handleToggleEnabled}
          onUpdateAllocation={handleUpdateAllocation}
          onDelete={handleDeleteEnvelope}
          onDragStateChange={setDragging}
          reorderMode={reorderMode}
        />
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
  reorderRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, marginBottom: 4 },
  reorderButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reorderToggle: { fontFamily: fonts.karlaBold, fontSize: 12.5, color: ink(0.5) },
  reorderToggleActive: { color: colors.primary },
  // Sur mobile web, un pull vers le bas en haut de la liste peut déclencher le "tirer pour
  // actualiser" natif du navigateur (Chrome/Safari), en plus de notre propre glisser-déposer —
  // overscrollBehaviorY le désactive au niveau CSS (sans effet sur natif/Expo Go).
  scroll: Platform.OS === 'web' ? ({ overscrollBehaviorY: 'contain' } as object) : {},
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { fontFamily: fonts.karlaMedium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
});
