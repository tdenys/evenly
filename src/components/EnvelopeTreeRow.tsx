import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Amount, Envelope, EnvelopeResult } from '@/core/waterfall/types';
import { summarizeChildren } from '@/core/waterfall/tree';
import { formatAmount, formatAmountWithPct, formatPct } from '@/lib/format';
import { notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import AppSwitch from '@/components/ui/AppSwitch';

export interface PersonLabels {
  A: string;
  B: string;
}

// "fixed"/"percent_envelope" ne répètent plus leur chiffre ici (il vit désormais dans les 2
// valeurs € (ligne du haut) / % (badge pct, toujours affiché — voir plus bas) affichées côte à
// côte pour ces 2 types) : le répéter dans la description gaspillerait de la largeur pour une
// info déjà visible ailleurs sur la ligne.
function describeAllocation(amount: Amount, personLabels: PersonLabels): string {
  switch (amount.type) {
    case 'fixed':
      return 'Montant fixe';
    case 'percent_envelope':
      return '% du revenu';
    case 'percent_remaining':
      return `${amount.pct}% du reste`;
    case 'prorata_income':
      return `Prorata revenus (${personLabels[amount.who]})`;
  }
}

// "fixed"/"percent_envelope" partagent la même base de calcul (parentAmount) donc la conversion
// €↔% est exacte dans les 2 sens — seuls ces 2 types sont éditables en tapant sur le montant
// (voir le formulaire complet pour "% du reste"/"prorata revenus", qui restent inchangés).
function editableAmount(amount: Amount): boolean {
  return amount.type === 'fixed' || amount.type === 'percent_envelope';
}

/** Ligne "reste à placer" / avertissement de dépassement sous une liste d'enfants — le
 * dépassement prime (c'est le signal le plus important), sinon le reste si non nul, sinon rien
 * (déjà entièrement alloué). Le % est toujours relatif à `parentAmount` (le pool direct).
 * `remainingLabel` distingue le libellé selon le contexte : "non alloué" pour le revenu total à
 * la racine, "restant" pour le budget encore disponible dans une enveloppe. */
export function describeChildrenSummary(
  parentAmount: number,
  children: EnvelopeResult[],
  remainingLabel = 'restant'
): { text: string; isOverflow: boolean } | null {
  const summary = summarizeChildren(parentAmount, children);
  if (summary.overflow > 0.01) {
    return { text: `⚠️ ${formatAmountWithPct(summary.overflow, parentAmount)} demandés en trop`, isOverflow: true };
  }
  if (summary.remaining > 0.01) {
    return { text: `${formatAmountWithPct(summary.remaining, parentAmount)} ${remainingLabel}`, isOverflow: false };
  }
  return null;
}

interface ListProps {
  envelopes: Envelope[];
  depth: number;
  /** Pool direct dont ces enveloppes sœurs tirent leur part — le revenu total à la racine, ou
   * le montant de l'enveloppe parente pour des sous-enveloppes. Sert à afficher le % à côté du
   * montant de chaque ligne, et de base de conversion €↔% dans la pop-up d'édition. */
  parentAmount: number;
  getResult: (id: string) => EnvelopeResult | undefined;
  personLabels: PersonLabels;
  onReorder: (id: string, targetIndex: number) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (envelopeId: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  /** Sauvegarde rapide de l'allocation depuis la pop-up €/% (tap sur le montant) — distinct de
   * onEdit qui ouvre le formulaire complet. */
  onUpdateAllocation: (envelopeId: string, allocation: Amount) => void;
  /** Remonté jusqu'à l'écran pour désactiver le ScrollView pendant qu'un glissé est actif —
   * sinon les deux gestes entrent en conflit. */
  onDragStateChange?: (dragging: boolean) => void;
  /** Mode réordonnancement dédié : poignée de glisser visible uniquement dans ce mode ; switch
   * actif/inactif et crayon d'édition masqués pendant ce mode pour éviter les taps accidentels
   * en plein glisser. */
  reorderMode: boolean;
}

// Détermine de combien de positions un déplacement vertical (dy, en pixels) fait franchir
// l'élément glissé, en comparant contre les hauteurs réelles mesurées de ses voisins (pas une
// hauteur fixe supposée) — nécessaire ici car un voisin déplié (sous-enveloppes visibles) est
// plus haut qu'un voisin replié.
function computeTargetIndex(startIndex: number, dy: number, heights: number[]): number {
  let index = startIndex;
  if (dy > 0) {
    let remaining = dy;
    while (index < heights.length - 1) {
      const nextHeight = heights[index + 1] ?? 0;
      if (nextHeight <= 0 || remaining < nextHeight / 2) break;
      remaining -= nextHeight;
      index += 1;
    }
  } else if (dy < 0) {
    let remaining = -dy;
    while (index > 0) {
      const prevHeight = heights[index - 1] ?? 0;
      if (prevHeight <= 0 || remaining < prevHeight / 2) break;
      remaining -= prevHeight;
      index -= 1;
    }
  }
  return index;
}

/**
 * Liste d'enveloppes sœurs, réordonnable par glisser-déposer depuis la poignée dédiée de
 * chaque ligne (pas depuis toute la ligne : sur web, réserver le toucher pour un drag potentiel
 * empêche le navigateur de scroller avec, même si le drag n'est finalement pas activé — plus il
 * y a de lignes dépliées, plus ça bloque le scroll. La poignée reste large pour rester facile à
 * viser au pouce).
 */
export function SiblingEnvelopeList({
  envelopes,
  depth,
  parentAmount,
  getResult,
  personLabels,
  onReorder,
  onAddChild,
  onEdit,
  onToggleEnabled,
  onUpdateAllocation,
  onDragStateChange,
  reorderMode,
}: ListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const heightsRef = useRef<Map<string, number>>(new Map());
  const dragStartIndexRef = useRef(0);

  const panResponderFor = (envelope: Envelope, index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartIndexRef.current = index;
        setDraggingId(envelope.id);
        dragY.setValue(0);
        onDragStateChange?.(true);
      },
      onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gestureState) => {
        const heights = envelopes.map((e) => heightsRef.current.get(e.id) ?? 0);
        const targetIndex = computeTargetIndex(dragStartIndexRef.current, gestureState.dy, heights);
        setDraggingId(null);
        dragY.setValue(0);
        onDragStateChange?.(false);
        if (targetIndex !== dragStartIndexRef.current) {
          onReorder(envelope.id, targetIndex);
        }
      },
      onPanResponderTerminate: () => {
        setDraggingId(null);
        dragY.setValue(0);
        onDragStateChange?.(false);
      },
    });

  return (
    <View>
      {envelopes.map((envelope, index) => {
        const isDragging = draggingId === envelope.id;
        return (
          <EnvelopeTreeRowContainer
            key={envelope.id}
            envelope={envelope}
            depth={depth}
            isDragging={isDragging}
            dragY={dragY}
            parentAmount={parentAmount}
            getResult={getResult}
            personLabels={personLabels}
            onReorder={onReorder}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onToggleEnabled={onToggleEnabled}
            onUpdateAllocation={onUpdateAllocation}
            onDragStateChange={onDragStateChange}
            onLayoutHeight={(height) => heightsRef.current.set(envelope.id, height)}
            dragHandlers={panResponderFor(envelope, index).panHandlers}
            reorderMode={reorderMode}
          />
        );
      })}
    </View>
  );
}

