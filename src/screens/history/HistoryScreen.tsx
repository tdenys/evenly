import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '@/store/useStore';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { currentPeriod, formatAmount, formatPeriodLabel } from '@/lib/format';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';
import HistoryEnvelopeRow from '@/components/HistoryEnvelopeRow';

export default function HistoryScreen() {
  const history = useStore((s) => s.history);
  const loadHistory = useStore((s) => s.loadHistory);
  const loadEnvelopes = useStore((s) => s.loadEnvelopes);
  const refresh = useStore((s) => s.refresh);
  const closeCurrentMonth = useStore((s) => s.closeCurrentMonth);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadHistory(), loadEnvelopes(currentPeriod()), refresh()])
        .catch((err) => notify('Erreur', errorMessage(err)))
        .finally(() => setLoading(false));
    }, [loadHistory, loadEnvelopes, refresh])
  );

  const period = currentPeriod();
  const alreadyClosed = useMemo(() => history.some((h) => h.period === period), [history, period]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await closeCurrentMonth();
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = (id: string, label: string) => {
    confirmAction('Supprimer cet instantané', `Supprimer la clôture de ${label} ?`, async () => {
      try {
        await deleteSnapshot(id);
      } catch (err) {
        notify('Erreur', errorMessage(err));
      }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button
        title={
          closing
            ? '...'
            : alreadyClosed
              ? `Mois déjà clôturé — Mettre à jour ${formatPeriodLabel(period)}`
              : `Clôturer ${formatPeriodLabel(period)}`
        }
        onPress={() => void handleClose()}
        disabled={closing}
        variant={alreadyClosed ? 'outline' : 'primary'}
      />

      {history.length === 0 && !loading && (
        <Text style={styles.empty}>Aucun mois clôturé pour l'instant.</Text>
      )}

      {history.map((snapshot) => {
        const expanded = expandedId === snapshot.id;
        const label = formatPeriodLabel(snapshot.period);
        return (
          <View key={snapshot.id} style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setExpandedId(expanded ? null : snapshot.id)}
              activeOpacity={0.7}
            >
              {expanded ? (
                <ChevronDown size={16} color={ink(0.45)} />
              ) : (
                <ChevronRight size={16} color={ink(0.45)} />
              )}
              <Text style={styles.rowLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.rowAmount}>{formatAmount(snapshot.totalIncome)}</Text>
              <TouchableOpacity onPress={() => handleDelete(snapshot.id, label)} hitSlop={8}>
                <Trash2 size={16} color={colors.danger} />
              </TouchableOpacity>
            </TouchableOpacity>
            {expanded && (
              <View style={styles.detail}>
                <HistoryEnvelopeRow envelopes={snapshot.envelopes} />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  empty: { fontFamily: fonts.medium, textAlign: 'center', color: ink(0.4), marginTop: 32 },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.section,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  rowLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textTransform: 'capitalize' },
  rowAmount: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink },
  detail: { paddingHorizontal: 14, paddingBottom: 10 },
});
