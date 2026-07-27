import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { currentPeriod, formatPeriodLabel, shiftPeriod } from '@/lib/format';

const MONTHS_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

/** Jour du mois courant / nombre de jours du mois de `period` — 100% pour un mois déjà passé,
 * 0% pour un mois futur, calculé pour de vrai (jamais de valeurs figées) contrairement au mock. */
function monthProgressPct(period: string): number {
  const cur = currentPeriod();
  if (period !== cur) return period < cur ? 100 : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.round((now.getDate() / daysInMonth) * 100);
}

interface Props {
  period: string;
  onChange: (period: string) => void;
}

/**
 * Carte calendrier de l'onglet Budget : navigation mois précédent/suivant, indicateur de
 * progression dans le mois, et sélecteur année/mois dépliable. Fond plat à l'accent (pas de
 * dégradé, ni de variante "subtle" — un seul style, contrairement au composant de design
 * d'origine qui l'exposait comme réglage de prévisualisation).
 */
export default function PeriodNavigatorCard({ period, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(period.split('-')[0]));

  const isCurrent = period === currentPeriod();
  const [year, month] = period.split('-').map(Number);

  const goTo = (next: string) => {
    onChange(next);
    setPickerOpen(false);
  };

  const togglePicker = () => {
    setPickerOpen((open) => {
      if (!open) setPickerYear(year);
      return !open;
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(shiftPeriod(period, -1))} hitSlop={8}>
          <ChevronLeft size={19} color={colors.surface} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.labelButton} onPress={togglePicker} hitSlop={4}>
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>
              {formatPeriodLabel(period)}
            </Text>
            <ChevronDown size={13} color={withOpacity(colors.surface, 0.65)} />
          </View>
          {isCurrent && <Text style={styles.badge}>Mois en cours</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(shiftPeriod(period, 1))} hitSlop={8}>
          <ChevronRight size={19} color={colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${monthProgressPct(period)}%` }]} />
      </View>

      {!isCurrent && (
        <TouchableOpacity style={styles.todayLink} onPress={() => goTo(currentPeriod())}>
          <Text style={styles.todayLinkText}>revenir à aujourd'hui</Text>
        </TouchableOpacity>
      )}

      {pickerOpen && (
        <View style={styles.picker}>
          <View style={styles.pickerYearRow}>
            <TouchableOpacity style={styles.yearArrow} onPress={() => setPickerYear((y) => y - 1)} hitSlop={6}>
              <ChevronLeft size={13} color={colors.surface} />
            </TouchableOpacity>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <TouchableOpacity style={styles.yearArrow} onPress={() => setPickerYear((y) => y + 1)} hitSlop={6}>
              <ChevronRight size={13} color={colors.surface} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerGrid}>
            {MONTHS_SHORT.map((short, i) => {
              const active = pickerYear === year && i === month - 1;
              return (
                <TouchableOpacity
                  key={short}
                  style={[styles.pickerMonth, active ? styles.pickerMonthActive : styles.pickerMonthInactive]}
                  onPress={() => goTo(`${pickerYear}-${String(i + 1).padStart(2, '0')}-01`)}
                >
                  <Text style={[styles.pickerMonthText, active && styles.pickerMonthTextActive]}>{short}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity('#FFFFFF', 0.16),
  },
  labelButton: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.surface, textTransform: 'capitalize' },
  badge: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.surface,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  track: {
    marginTop: 10,
    marginHorizontal: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: withOpacity('#FFFFFF', 0.25),
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.surface },
  todayLink: { alignItems: 'center', marginTop: 6 },
  todayLinkText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: withOpacity(colors.surface, 0.75),
    textDecorationLine: 'underline',
  },
  picker: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: withOpacity('#FFFFFF', 0.14) },
  pickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  yearArrow: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity('#FFFFFF', 0.16),
  },
  pickerYearText: { fontFamily: fonts.extraBold, fontSize: 13.5, color: colors.surface },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  pickerMonth: { width: '23%', height: 33, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pickerMonthActive: { backgroundColor: colors.surface },
  pickerMonthInactive: { borderWidth: 1, borderColor: withOpacity('#FFFFFF', 0.35) },
  pickerMonthText: { fontFamily: fonts.semiBold, fontSize: 11.5, color: colors.surface },
  pickerMonthTextActive: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },
});
