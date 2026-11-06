"use client";
import type Konva from "konva";
import { useMemo, useRef, useState } from "react";
import { Circle, Ellipse, Group, Line, Rect, Text } from "react-konva";
import { itemSymbol, symbolFills, type Prim } from "@/components/items/symbols";
import type { PlacedItem, Room } from "@/domain/schema";
import { obbCorners } from "@/lib/geometry/collision";
import {
  type ItemIssue,
  type SnapGuide,
  analyzeRoomItems,
  clearanceOBB,
  doorZones,
  snapItem,
} from "@/lib/geometry/placement";
import { snapValue } from "@/lib/geometry/snap";
import { reparentItemIfMoved, updateItem } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { PLAN, planFonts } from "./style";

const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y]);

function PrimShape({ p, fills, stroke }: { p: Prim; fills: ReturnType<typeof symbolFills>; stroke: string }) {
  const fill = (f?: string) => (f === "none" ? undefined : f === "light" ? fills.light : f === "dark" ? fills.dark : fills.base);
  const common = { stroke, strokeWidth: 1, strokeScaleEnabled: false, listening: false } as const;
  if (p.t === "rect")
    return <Rect x={p.x} y={p.y} width={p.w} height={p.h} cornerRadius={p.r ?? 0} fill={fill(p.fill)} dash={p.dash ? [4, 3] : undefined} {...common} />;
  if (p.t === "circle") return <Circle x={p.cx} y={p.cy} radius={p.r} fill={fill(p.fill)} {...common} />;
  if (p.t === "ellipse") return <Ellipse x={p.cx} y={p.cy} radiusX={p.rx} radiusY={p.ry} fill={fill(p.fill)} {...common} />;
  return <Line points={p.pts} dash={p.dash ? [4, 3] : undefined} {...common} />;
}

/** Arredi di tutte le stanze del piano, nelle coordinate locali di ciascuna stanza. */
export function PlanItems({
  rooms,
  dimmedRoomIds,
  interactive,
  focusedRoomId,
}: {
  rooms: Room[];
  dimmedRoomIds: Set<string>;
  interactive: boolean;
  focusedRoomId: string | null;
}) {
  return (
    <Group>
      {rooms.map((room) => (
        <RoomItems
          key={room.id}
          room={room}
          dim={dimmedRoomIds.has(room.id)}
          interactive={interactive && !dimmedRoomIds.has(room.id)}
          showZones={focusedRoomId === room.id}
        />
      ))}
    </Group>
  );
}

const ORDER: Record<string, number> = { floor: 1, wall: 2, ceiling: 3 };

