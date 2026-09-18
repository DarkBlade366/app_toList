import { Ionicons } from '@expo/vector-icons';
import {
  PropsWithChildren,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  UIManager,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Lista plana de nodos en el orden exacto en que se dibujan
 * (profundidad primero, respetando el set de expandido).
 */
export interface FlatNode {
  id: number;
  parentId: number | null;
}

export function flattenVisible(
  roots: readonly FlatNode[],
  expanded: ReadonlySet<number>,
  childrenOf: ReadonlyMap<number, readonly FlatNode[]>
): FlatNode[] {
  const out: FlatNode[] = [];
  const visit = (n: FlatNode) => {
    out.push(n);
    if (expanded.has(n.id)) {
      const kids = childrenOf.get(n.id);
      if (kids) for (const k of kids) visit(k);
    }
  };
  for (const r of roots) visit(r);
  return out;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragSession {
  id: number;
  parentId: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rects: Map<number, Rect>;
}

interface DragUI {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  indicatorY: number | null;
}

interface ReorderValue {
  rowRef: (id: number) => (el: View | null) => void;
  handleProps: (id: number) => ViewProps;
}

const ReorderCtx = createContext<ReorderValue | null>(null);

export function useReorder(place = 'ReorderProvider/useReorder'): ReorderValue {
  const v = useContext(ReorderCtx);
  if (!v) throw new Error(`${place} debe usarse dentro de un <ReorderProvider>`);
  return v;
}

/** Asidero de arrastre; se coloca como `dragHandle` de una fila. */
export function DragGrip({ id }: { id: number }) {
  const reorder = useReorder('DragGrip');
  return (
    <View {...reorder.handleProps(id)} style={styles.grip} collapsable={false}>
      <Ionicons name="reorder-three" size={21} color={Colors.muted} />
    </View>
  );
}

/**
 * Ancla el bloque de una fila (fila + sub-árbol) para que el provider pueda
 * medirlo y arrastrarlo entero. Se coloca como contenedor de cada nodo de la lista.
 */
export function RowAnchor({
  id,
  children,
  style,
}: PropsWithChildren<{ id: number; style?: ViewStyle }>) {
  const reorder = useReorder('RowAnchor');
  return (
    <View ref={reorder.rowRef(id)} style={style}>
      {children}
    </View>
  );
}

export function ReorderProvider({
  rows,
  siblingsOf,
  onReorder,
  renderGhost,
  onDragStateChange,
  children,
}: PropsWithChildren<{
  rows: FlatNode[];
  siblingsOf: (id: number) => number[];
  onReorder: (movingId: number, orderedSiblingIds: number[]) => void | Promise<void>;
  renderGhost: (taskId: number) => ReactNode;
  onDragStateChange?: (dragging: boolean) => void;
}>) {
  const rootRef = useRef<View | null>(null);
  const views = useRef(new Map<number, View>());
  const gripId = useRef<number | null>(null);
  const session = useRef<DragSession | null>(null);
  const slot = useRef<{ insertAt: number; canDrop: boolean }>({
    insertAt: 0,
    canDrop: false,
  });

  const [ui, setUi] = useState<DragUI | null>(null);

  const rowRef = useCallback((id: number) => (el: View | null) => {
    if (el) views.current.set(id, el);
    else views.current.delete(id);
  }, []);

  const measure = useCallback(
    (id: number): Rect | null => {
      const v = views.current.get(id);
      if (!v) return null;
      let root = { x: 0, y: 0, width: 0, height: 0 };
      rootRef.current?.measureInWindow((x, y, width, height) => {
        root = { x, y, width, height };
      });
      let r = { x: 0, y: 0, width: 0, height: 0 };
      v.measureInWindow((x, y, width, height) => {
        r = { x, y, width, height };
      });
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.x - root.x, y: r.y - root.y, width: r.width, height: r.height };
    },
    []
  );

  const measureRows = useCallback((id: number): Map<number, Rect> => {
    const rects = new Map<number, Rect>();
    for (const [tid, v] of views.current) {
      if (tid === id) continue;
      let root = { x: 0, y: 0, width: 0, height: 0 };
      rootRef.current?.measureInWindow((x, y, width, height) => {
        root = { x, y, width, height };
      });
      let r = { x: 0, y: 0, width: 0, height: 0 };
      v.measureInWindow((x, y, width, height) => {
        r = { x, y, width, height };
      });
      if (r.width !== 0 || r.height !== 0) {
        rects.set(tid, { x: r.x - root.x, y: r.y - root.y, width: r.width, height: r.height });
      }
    }
    return rects;
  }, []);

  const buildOrder = useCallback(
    (s: DragSession, insertAt: number): number[] | null => {
      const full = siblingsOf(s.id);
      if (full.length === 0) return null;
      const fullWithout = full.filter((x) => x !== s.id);
      if (fullWithout.length === full.length) return null;

      const sibs = rows.filter((r) => r.parentId === s.parentId);
      const ipos = sibs.findIndex((r) => r.id === s.id);
      if (ipos === -1) return null;
      const others = sibs.filter((r) => r.id !== s.id);
      const p = Math.max(0, Math.min(insertAt <= ipos ? insertAt : insertAt - 1, others.length));
      const beforeVis = p === 0 ? null : others[p - 1].id;
      const afterVis = p === others.length ? null : others[p].id;

      let insertIdx: number;
      if (beforeVis == null) {
        const firstVis = fullWithout.findIndex((x) => sibs.some((vv) => vv.id === x));
        insertIdx = firstVis === -1 ? fullWithout.length : firstVis;
      } else if (afterVis == null) {
        let last = -1;
        fullWithout.forEach((x, i) => {
          if (sibs.some((vv) => vv.id === x)) last = i;
        });
        insertIdx = last + 1;
      } else {
        const bi = fullWithout.indexOf(beforeVis);
        const ai = fullWithout.indexOf(afterVis);
        if (bi === -1 || ai === -1) return null;
        insertIdx = ai < bi ? ai : bi + 1;
      }

      fullWithout.splice(insertIdx, 0, s.id);
      const same =
        full.length === fullWithout.length && full.every((x, i) => x === fullWithout[i]);
      return same ? null : fullWithout;
    },
    [rows, siblingsOf]
  );

  const responder = useMemo(
    () =>
      // El `PanResponder` se construye una vez y sus handlers solo se invocan en
      // eventos táctiles (no durante el render), aunque capturen refs.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {},
        onPanResponderMove: (_evt, g) => {
          const id = gripId.current;
          if (id == null) return;
          let s = session.current;
          if (!s) {
            if (Math.abs(g.dy) < 4) return;
            const parentId = rows.find((r) => r.id === id)?.parentId ?? null;
            const rect = measure(id);
            if (!rect) return;
            s = {
              id,
              parentId,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              rects: measureRows(id),
            };
            session.current = s;
            onDragStateChange?.(true);
          }
          const y = s.y + g.dy;
          const center = Math.min(
            // evita salirse del rango del bloque arrastrado (por si arrastras fuera de la lista)
            s.rects.size > 0 ? 1e9 : 1e9,
            y + s.height / 2
          );
          const sibs = rows.filter((r) => r.parentId === s.parentId);
          const blocks = sibs
            .map((r) => s.rects.get(r.id))
            .filter((b): b is Rect => !!b);
          let indicatorY: number | null = null;
          let canDrop = false;
          if (blocks.length === sibs.length && blocks.length > 1) {
            const firstTop = blocks[0].y;
            const lastBottom = blocks[blocks.length - 1].y + blocks[blocks.length - 1].height;
            const c = Math.max(firstTop, Math.min(center, lastBottom));
            const mids: number[] = [];
            for (let i = 0; i < blocks.length - 1; i++) {
              mids.push((blocks[i].y + blocks[i].height + blocks[i + 1].y) / 2);
            }
            let insertAt = 0;
            while (insertAt < mids.length && mids[insertAt] < c) insertAt++;
            const ipos = sibs.findIndex((r) => r.id === s.id);
            canDrop = insertAt !== ipos;
            if (canDrop) {
              indicatorY =
                insertAt === 0
                  ? firstTop - 8
                  : insertAt === sibs.length
                    ? lastBottom + 8
                    : mids[insertAt - 1];
            }
            slot.current = { insertAt, canDrop };
          } else {
            slot.current = { insertAt: 0, canDrop: false };
          }
          setUi({
            id,
            x: s.x,
            y,
            width: s.width,
            height: s.height,
            indicatorY,
          });
        },
        onPanResponderRelease: () => {
          const s = session.current;
          const { insertAt, canDrop } = slot.current;
          session.current = null;
          slot.current = { insertAt: 0, canDrop: false };
          gripId.current = null;
          setUi(null);
          onDragStateChange?.(false);
          if (!s || !canDrop) return;
          const order = buildOrder(s, insertAt);
          if (order) void onReorder(s.id, order);
        },
        onPanResponderTerminate: () => {
          session.current = null;
          slot.current = { insertAt: 0, canDrop: false };
          gripId.current = null;
          setUi(null);
          onDragStateChange?.(false);
        },
      }),
    [rows, onReorder, measure, measureRows, buildOrder, onDragStateChange]
  );

  const handleProps = useCallback(
    (id: number): ViewProps => ({
      ...responder.panHandlers,
      onTouchStart: () => {
        gripId.current = id;
      },
      onStartShouldSetResponderCapture: () => {
        gripId.current = id;
        return false;
      },
      accessibilityRole: 'adjustable',
      accessibilityLabel: 'Reordenar',
      accessibilityHint: 'Mantén y arrastra para cambiar la posición',
    }),
    [responder]
  );

  const value = useMemo(() => ({ rowRef, handleProps }), [rowRef, handleProps]);

  return (
    <View ref={rootRef} style={styles.container}>
      <ReorderCtx.Provider value={value}>{children}</ReorderCtx.Provider>
      {ui ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ui.indicatorY != null ? (
            <View style={[styles.indicator, { top: ui.indicatorY }]} pointerEvents="none" />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.ghost,
              { left: ui.x, top: ui.y, width: ui.width, height: ui.height },
            ]}>
            {renderGhost(ui.id)}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grip: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 4,
  },
  ghost: {
    position: 'absolute',
    opacity: 0.96,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  indicator: {
    position: 'absolute',
    right: 10,
    left: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.tint,
    shadowColor: Colors.tint,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
});