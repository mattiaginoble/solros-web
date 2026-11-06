"use client";
import type Konva from "konva";
import { Group, Line, Text } from "react-konva";
import type { Room } from "@/domain/schema";
import { areaM2, centroid, offsetPolygon } from "@/lib/geometry/polygon";
import { roomWorldPolygon } from "@/lib/geometry/transform";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { PLAN, formatM2, planFonts } from "./style";

const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y]);

export interface RoomDragHandlers {
  onDragStart: (room: Room) => void;
  /** Riceve la posizione proposta e restituisce quella definitiva (snap). */
  onDragMove: (room: Room, pos: { x: number; y: number }) => { x: number; y: number };
  onDragEnd: (room: Room) => void;
}

export function PlanRooms({
  rooms,
  dimmedRoomIds,
  draggable,
  drag,
  listening,
}: {
  rooms: Room[];
  dimmedRoomIds: Set<string>;
  draggable: boolean;
  drag: RoomDragHandlers;
  listening: boolean;
}) {
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const focusRoom = useEditor((s) => s.focusRoom);
  const mode = useEditor((s) => s.mode);
  const scale = useView2D((s) => s.scale);
  const fonts = planFonts();

  return (
    <Group listening={listening}>
      {rooms.map((room) => {
        const selected = selection?.roomId === room.id && selection.kind === "room";
        const dim = dimmedRoomIds.has(room.id);
        const c = centroid(room.polygon);
        const nameSize = 13 / scale;
        const areaSize = 11.5 / scale;
        const labelW = 220 / scale;
        const onPick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          select({ kind: "room", roomId: room.id });
        };
        const onFocus = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          if (mode === "house") focusRoom(room.id);
        };
        return (
          <Group
            key={room.id}
            x={room.x}
            y={room.y}
            rotation={room.rotation}
            opacity={dim ? 0.35 : 1}
            listening={!dim}
            draggable={draggable && !dim}
            onClick={onPick}
            onTap={onPick}
            onDblClick={onFocus}
            onDblTap={onFocus}
            onMouseEnter={(e) => {
              const ct = e.target.getStage()?.container();
              if (ct && draggable) ct.style.cursor = "move";
            }}
            onMouseLeave={(e) => {
              const ct = e.target.getStage()?.container();
              if (ct) ct.style.cursor = "";
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              select({ kind: "room", roomId: room.id });
              drag.onDragStart(room);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const pos = drag.onDragMove(room, { x: e.target.x(), y: e.target.y() });
              e.target.position(pos);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              drag.onDragEnd(room);
            }}
          >
            <Line points={flat(room.polygon)} closed fill={room.color} />
            {selected && <Line points={flat(room.polygon)} closed fill={PLAN.accentTint} listening={false} />}
            <Group x={c.x} y={c.y} rotation={-room.rotation} listening={false}>
              <Text
                text={room.name}
                fontFamily={fonts.regular}
                fontStyle="600"
                fontSize={nameSize}
                fill={PLAN.ink}
                width={labelW}
                offsetX={labelW / 2}
                offsetY={nameSize * 1.1}
                align="center"
                wrap="none"
                ellipsis
              />
              <Text
                text={formatM2(areaM2(room.polygon))}
                fontFamily={fonts.narrow}
                fontSize={areaSize}
                fill={PLAN.inkSoft}
                width={labelW}
                offsetX={labelW / 2}
                offsetY={-areaSize * 0.25}
                align="center"
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
}

/** Contorno di selezione attorno ai muri della stanza selezionata. */
export function RoomSelectionOutline({ room }: { room: Room }) {
  const scale = useView2D((s) => s.scale);
  const outer = offsetPolygon(
    roomWorldPolygon(room),
    room.walls.map((w) => w.thickness + 6 / scale),
  );
  return (
    <Line
      points={flat(outer)}
      closed
      stroke={PLAN.accent}
      strokeWidth={1.5}
      dash={[8, 5]}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
}
