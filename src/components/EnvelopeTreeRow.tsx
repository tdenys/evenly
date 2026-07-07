import { useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import type { Amount, Envelope, EnvelopeResult } from '@/core/waterfall/types';
import { summarizeChildren } from '@/core/waterfall/tree';
import { formatAmount, formatAmountWithPct, formatPct } from '@/lib/format';

export interface PersonLabels {
  A: string;
  B: string;
}

function describeFundedBy(fundedBy: Envelope['fundedBy'], personLabels: PersonLabels): string | null {
  switch (fundedBy) {
    case 'A':
      return `💸 ${personLabels.A}`;
    case 'B':
      return `💸 ${personLabels.B}`;
    case 'both':
      return `💸 ${personLabels.A} + ${personLabels.B}`;
    case null:
      return null;
  }
}

function describeAllocation(amount: Amount, personLabels: PersonLabels): string {
  switch (amount.type) {
    case 'fixed':
      return `${formatAmount(amount.value)} fixe`;
    case 'percent_envelope':
      return `${amount.pct}% du revenu`;
    case 'percent_remaining':
      return `${amount.pct}% du reste`;
    case 'prorata_income':
      return `Prorata revenus (${personLabels[amount.who]})`;
  }
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
   * montant de chaque ligne. */
  parentAmount: number;
  getResult: (id: string) => EnvelopeResult | undefined;
  personLabels: PersonLabels;
  onReorder: (id: string, targetIndex: number) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (envelopeId: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  /** Remonté jusqu'à l'écran pour désactiver le ScrollView pendant qu'un glissé est actif —
   * sinon les deux gestes entrent en conflit. */
  onDragStateChange?: (dragging: boolean) => void;
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
  onDragStateChange,
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
            onDragStateChange={onDragStateChange}
            onLayoutHeight={(height) => heightsRef.current.set(envelope.id, height)}
            dragHandlers={panResponderFor(envelope, index).panHandlers}
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
  onDragStateChange?: (dragging: boolean) => void;
  onLayoutHeight: (height: number) => void;
  dragHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
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
  onDragStateChange,
  onLayoutHeight,
  dragHandlers,
}: ContainerProps) {
  const [expanded, setExpanded] = useState(false);
  const result = getResult(envelope.id);
  const amount = result?.amount ?? 0;
  const pct = formatPct(amount, parentAmount);
  const summary = expanded ? describeChildrenSummary(amount, result?.children ?? []) : null;
  const fundedByText = describeFundedBy(envelope.fundedBy, personLabels);

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}
      style={isDragging ? [styles.dragging, { transform: [{ translateY: dragY }] }] : undefined}
    >
      <View style={[styles.row, { paddingLeft: 16 + depth * 20 }, !envelope.enabled && styles.rowDisabled]}>
        <TouchableOpacity style={styles.rowContent} onPress={() => setExpanded((e) => !e)}>
          <View style={styles.rowOuter}>
            {/* Libellé et description forment 2 lignes de même largeur (textBlock) — le montant
                et le % sont chacun casés en bout de leur ligne, ce qui les aligne verticalement
                sans ajouter de 3e ligne : le switch/crayon sont HORS de ce bloc, à droite,
                partagés par les 2 lignes plutôt que dupliqués sur une ligne à eux. */}
            <View style={styles.textBlock}>
              <View style={styles.main}>
                <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {envelope.emoji} {envelope.label}
                </Text>
                <Text style={styles.amount}>{formatAmount(amount)}</Text>
              </View>

              <View style={styles.descriptionRow}>
                <Text style={styles.description} numberOfLines={1}>
                  {describeAllocation(envelope.allocation, personLabels)}
                  {fundedByText && ` · ${fundedByText}`}
                  {!envelope.enabled && ' · Désactivée'}
                </Text>
                {pct && <Text style={styles.pct}>{pct}</Text>}
              </View>
            </View>

            <View
              style={styles.switchWrap}
              // Sur web, le clic sur le Switch (un <input> natif) bubble en DOM jusqu'au
              // TouchableOpacity parent (onClick), qui bascule alors aussi l'expand/collapse de
              // la ligne — la négociation de responder React Native ne suffit pas à l'empêcher
              // ici, il faut couper la propagation DOM directement.
              {...(Platform.OS === 'web' ? { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() } : null)}
            >
              <Switch value={envelope.enabled} onValueChange={(value) => onToggleEnabled(envelope.id, value)} />
            </View>

            <TouchableOpacity onPress={() => onEdit(envelope.id)} hitSlop={8}>
              <Text style={styles.edit}>✏️</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <View style={styles.grip} {...dragHandlers}>
          <Text style={styles.gripText}>⠿</Text>
        </View>
      </View>

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
            onDragStateChange={onDragStateChange}
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
          <TouchableOpacity
            style={[styles.addChild, { marginLeft: 16 + (depth + 1) * 20 }]}
            onPress={() => onAddChild(envelope.id)}
          >
            <Text style={styles.addChildText}>+ Ajouter une sous-enveloppe</Text>
          </TouchableOpacity>
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
    borderBottomColor: '#ddd',
  },
  rowDisabled: { opacity: 0.5 },
  rowContent: {
    flex: 1,
    paddingVertical: 10,
    // Sur web, glisser la souris sur du texte déclenche la sélection native du navigateur —
    // sans rapport avec notre geste de drag, juste un artefact visuel du navigateur à éviter.
    userSelect: 'none',
  },
  dragging: {
    zIndex: 10,
    elevation: 4,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rowOuter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Les 2 lignes (libellé+montant, puis description+%) partagent cette même largeur — c'est ce
  // qui garantit que le montant et le %, chacun aligné à droite de sa ligne, tombent exactement
  // l'un sous l'autre, sans dupliquer le switch/crayon sur une 3e ligne.
  textBlock: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { width: 16, color: '#999' },
  label: { flex: 1, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '700' },
  descriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 22,
    marginTop: 2,
  },
  description: { fontSize: 12, color: '#888', flexShrink: 1 },
  pct: { fontSize: 12, color: '#888', marginLeft: 8 },
  // Compense le fait qu'un `transform: scale` réduit l'apparence du Switch sans réduire la
  // place qu'il réserve dans le flex layout — la marge négative récupère cet espace mort.
  switchWrap: { transform: [{ scale: 0.75 }], marginHorizontal: -8 },
  edit: { fontSize: 15 },
  summary: { fontSize: 13, color: '#b45309', fontWeight: '600', paddingVertical: 6 },
  summaryOverflow: { color: '#dc2626' },
  addChild: { paddingVertical: 10 },
  addChildText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  // Poignée de glisser dédiée : large (48px) pour rester facile à viser au pouce, mais limitée
  // à cette zone pour que le reste de la ligne (l'essentiel de l'écran) reste scrollable
  // normalement — voir le commentaire sur SiblingEnvelopeList plus haut.
  grip: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#eee',
  },
  gripText: { fontSize: 22, color: '#999' },
});