function RoomItems({ room, dim, interactive, showZones }: { room: Room; dim: boolean; interactive: boolean; showZones: boolean }) {
  const selection = useEditor((s) => s.selection);
  const issues = useMemo(() => analyzeRoomItems(room), [room]);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const zones = useMemo(() => (showZones ? doorZones(room) : []), [room, showZones]);
  const blockedOpenings = new Set<string>();
  for (const list of issues.values()) for (const i of list) if (i.kind === "blocks-door") blockedOpenings.add(i.openingId);
  const sorted = [...room.items].sort(
    (a, b) =>
      (a.product.shape === "rug" ? 0 : ORDER[a.product.mount]) - (b.product.shape === "rug" ? 0 : ORDER[b.product.mount]) ||
      a.elevation - b.elevation,
  );
  const selectedItem = selection?.kind === "item" && selection.roomId === room.id ? room.items.find((i) => i.id === selection.itemId) : undefined;

  return (
    <Group x={room.x} y={room.y} rotation={room.rotation} opacity={dim ? 0.35 : 1} listening={interactive}>
      {zones.map((z) => (
        <Line
          key={z.opening.id}
          points={flat(z.zone)}
          closed
          fill={blockedOpenings.has(z.opening.id) ? PLAN.dangerTint : "rgba(29,79,145,0.05)"}
          stroke={blockedOpenings.has(z.opening.id) ? PLAN.danger : PLAN.accent}
          strokeWidth={0.8}
          dash={[4, 4]}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {sorted.map((item) => (
        <ItemNode
          key={item.id}
          room={room}
          item={item}
          issues={issues.get(item.id) ?? []}
          selected={selectedItem?.id === item.id}
          interactive={interactive}
          onGuides={setGuides}
        />
      ))}
      {selectedItem && <ClearanceZone item={selectedItem} issues={issues.get(selectedItem.id) ?? []} />}
      {guides.map((g, i) => (
        <Line
          key={i}
          points={[g.from.x, g.from.y, g.to.x, g.to.y]}
          stroke={g.kind === "wall" ? PLAN.accent : "#c2410c"}
          strokeWidth={g.kind === "wall" ? 2 : 1}
          dash={g.kind === "wall" ? undefined : [6, 4]}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </Group>
  );
}

function ClearanceZone({ item, issues }: { item: PlacedItem; issues: ItemIssue[] }) {
  const cl = clearanceOBB(item);
  if (!cl) return null;
  const blocked = issues.some((i) => i.kind === "clearance");
  return (
    <Line
      points={flat(obbCorners(cl))}
      closed
      fill={blocked ? PLAN.dangerTint : "rgba(29,79,145,0.07)"}
      stroke={blocked ? PLAN.danger : PLAN.accent}
      strokeWidth={1}
      dash={[5, 4]}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
}

function ItemNode({
  room,
  item,
  issues,
  selected,
  interactive,
  onGuides,
}: {
  room: Room;
  item: PlacedItem;
  issues: ItemIssue[];
  selected: boolean;
  interactive: boolean;
  onGuides: (g: SnapGuide[]) => void;
}) {
  const scale = useView2D((s) => s.scale);
  const tool = useEditor((s) => s.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const fonts = planFonts();
  const { width: w, depth: d } = item.product;
  const prims = useMemo(() => itemSymbol(item.product.shape, w, d, item.product.meta), [item.product, w, d]);
  const fills = symbolFills(item.product.colorHex);
  const hasIssue = issues.some((i) => i.kind !== "clearance");
  const stroke = hasIssue ? PLAN.danger : PLAN.ink;
  const canDrag = interactive && tool === "select" && !readOnly;
  const rotStart = useRef<number | null>(null);
  const handleDist = d / 2 + 26 / scale;
  const pick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    select({ kind: "item", roomId: room.id, itemId: item.id });
  };

  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable={canDrag}
      opacity={item.product.mount === "ceiling" ? 0.7 : item.product.shape === "worktop" ? 0.55 : 1}
      onClick={pick}
      onTap={pick}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c && canDrag) c.style.cursor = "move";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        select({ kind: "item", roomId: room.id, itemId: item.id });
        useEditor.getState().begin();
      }}
      onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
        e.cancelBubble = true;
        if (e.target !== e.currentTarget) return;
        const cur = useEditor.getState().house.floors.flatMap((f) => f.rooms).find((r) => r.id === room.id);
        const me = cur?.items.find((i) => i.id === item.id);
        if (!cur || !me) return;
        const raw = { x: e.target.x(), y: e.target.y() };
        let pos = raw;
        let guides: SnapGuide[] = [];
        if (!e.evt.altKey) {
          const res = snapItem(cur, me, raw, cur.items.filter((i) => i.id !== item.id), Math.max(6, 12 / scale));
          pos = { x: res.x, y: res.y };
          guides = res.guides;
        }
        e.target.position(pos);
        onGuides(guides);
        updateItem(room.id, item.id, { x: pos.x, y: pos.y });
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (e.target !== e.currentTarget) return;
        onGuides([]);
        useEditor.getState().commit();
        reparentItemIfMoved(room.id, item.id);
      }}
    >
      {prims.map((p, i) => (
        <PrimShape key={i} p={p} fills={fills} stroke={stroke} />
      ))}
      {/* Area di presa e segnalazione dei problemi */}
      <Rect
        x={-w / 2}
        y={-d / 2}
        width={w}
        height={d}
        fill={hasIssue ? PLAN.dangerTint : "transparent"}
        stroke={selected ? PLAN.accent : hasIssue ? PLAN.danger : undefined}
        strokeWidth={selected ? 2 : 1.5}
        dash={item.product.mount === "ceiling" ? [4, 3] : undefined}
        strokeScaleEnabled={false}
      />
      {selected && (
        <>
          <Text
            text={`${Math.round(w)} × ${Math.round(d)}`}
            x={-60 / scale}
            y={-d / 2 - 16 / scale}
            width={120 / scale}
            align="center"
            fontFamily={fonts.narrow}
            fontSize={11 / scale}
            fill={PLAN.accent}
            listening={false}
          />
          <Line points={[0, d / 2, 0, handleDist]} stroke={PLAN.accent} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          {canDrag && (
            <Circle
              x={0}
              y={handleDist}
              radius={7 / scale}
              fill={PLAN.white}
              stroke={PLAN.accent}
              strokeWidth={1.6}
              strokeScaleEnabled={false}
              hitStrokeWidth={16}
              draggable
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = "grab";
              }}
              onDragStart={(e) => {
                e.cancelBubble = true;
                rotStart.current = item.rotation;
                useEditor.getState().begin();
              }}
              onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                e.cancelBubble = true;
                const parent = e.target.getParent()?.getParent();
                const p = parent?.getRelativePointerPosition();
                if (!p) return;
                let angle = (Math.atan2(p.y - item.y, p.x - item.x) * 180) / Math.PI - 90;
                if (!e.evt.altKey) angle = snapValue(angle, 15);
                angle = ((angle % 360) + 360) % 360;
                updateItem(room.id, item.id, { rotation: angle });
                e.target.position({ x: 0, y: handleDist });
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                e.target.position({ x: 0, y: handleDist });
                rotStart.current = null;
                useEditor.getState().commit();
              }}
            />
          )}
        </>
      )}
    </Group>
  );
}

