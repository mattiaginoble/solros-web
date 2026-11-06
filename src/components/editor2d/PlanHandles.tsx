"use client";
import type Konva from "konva";
import { useRef } from "react";
import { Circle, Group, Line, Rect } from "react-konva";
import type { Room } from "@/domain/schema";
import { insertVertex, moveEdge, setVertex } from "@/domain/roomOps";
import { edges } from "@/lib/geometry/polygon";
import { snapValue } from "@/lib/geometry/snap";
import { type Vec2, dot, midpoint, sub } from "@/lib/geometry/vec";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { PLAN } from "./style";

/**
 * Maniglie di modifica della forma (modalità stanza): vertici trascinabili con
 * snap alla griglia e allineamento ai vertici vicini, maniglie sui lati per
 * spostare un muro parallelamente, doppio clic su un lato per aggiungere un vertice.
 */
export function PlanHandles({ room, grid }: { room: Room; grid: number }) {
  const scale = useView2D((s) => s.scale);
  const selection = useEditor((s) => s.selection);
  const readOnly = useEditor((s) => s.readOnly);
  const tool = useEditor((s) => s.tool);
  const startRoom = useRef<Room | null>(null);
  const r = 6 / scale;
  const active = tool === "select" && !readOnly;
  const es = edges(room.polygon);

  const st = () => useEditor.getState();
  const begin = () => {
    startRoom.current = room;
    st().begin();
  };
  const end = () => {
    startRoom.current = null;
    st().commit();
  };

  const snapVertex = (base: Room, index: number, p: Vec2, free: boolean): Vec2 => {
    if (free) return p;
    const n = base.polygon.length;
    let q = { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
    // Allineamento ortogonale ai vertici adiacenti (tolleranza 8 px).
    const tol = 8 / scale;
    for (const j of [(index - 1 + n) % n, (index + 1) % n]) {
      const v = base.polygon[j];
      if (Math.abs(p.x - v.x) < tol) q = { ...q, x: v.x };
      if (Math.abs(p.y - v.y) < tol) q = { ...q, y: v.y };
    }
    return q;
  };

  return (
    <Group x={room.x} y={room.y} rotation={room.rotation} listening={active}>
      {/* Lati: area di presa per il doppio clic (inserimento vertice) */}
      {es.map((e) => (
        <Line
          key={`hit-${e.index}`}
          points={[e.a.x, e.a.y, e.b.x, e.b.y]}
          stroke="transparent"
          strokeWidth={14}
          strokeScaleEnabled={false}
          hitStrokeWidth={14}
          onDblClick={(ev) => {
            ev.cancelBubble = true;
            const p = ev.target.getParent()?.getRelativePointerPosition();
            if (!p) return;
            st().updateRoom(room.id, (rm) => insertVertex(rm, e.index, { x: snapValue(p.x, grid), y: snapValue(p.y, grid) }));
          }}
          onDblTap={(ev) => {
            ev.cancelBubble = true;
            const p = ev.target.getParent()?.getRelativePointerPosition();
            if (!p) return;
            st().updateRoom(room.id, (rm) => insertVertex(rm, e.index, { x: snapValue(p.x, grid), y: snapValue(p.y, grid) }));
          }}
          onClick={(ev) => {
            ev.cancelBubble = true;
            st().select({ kind: "wall", roomId: room.id, wallId: room.walls[e.index].id });
          }}
          onTap={(ev) => {
            ev.cancelBubble = true;
            st().select({ kind: "wall", roomId: room.id, wallId: room.walls[e.index].id });
          }}
        />
      ))}
      {/* Maniglie dei lati: spostano il muro lungo la sua normale */}
      {es.map((e) => {
        if (e.length * scale < 46) return null;
        const m = midpoint(e.a, e.b);
        const size = 9 / scale;
        const angle = (Math.atan2(e.dir.y, e.dir.x) * 180) / Math.PI;
        return (
          <Rect
            key={`edge-${e.index}`}
            x={m.x}
            y={m.y}
            width={size * 2.2}
            height={size}
            offsetX={size * 1.1}
            offsetY={size / 2}
            rotation={angle}
            fill={PLAN.white}
            stroke={PLAN.accent}
            strokeWidth={1.4}
            strokeScaleEnabled={false}
            cornerRadius={size / 2}
            draggable
            onMouseEnter={(ev) => {
              const c = ev.target.getStage()?.container();
              if (c) c.style.cursor = Math.abs(e.dir.x) > Math.abs(e.dir.y) ? "ns-resize" : "ew-resize";
            }}
            onMouseLeave={(ev) => {
              const c = ev.target.getStage()?.container();
              if (c) c.style.cursor = "";
            }}
            onDragStart={(ev) => {
              ev.cancelBubble = true;
              st().select({ kind: "wall", roomId: room.id, wallId: room.walls[e.index].id });
              begin();
            }}
            onDragMove={(ev: Konva.KonvaEventObject<DragEvent>) => {
              ev.cancelBubble = true;
              const base = startRoom.current ?? room;
              const be = edges(base.polygon)[e.index];
              const m0 = midpoint(be.a, be.b);
              const p = { x: ev.target.x(), y: ev.target.y() };
              let delta = dot(sub(p, m0), be.normal);
              if (!ev.evt.altKey) delta = snapValue(delta, grid);
              const updated = moveEdge(base, e.index, delta);
              st().updateRoom(room.id, () => updated);
              const ne = edges(updated.polygon)[e.index];
              if (ne) ev.target.position(midpoint(ne.a, ne.b));
            }}
            onDragEnd={(ev) => {
              ev.cancelBubble = true;
              end();
            }}
          />
        );
      })}
      {/* Vertici */}
      {room.polygon.map((p, i) => {
        const selected = selection?.kind === "vertex" && selection.roomId === room.id && selection.index === i;
        return (
          <Circle
            key={`v-${i}`}
            x={p.x}
            y={p.y}
            radius={r}
            fill={selected ? PLAN.accent : PLAN.white}
            stroke={PLAN.accent}
            strokeWidth={1.6}
            strokeScaleEnabled={false}
            hitStrokeWidth={18}
            draggable
            onMouseEnter={(ev) => {
              const c = ev.target.getStage()?.container();
              if (c) c.style.cursor = "crosshair";
            }}
            onMouseLeave={(ev) => {
              const c = ev.target.getStage()?.container();
              if (c) c.style.cursor = "";
            }}
            onClick={(ev) => {
              ev.cancelBubble = true;
              st().select({ kind: "vertex", roomId: room.id, index: i });
            }}
            onTap={(ev) => {
              ev.cancelBubble = true;
              st().select({ kind: "vertex", roomId: room.id, index: i });
            }}
            onDragStart={(ev) => {
              ev.cancelBubble = true;
              st().select({ kind: "vertex", roomId: room.id, index: i });
              begin();
            }}
            onDragMove={(ev: Konva.KonvaEventObject<DragEvent>) => {
              ev.cancelBubble = true;
              const base = startRoom.current ?? room;
              const q = snapVertex(base, i, { x: ev.target.x(), y: ev.target.y() }, ev.evt.altKey);
              ev.target.position(q);
              st().updateRoom(room.id, () => setVertex(base, i, q));
            }}
            onDragEnd={(ev) => {
              ev.cancelBubble = true;
              end();
            }}
          />
        );
      })}
    </Group>
  );
}
