import { StyleSheet, Text, View } from 'react-native';
import type { EnvelopeSnapshot } from '@/core/history/types';
import { formatAmount } from '@/lib/format';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  envelopes: EnvelopeSnapshot[];
  depth?: number;
}

// Rendu purement statique d'un arbre figé — pas de menu, pas de drag, pas d'édition, contrairement
// à EnvelopeTreeRow.tsx (trop de logique interactive à neutraliser pour un simple affichage).
export default function HistoryEnvelopeRow({ envelopes, depth = 0 }: Props) {
  return (
    <>
      {envelopes.map((envelope) => (
        <View key={envelope.id}>
          <View style={[styles.row, { paddingLeft: depth * 20 }]}>
            <View style={styles.emojiBadge}>
              <Text style={styles.emojiBadgeText}>{envelope.emoji}</Text>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {envelope.label}
            </Text>
            <Text style={styles.amount}>{formatAmount(envelope.amount)}</Text>
          </View>
          {envelope.children.length > 0 && (
            <HistoryEnvelopeRow envelopes={envelope.children} depth={depth + 1} />
          )}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  emojiBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBadgeText: { fontSize: 16 },
  label: { fontFamily: fonts.medium, fontSize: 13.5, color: ink(0.7), flex: 1 },
  amount: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.ink },
});
