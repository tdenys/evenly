import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Amount, Envelope, EnvelopeResult } from '@/core/waterfall/types';
import { describeAllocation, type PersonLabels } from './EnvelopeTreeRow';
import AmountEditor from './AmountEditor';
import { formatAmount, formatPct } from '@/lib/format';
import { colors, ink, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  envelopes: Envelope[];
  depth: number;
  parentAmount: number;
  getResult: (id: string) => EnvelopeResult | undefined;
  getRealResult: (id: string) => EnvelopeResult | undefined;
  personLabels: PersonLabels;
  onChangeAllocation: (envelopeId: string, allocation: Amount) => void;
}

/** Rendu dédié au mode simulation ("et si") — pas une variante de EnvelopeTreeRow.tsx : ici pas
 * de drag, pas de menu ⋯, pas de suppression/désactivation possible (rien de ce qui s'affiche
 * n'est jamais sauvegardé), juste un montant simulé + son écart avec le vrai montant, et un tap
 * pour rejouer AmountEditor (le même composant que le formulaire complet, qui couvre les 4 types
 * d'allocation) sur un état 100% local à l'écran. Toujours affiché déplié (pas de chevron) —
 * l'exploration "et si" bénéficie de voir toute la cascade d'un coup d'œil. */
export default function SimulationEnvelopeRow({
  envelopes,
  depth,
  parentAmount,
  getResult,
  getRealResult,
  personLabels,
  onChangeAllocation,
}: Props) {
  return (
    <View>
      {envelopes.map((envelope) => (
        <SimulationRow
          key={envelope.id}
          envelope={envelope}
          depth={depth}
          parentAmount={parentAmount}
          getResult={getResult}
          getRealResult={getRealResult}
          personLabels={personLabels}
          onChangeAllocation={onChangeAllocation}
        />
      ))}
    </View>
  );
}

function SimulationRow({
  envelope,
  depth,
  parentAmount,
  getResult,
  getRealResult,
  personLabels,
  onChangeAllocation,
}: {
  envelope: Envelope;
  depth: number;
  parentAmount: number;
  getResult: (id: string) => EnvelopeResult | undefined;
  getRealResult: (id: string) => EnvelopeResult | undefined;
  personLabels: PersonLabels;
  onChangeAllocation: (envelopeId: string, allocation: Amount) => void;
}) {
  const [editing, setEditing] = useState(false);

  const amount = getResult(envelope.id)?.amount ?? 0;
  const realAmount = getRealResult(envelope.id)?.amount ?? 0;
  const delta = Math.round((amount - realAmount) * 100) / 100;
  const pct = formatPct(amount, parentAmount);

  return (
    <View>
      <TouchableOpacity
        style={[styles.row, { paddingLeft: 16 + depth * 20 }]}
        onPress={() => setEditing(true)}
        activeOpacity={0.7}
      >
        <View style={styles.textBlock}>
          <View style={styles.main}>
            <Text style={styles.label} numberOfLines={1}>
              {envelope.emoji} {envelope.label}
            </Text>
            <Text style={styles.amount}>{formatAmount(amount)}</Text>
          </View>
          <View style={styles.descriptionRow}>
            <Text style={styles.description} numberOfLines={1}>
              {describeAllocation(envelope.allocation, personLabels)}
            </Text>
            <View style={styles.descriptionRight}>
              {Math.abs(delta) > 0.01 && (
                <Text style={[styles.delta, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                  {delta > 0 ? '+' : '−'}
                  {formatAmount(Math.abs(delta))}
                </Text>
              )}
              {pct && <Text style={styles.pct}>{pct}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {envelope.children.length > 0 && (
        <SimulationEnvelopeRow
          envelopes={envelope.children}
          depth={depth + 1}
          parentAmount={amount}
          getResult={getResult}
          getRealResult={getRealResult}
          personLabels={personLabels}
          onChangeAllocation={onChangeAllocation}
        />
      )}

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditing(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {envelope.emoji} {envelope.label}
              </Text>
              <AmountEditor
                value={envelope.allocation}
                onChange={(allocation) => onChangeAllocation(envelope.id, allocation)}
                personLabels={personLabels}
              />
              <TouchableOpacity style={styles.modalDone} onPress={() => setEditing(false)} hitSlop={6}>
                <Text style={styles.modalDoneText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  textBlock: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  amount: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink },
  descriptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  description: { fontFamily: fonts.medium, fontSize: 11.5, color: ink(0.5), flexShrink: 1 },
  descriptionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delta: { fontFamily: fonts.bold, fontSize: 11.5 },
  deltaUp: { color: colors.primary },
  deltaDown: { color: colors.danger },
  pct: { fontFamily: fonts.medium, fontSize: 11.5, color: ink(0.5) },
  modalRoot: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.ink, 0.45),
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 14, backgroundColor: colors.surface, padding: 18, gap: 12 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginBottom: 2 },
  modalDone: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 4 },
  modalDoneText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
});
