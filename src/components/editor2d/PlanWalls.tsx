"use client";
import type Konva from "konva";
import { Group, Line } from "react-konva";
import type { Room } from "@/domain/schema";
import {
  type FloorWalls,
  type OpeningGeometry,
  pieceQuad,
  pieceSegments,
} from "@/lib/geometry/walls";
import { type Vec2, add, clamp, mul } from "@/lib/geometry/vec";
import { nearestWall } from "@/domain/roomOps";
import { worldToLocal } from "@/lib/geometry/transform";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { PLAN } from "./style";

const flat = (pts: Vec2[]) => pts.flatMap((p) => [p.x, p.y]);

export function PlanWalls({
  walls,
  rooms,
  openings,
  interactiveRoomId,
  dimmedRoomIds,
  listening,
}: {
  walls: FloorWalls;
  rooms: Room[];
  openings: OpeningGeometry[];
  /** In modalità stanza, solo i muri di questa stanza sono selezionabili. */
  interactiveRoomId: string | null;
  dimmedRoomIds: Set<string>;
  listening: boolean;
}) {
  const selection = useEditor((s) => s.selection);
  const mode = useEditor((s) => s.mode);
  const select = useEditor((s) => s.select);
  const focusRoom = useEditor((s) => s.focusRoom);
  const updateRoom = useEditor((s) => s.updateRoom);

  const onWallClick = (roomId: string, wallId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    if (mode === "room") select({ kind: "wall", roomId, wallId });
    else select({ kind: "room", roomId });
  };

  return (
    <Group listening={listening}>
      {walls.pieces.map((piece) => {
        const dim = dimmedRoomIds.has(piece.roomId) && (!piece.shared || dimmedRoomIds.has(piece.shared.roomId));
        const selected =
          selection?.kind === "wall" &&
          ((selection.roomId === piece.roomId && selection.wallId === piece.wallId) ||
            (piece.shared && selection.roomId === piece.shared.roomId && selection.wallId === piece.shared.wallId));
        const canInteract =
          !interactiveRoomId || piece.roomId === interactiveRoomId || piece.shared?.roomId === interactiveRoomId;
        const targetRoom = interactiveRoomId && piece.shared?.roomId === interactiveRoomId ? piece.shared.roomId : piece.roomId;
        const targetWall =
          interactiveRoomId && piece.shared?.roomId === interactiveRoomId ? piece.shared.wallId : piece.wallId;
        return (
          <Group
            key={piece.key}
            opacity={dim ? 0.35 : 1}
            listening={canInteract}
            onClick={(e) => onWallClick(targetRoom, targetWall, e)}
            onTap={(e) => onWallClick(targetRoom, targetWall, e)}
            onDblClick={(e) => {
              e.cancelBubble = true;
              if (mode === "house") focusRoom(targetRoom);
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              if (mode === "house") focusRoom(targetRoom);
            }}
            name={`wall:${targetRoom}:${targetWall}`}
          >
            {pieceSegments(piece).map((seg, i) =>
              seg.opening ? (
                <Line
                  key={i}
                  points={flat(pieceQuad(piece, seg.s0, seg.s1))}
                  closed
                  fill={PLAN.openingFill}
                  listening={false}
                />
              ) : (
                <Line
                  key={i}
                  points={flat(pieceQuad(piece, seg.s0, seg.s1))}
                  closed
                  fill={selected ? PLAN.wallSelected : piece.shared ? PLAN.wallShared : PLAN.wall}
                  stroke={selected ? PLAN.wallSelected : PLAN.wall}
                  strokeWidth={0.5}
                  strokeScaleEnabled={false}
                />
              ),
            )}
          </Group>
        );
      })}
      {openings.map((g) => (
        <OpeningSymbol
          key={g.opening.id}
          geom={g}
          room={rooms.find((r) => r.id === g.roomId)}
          dim={dimmedRoomIds.has(g.roomId)}
          selected={selection?.kind === "opening" && selection.openingId === g.opening.id}
          interactive={!interactiveRoomId || interactiveRoomId === g.roomId}
          onSelect={() => select({ kind: "opening", roomId: g.roomId, openingId: g.opening.id })}
          updateRoom={updateRoom}
        />
      ))}
    </Group>
  );
}

function arcPoints(center: Vec2, from: Vec2, to: Vec2, radius: number, steps = 14): Vec2[] {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  a1 = a0 + d;
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return pts;
}

