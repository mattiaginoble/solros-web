"use client";
import { Group, Line, Rect, Text } from "react-konva";
import type { Floor, House } from "@/domain/schema";
import { roomWorldPolygon } from "@/lib/geometry/transform";
import { adjacentFloor } from "@/domain/floors";
import { useView2D } from "@/store/view2d";
import { PLAN, planFonts } from "./style";

/**
 * Riferimenti degli altri piani: il perimetro del piano sottostante in
 * trasparenza e l'ingombro delle scale che arrivano da altri piani.
 */
export function PlanGhosts({ house, floor }: { house: House; floor: Floor }) {
  const scale = useView2D((s) => s.scale);
  const fonts = planFonts();
  const below = adjacentFloor(house, floor.id, -1);
  const incoming = house.floors
    .filter((f) => f.id !== floor.id)
    .flatMap((f) => f.rooms.flatMap((r) => r.items.filter((i) => i.linkFloorId === floor.id).map((i) => ({ room: r, item: i, from: f }))));
  return (
    <Group listening={false}>
      {below?.rooms.map((r) => (
        <Line
          key={r.id}
          points={roomWorldPolygon(r).flatMap((p) => [p.x, p.y])}
          closed
          stroke={PLAN.muted}
          strokeWidth={1}
          dash={[6, 5]}
          opacity={0.7}
          strokeScaleEnabled={false}
        />
      ))}
      {incoming.map(({ room, item, from }) => (
        <Group key={item.id} x={room.x} y={room.y} rotation={room.rotation}>
          <Group x={item.x} y={item.y} rotation={item.rotation}>
            <Rect
              x={-item.product.width / 2}
              y={-item.product.depth / 2}
              width={item.product.width}
              height={item.product.depth}
              fill="rgba(29,79,145,0.08)"
              stroke={PLAN.accent}
              strokeWidth={1.2}
              dash={[6, 4]}
              strokeScaleEnabled={false}
            />
            <Text
              text={`Scala da ${from.name.toLowerCase()}`}
              width={item.product.width}
              x={-item.product.width / 2}
              y={-6 / scale}
              align="center"
              fontFamily={fonts.narrow}
              fontSize={11 / scale}
              fill={PLAN.accent}
            />
          </Group>
        </Group>
      ))}
    </Group>
  );
}