interface ContainerProps {
  envelope: Envelope;
  depth: number;
  isDragging: boolean;
  dragY: Animated.Value;
  parentAmount: number;
  getResult: (id: string) => EnvelopeResult | undefined;
  personLabels: PersonLabels;
  onReorder: (id: string, targetIndex: number) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (envelopeId: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onUpdateAllocation: (envelopeId: string, allocation: Amount) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onLayoutHeight: (height: number) => void;
  dragHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  reorderMode: boolean;
}

function EnvelopeTreeRowContainer({
  envelope,
  depth,
  isDragging,
  dragY,
  parentAmount,
  getResult,
  personLabels,
  onReorder,
  onAddChild,
  onEdit,
  onToggleEnabled,
  onUpdateAllocation,
  onDragStateChange,
  onLayoutHeight,
  dragHandlers,
  reorderMode,
}: ContainerProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [eurText, setEurText] = useState('');
  const [pctText, setPctText] = useState('');
  const [lastEdited, setLastEdited] = useState<'eur' | 'pct'>('eur');
  // `autoFocus` (et même `onShow` de la Modal, pas fiable sur Android) ne suffit pas toujours à
  // déclencher le clavier dans une Modal — la fenêtre native du Modal doit avoir fini de
  // s'attacher avant qu'un focus() ait un effet réel. Un court délai après le montage force le
  // focus une fois la Modal réellement prête à le recevoir.
  const eurInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!editingAmount) return;
    const timeout = setTimeout(() => eurInputRef.current?.focus(), 200);
    return () => clearTimeout(timeout);
  }, [editingAmount]);

  const result = getResult(envelope.id);
  const amount = result?.amount ?? 0;
  // Toujours affiché, quel que soit le type — même pour "% du reste" où c'est un repère
  // différent du pourcentage embarqué dans le libellé (celui-ci est relatif au reste courant,
  // celui-ci est relatif au total du pool, comme pour les autres lignes).
  const pct = formatPct(amount, parentAmount);
  // Limité à 2 niveaux (voir "+ Ajouter une sous-enveloppe" masqué au-delà de depth 0) : une
  // sous-enveloppe ne peut plus rien contenir, donc pas de chevron/dépliage pour elle.
  const canExpand = depth === 0;
  const summary = expanded ? describeChildrenSummary(amount, result?.children ?? []) : null;
  const canEditAmount = editableAmount(envelope.allocation) && !reorderMode;

  const openAmountEditor = () => {
    const pctValue = parentAmount > 0 ? (amount / parentAmount) * 100 : 0;
    setEurText(amount.toFixed(2));
    setPctText(pctValue.toFixed(2));
    setLastEdited(envelope.allocation.type === 'percent_envelope' ? 'pct' : 'eur');
    setEditingAmount(true);
  };

  const closeAmountEditor = () => setEditingAmount(false);

  const handleEurChange = (raw: string) => {
    setEurText(raw);
    setLastEdited('eur');
    if (parentAmount > 0) {
      const n = Number(raw.replace(',', '.'));
      if (!Number.isNaN(n)) setPctText(((n / parentAmount) * 100).toFixed(2));
    }
  };

  const handlePctChange = (raw: string) => {
    setPctText(raw);
    setLastEdited('pct');
    const n = Number(raw.replace(',', '.'));
    if (!Number.isNaN(n)) setEurText(((n / 100) * parentAmount).toFixed(2));
  };

  const handleSaveAmount = () => {
    if (lastEdited === 'eur') {
      const n = Number(eurText.replace(',', '.'));
      if (Number.isNaN(n) || n < 0) {
        notify('Montant invalide', 'Renseigne un montant en € valide.');
        return;
      }
      onUpdateAllocation(envelope.id, { type: 'fixed', value: n });
    } else {
      const n = Number(pctText.replace(',', '.'));
      if (Number.isNaN(n) || n < 0) {
        notify('Pourcentage invalide', 'Renseigne un pourcentage valide.');
        return;
      }
      onUpdateAllocation(envelope.id, { type: 'percent_envelope', pct: n });
    }
    setEditingAmount(false);
  };

  const RowWrapper = canExpand ? TouchableOpacity : View;

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}
      style={isDragging ? [styles.dragging, { transform: [{ translateY: dragY }] }] : undefined}
    >
      <View style={[styles.row, { paddingLeft: 16 + depth * 20 }, !envelope.enabled && styles.rowDisabled]}>
        <RowWrapper style={styles.rowContent} {...(canExpand ? { onPress: () => setExpanded((e) => !e) } : null)}>
          <View style={styles.rowOuter}>
            {/* Libellé et description forment 2 lignes de même largeur (textBlock) — le montant
                et le % sont chacun casés en bout de leur ligne, ce qui les aligne verticalement
                sans ajouter de 3e ligne : le switch/crayon sont HORS de ce bloc, à droite,
                partagés par les 2 lignes plutôt que dupliqués sur une ligne à eux. */}
            <View style={styles.textBlock}>
              <View style={styles.main}>
                <Text style={styles.chevron}>{canExpand ? (expanded ? '▾' : '▸') : ''}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {envelope.emoji} {envelope.label}
                </Text>
                {canEditAmount ? (
                  <TouchableOpacity
                    onPress={openAmountEditor}
                    hitSlop={6}
                    {...(Platform.OS === 'web'
                      ? { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() }
                      : null)}
                  >
                    <Text style={[styles.amount, styles.amountEditable]}>{formatAmount(amount)}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.amount}>{formatAmount(amount)}</Text>
                )}
              </View>

              <View style={styles.descriptionRow}>
                <Text style={styles.description} numberOfLines={1}>
                  {describeAllocation(envelope.allocation, personLabels)}
                  {!envelope.enabled && ' · Désactivée'}
                </Text>
                {pct && <Text style={styles.pct}>{pct}</Text>}
              </View>
            </View>

            {!reorderMode && (
              <>
                <AppSwitch value={envelope.enabled} onValueChange={(value) => onToggleEnabled(envelope.id, value)} />
                <TouchableOpacity style={styles.editZone} onPress={() => onEdit(envelope.id)} hitSlop={8}>
                  <Text style={styles.edit}>✏️</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </RowWrapper>

        {reorderMode && (
          <View style={styles.grip} {...dragHandlers}>
            <Text style={styles.gripText}>⠿</Text>
          </View>
        )}
      </View>

      {canEditAmount && (
        <Modal visible={editingAmount} transparent animationType="fade" onRequestClose={closeAmountEditor}>
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalBackdrop}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAmountEditor} />
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {envelope.emoji} {envelope.label}
                </Text>
                <View style={styles.amountEditorField}>
                  <Text style={styles.amountEditorUnit}>€</Text>
                  <TextInput
                    ref={eurInputRef}
                    style={styles.amountEditorInput}
                    keyboardType="decimal-pad"
                    value={eurText}
                    onChangeText={handleEurChange}
                  />
                </View>
                <View style={styles.amountEditorField}>
                  <Text style={styles.amountEditorUnit}>%</Text>
                  <TextInput
                    style={styles.amountEditorInput}
                    keyboardType="decimal-pad"
                    value={pctText}
                    onChangeText={handlePctChange}
                  />
                </View>
                <View style={styles.amountEditorActions}>
                  <TouchableOpacity onPress={closeAmountEditor} hitSlop={6}>
                    <Text style={styles.amountEditorCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveAmount} hitSlop={6}>
                    <Text style={styles.amountEditorSave}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {expanded && (
        <View>
          <SiblingEnvelopeList
            envelopes={envelope.children}
            depth={depth + 1}
            parentAmount={amount}
            getResult={getResult}
            personLabels={personLabels}
            onReorder={onReorder}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onToggleEnabled={onToggleEnabled}
            onUpdateAllocation={onUpdateAllocation}
            onDragStateChange={onDragStateChange}
            reorderMode={reorderMode}
          />
          {summary && (
            <Text
              style={[
                styles.summary,
                { marginLeft: 16 + (depth + 1) * 20 },
                summary.isOverflow && styles.summaryOverflow,
              ]}
            >
              {summary.text}
            </Text>
          )}
          {/* Limité à 2 niveaux pour l'instant (enveloppes/sous-enveloppes) — pas de sous-sous-
              enveloppe, donc ce bouton n'apparaît que sur une enveloppe racine (depth 0). */}
          {depth === 0 && (
            <TouchableOpacity
              style={[styles.addChild, { marginLeft: 16 + (depth + 1) * 20 }]}
              onPress={() => onAddChild(envelope.id)}
            >
              <Text style={styles.addChildText}>+ Ajouter une sous-enveloppe</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowDisabled: { opacity: 0.5 },
  rowContent: {
    flex: 1,
    paddingVertical: 8,
    // Sur web, glisser la souris sur du texte déclenche la sélection native du navigateur —
    // sans rapport avec notre geste de drag, juste un artefact visuel du navigateur à éviter.
    userSelect: 'none',
  },
  dragging: {
    zIndex: 10,
    elevation: 4,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rowOuter: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  // Les 2 lignes (libellé+montant, puis description+%) partagent cette même largeur — c'est ce
  // qui garantit que le montant et le %, chacun aligné à droite de sa ligne, tombent exactement
  // l'un sous l'autre, sans dupliquer le switch/crayon sur une 3e ligne.
  textBlock: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { width: 16, color: ink(0.4) },
  label: { flex: 1, fontFamily: fonts.karlaBold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  amount: { fontFamily: fonts.spectralSemiBold, fontSize: 15, color: colors.ink },
  // Léger soulignement en pointillé implicite via la couleur primaire — signale que le montant
  // est tappable sans ajouter d'icône qui mangerait de la largeur.
  amountEditable: { color: colors.primary },
  descriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 22,
    marginTop: 2,
  },
  description: { fontFamily: fonts.karlaMedium, fontSize: 11.5, color: ink(0.5), flexShrink: 1 },
  pct: { fontFamily: fonts.karlaMedium, fontSize: 11.5, color: ink(0.5), marginLeft: 8 },
  editZone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  edit: { fontSize: 15 },
  // Pop-up centrée plutôt qu'éditeur inline : garde une taille de champ confortable quel que
  // soit le niveau d'imbrication (depth) de la ligne, et gère nativement le clavier (pas besoin
  // de scroller la liste vers la ligne active).
  modalRoot: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 15, 0.45)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontFamily: fonts.karlaBold, fontSize: 15, color: colors.ink, marginBottom: 2 },
  amountEditorField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountEditorUnit: { width: 18, fontFamily: fonts.karlaBold, fontSize: 14, color: ink(0.5) },
  amountEditorInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.section,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.spectralSemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  amountEditorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 4 },
  amountEditorCancel: { fontFamily: fonts.karlaSemiBold, fontSize: 13.5, color: ink(0.5) },
  amountEditorSave: { fontFamily: fonts.karlaBold, fontSize: 13.5, color: colors.primary },
  summary: { fontFamily: fonts.karlaBold, fontSize: 12.5, color: colors.warning, paddingVertical: 6 },
  summaryOverflow: { color: colors.danger },
  addChild: { paddingVertical: 10 },
  addChildText: { fontFamily: fonts.karlaBold, fontSize: 13, color: colors.primary },
  // Poignée de glisser dédiée : large (48px) pour rester facile à viser au pouce, mais limitée
  // à cette zone pour que le reste de la ligne (l'essentiel de l'écran) reste scrollable
  // normalement — voir le commentaire sur SiblingEnvelopeList plus haut.
  grip: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderSubtle,
  },
  gripText: { fontSize: 22, color: ink(0.4) },
});