function OpeningSymbol({
  geom,
  room,
  dim,
  selected,
  interactive,
  onSelect,
  updateRoom,
}: {
  geom: OpeningGeometry;
  room: Room | undefined;
  dim: boolean;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  updateRoom: (id: string, fn: (r: Room) => Room) => void;
}) {
  const { opening: o, start, end, inward, thickness } = geom;
  const tool = useEditor((s) => s.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const outward = mul(inward, -1);
  const oStart = add(start, mul(outward, thickness));
  const oEnd = add(end, mul(outward, thickness));
  const color = selected ? PLAN.accent : PLAN.ink;

  let symbol: React.ReactNode = null;
  if (o.kind === "window") {
    const mS = add(start, mul(outward, thickness / 2));
    const mE = add(end, mul(outward, thickness / 2));
    symbol = (
      <>
        <Line points={flat([start, end, oEnd, oStart])} closed fill={PLAN.white} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
        <Line points={flat([add(mS, mul(inward, thickness * 0.12)), add(mE, mul(inward, thickness * 0.12))])} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
        <Line points={flat([add(mS, mul(outward, thickness * 0.12)), add(mE, mul(outward, thickness * 0.12))])} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
      </>
    );
  } else if (o.kind === "door") {
    const out = o.swing === "out";
    const face = out ? [oStart, oEnd] : [start, end];
    const hinge = o.hinge === "start" ? face[0] : face[1];
    const free = o.hinge === "start" ? face[1] : face[0];
    const swingDir = out ? outward : inward;
    const leafEnd = add(hinge, mul(swingDir, o.width));
    symbol = (
      <>
        <Line points={flat([start, oStart])} stroke={color} strokeWidth={1.4} strokeScaleEnabled={false} />
        <Line points={flat([end, oEnd])} stroke={color} strokeWidth={1.4} strokeScaleEnabled={false} />
        <Line points={flat([hinge, leafEnd])} stroke={color} strokeWidth={2} strokeScaleEnabled={false} />
        <Line
          points={flat(arcPoints(hinge, leafEnd, free, o.width))}
          stroke={color}
          strokeWidth={0.9}
          dash={[5, 4]}
          strokeScaleEnabled={false}
        />
      </>
    );
  } else {
    symbol = (
      <>
        <Line points={flat([start, oStart])} stroke={color} strokeWidth={1.4} strokeScaleEnabled={false} />
        <Line points={flat([end, oEnd])} stroke={color} strokeWidth={1.4} strokeScaleEnabled={false} />
        <Line points={flat([start, end])} stroke={color} strokeWidth={0.8} dash={[3, 4]} strokeScaleEnabled={false} />
        <Line points={flat([oStart, oEnd])} stroke={color} strokeWidth={0.8} dash={[3, 4]} strokeScaleEnabled={false} />
      </>
    );
  }

  const draggable = interactive && tool === "select" && !readOnly && !!room;

  return (
    <Group
      opacity={dim ? 0.35 : 1}
      listening={interactive}
      draggable={draggable}
      dragBoundFunc={function (this: Konva.Node) {
        const v = useView2D.getState();
        return { x: v.x, y: v.y };
      }}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c && draggable) c.style.cursor = "grab";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        onSelect();
        useEditor.getState().begin();
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        if (!room) return;
        const stage = e.target.getStage();
        const p = stage?.getRelativePointerPosition();
        if (!p) return;
        const current = useEditor.getState().house.floors.flatMap((f) => f.rooms).find((r) => r.id === room.id);
        if (!current) return;
        const local = worldToLocal(current, p);
        const w = nearestWall(current, local);
        if (!w) return;
        const op = current.openings.find((x) => x.id === o.id);
        if (!op) return;
        const width = Math.min(op.width, w.length);
        const offset = clamp(Math.round(w.s - width / 2), 0, Math.max(0, w.length - width));
        if (op.wallId === w.wallId && op.offset === offset) return;
        updateRoom(room.id, (r) => ({
          ...r,
          openings: r.openings.map((x) => (x.id === o.id ? { ...x, wallId: w.wallId, offset, width } : x)),
        }));
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        useEditor.getState().commit();
      }}
    >
      {/* Area di presa: tutta l'apertura nello spessore del muro, un po' maggiorata. */}
      <Line
        points={flat([
          add(start, mul(inward, 8)),
          add(end, mul(inward, 8)),
          add(oEnd, mul(outward, 8)),
          add(oStart, mul(outward, 8)),
        ])}
        closed
        fill={selected ? PLAN.accentTint : "transparent"}
      />
      {symbol}
      {selected && (
        <Line points={flat([start, end])} stroke={PLAN.accent} strokeWidth={3} strokeScaleEnabled={false} listening={false} />
      )}
    </Group>
  );
}
