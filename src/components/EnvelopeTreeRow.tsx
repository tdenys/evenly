import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Envelope } from '@/core/waterfall/types';
import { formatAmount } from '@/lib/format';

const LONG_PRESS_MS = 300;
const MOVE_CANCEL_THRESHOLD = 8; // px — au-delà, avant l'appui long, on laisse le scroll agir
const TAP_THRESHOLD = 8; // px — en-deçà au relâché, on considère que c'était un tap

interface ListProps {
  envelopes: Envelope[];
  depth: number;
  getAmount: (id: string) => number;
  onReorder: (id: string, targetIndex: number) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (envelopeId: string) => void;
  /** Remonté jusqu'à l'écran pour désactiver le ScrollView (et son tirer-pour-rafraîchir)
   * pendant qu'un glissé est actif — sinon les deux gestes entrent en conflit. */
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
 * Liste d'enveloppes sœurs, réordonnable par glisser-déposer depuis n'importe quel point de la
 * ligne (appui maintenu ~300ms puis déplacement — un tap rapide déplie/replie à la place, un
 * mouvement avant la fin de l'appui long est traité comme un scroll et relâché au ScrollView).
 */
export function SiblingEnvelopeList({
  envelopes,
  depth,
  getAmount,
  onReorder,
  onAddChild,
  onEdit,
  onDragStateChange,
}: ListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const heightsRef = useRef<Map<string, number>>(new Map());
  const dragStartIndexRef = useRef(0);
  const dragActivatedRef = useRef(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const panResponderFor = (envelope: Envelope, index: number, onTap: () => void) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragActivatedRef.current = false;
        clearPressTimer();
        pressTimerRef.current = setTimeout(() => {
          dragActivatedRef.current = true;
          dragStartIndexRef.current = index;
          setDraggingId(envelope.id);
          dragY.setValue(0);
          onDragStateChange?.(true);
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (dragActivatedRef.current) {
          dragY.setValue(gestureState.dy);
        } else if (Math.abs(gestureState.dy) > MOVE_CANCEL_THRESHOLD || Math.abs(gestureState.dx) > MOVE_CANCEL_THRESHOLD) {
          // Bouge trop tôt : probablement une intention de scroll, on annule l'appui long.
          clearPressTimer();
        }
      },
      // Tant que l'appui long n'a pas activé le glissé, on laisse un parent (le ScrollView)
      // reprendre la main s'il détecte un scroll — sinon (glissé actif) on garde la main.
      onPanResponderTerminationRequest: () => !dragActivatedRef.current,
      onPanResponderRelease: (_evt, gestureState) => {
        clearPressTimer();
        if (dragActivatedRef.current) {
          const heights = envelopes.map((e) => heightsRef.current.get(e.id) ?? 0);
          const targetIndex = computeTargetIndex(dragStartIndexRef.current, gestureState.dy, heights);
          setDraggingId(null);
          dragY.setValue(0);
          dragActivatedRef.current = false;
          onDragStateChange?.(false);
          if (targetIndex !== dragStartIndexRef.current) {
            onReorder(envelope.id, targetIndex);
          }
        } else if (Math.abs(gestureState.dy) < TAP_THRESHOLD && Math.abs(gestureState.dx) < TAP_THRESHOLD) {
          onTap();
        }
      },
      onPanResponderTerminate: () => {
        clearPressTimer();
        if (dragActivatedRef.current) onDragStateChange?.(false);
        dragActivatedRef.current = false;
        setDraggingId(null);
        dragY.setValue(0);
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
            index={index}
            isDragging={isDragging}
            dragY={dragY}
            getAmount={getAmount}
            onReorder={onReorder}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDragStateChange={onDragStateChange}
            onLayoutHeight={(height) => heightsRef.current.set(envelope.id, height)}
            makePanResponder={(onTap) => panResponderFor(envelope, index, onTap)}
          />
        );
      })}
    </View>
  );
}

interface ContainerProps {
  envelope: Envelope;
  depth: number;
  index: number;
  isDragging: boolean;
  dragY: Animated.Value;
  getAmount: (id: string) => number;
  onReorder: (id: string, targetIndex: number) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (envelopeId: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onLayoutHeight: (height: number) => void;
  makePanResponder: (onTap: () => void) => ReturnType<typeof PanResponder.create>;
}

function EnvelopeTreeRowContainer({
  envelope,
  depth,
  isDragging,
  dragY,
  getAmount,
  onReorder,
  onAddChild,
  onEdit,
  onDragStateChange,
  onLayoutHeight,
  makePanResponder,
}: ContainerProps) {
  const [expanded, setExpanded] = useState(false);
  const panResponder = makePanResponder(() => setExpanded((e) => !e));

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}
      style={isDragging ? [styles.dragging, { transform: [{ translateY: dragY }] }] : undefined}
    >
      <View
        style={[styles.row, { paddingLeft: 16 + depth * 20 }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.main}>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {envelope.emoji} {envelope.label}
          </Text>
        </View>

        <Text style={styles.amount}>{formatAmount(getAmount(envelope.id))}</Text>

        <TouchableOpacity onPress={() => onEdit(envelope.id)} hitSlop={8}>
          <Text style={styles.edit}>✏️</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View>
          <SiblingEnvelopeList
            envelopes={envelope.children}
            depth={depth + 1}
            getAmount={getAmount}
            onReorder={onReorder}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDragStateChange={onDragStateChange}
          />
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
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 8,
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
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { width: 16, color: '#999' },
  label: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  edit: { fontSize: 15, marginLeft: 12 },
  addChild: { paddingVertical: 10 },
  addChildText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
