"use client";
import { Group, Line, Text } from "react-konva";
import type { Opening, Room } from "@/domain/schema";
import { type FloorWalls, effectiveThickness } from "@/lib/geometry/walls";
import { type Vec2, add, angleDeg, mul, normalize } from "@/lib/geometry/vec";
import { edgeLength } from "@/lib/geometry/polygon";
import { useView2D } from "@/store/view2d";
import { PLAN, formatCm, planFonts, uprightAngle } from "./style";

const flat = (pts: Vec2[]) => pts.flatMap((p) => [p.x, p.y]);

/**
 * Quota architettonica tra `a` e `b`, tracciata a distanza `offset` lungo `normal`.
 * Linee di richiamo, trattini obliqui alle estremità e valore al centro.
 */
export function DimensionLine({
  a,
  b,
  normal,
  offset,
  from = 0,
  label,
  color = PLAN.dimension,
}: {
  a: Vec2;
  b: Vec2;
  normal: Vec2;
  offset: number;
  /** Distanza dalla geometria a cui iniziano le linee di richiamo. */
  from?: number;
  label?: string;
  color?: string;
}) {
  const scale = useView2D((s) => s.scale);
  const fonts = planFonts();
  const dir = normalize({ x: b.x - a.x, y: b.y - a.y });
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len * scale < 18) return null;
  const pa = add(a, mul(normal, offset));
  const pb = add(b, mul(normal, offset));
  const gap = 3 / scale;
  const over = 5 / scale;
  const tick = 4 / scale;
  const slash = normalize(add(dir, normal));
  const fontSize = 11 / scale;
  const mid = add(mul(add(pa, pb), 0.5), mul(normal, fontSize * 0.75));
  const textW = 90 / scale;
  const text = label ?? formatCm(len);
  return (
    <Group listening={false}>
      <Line points={flat([add(a, mul(normal, from + gap)), add(pa, mul(normal, over))])} stroke={color} strokeWidth={0.8} strokeScaleEnabled={false} />
      <Line points={flat([add(b, mul(normal, from + gap)), add(pb, mul(normal, over))])} stroke={color} strokeWidth={0.8} strokeScaleEnabled={false} />
      <Line points={flat([add(pa, mul(dir, -over)), add(pb, mul(dir, over))])} stroke={color} strokeWidth={0.8} strokeScaleEnabled={false} />
      <Line points={flat([add(pa, mul(slash, -tick)), add(pa, mul(slash, tick))])} stroke={color} strokeWidth={1.6} strokeScaleEnabled={false} />
      <Line points={flat([add(pb, mul(slash, -tick)), add(pb, mul(slash, tick))])} stroke={color} strokeWidth={1.6} strokeScaleEnabled={false} />
      {len * scale > 34 && (
        <Text
          x={mid.x}
          y={mid.y}
          text={text}
          rotation={uprightAngle(angleDeg(dir))}
          fontFamily={fonts.narrow}
          fontSize={fontSize}
          fill={color}
          width={textW}
          offsetX={textW / 2}
          offsetY={fontSize / 2}
          align="center"
        />
      )}
    </Group>
  );
}

/** Quote automatiche dei lati di una stanza (misure interne, nette). */
export function RoomDimensions({ room, walls }: { room: Room; walls: FloorWalls }) {
  const scale = useView2D((s) => s.scale);
  const edges = walls.edgesByRoom.get(room.id) ?? [];
  return (
    <Group listening={false}>
      {edges.map((e) => {
        const t = Math.max(
          effectiveThickness(walls, room.id, e.wallId, 1),
          effectiveThickness(walls, room.id, e.wallId, e.length / 2),
          effectiveThickness(walls, room.id, e.wallId, e.length - 1),
        );
        return (
          <DimensionLine key={e.wallId} a={e.a} b={e.b} normal={e.normal} from={t} offset={t + 24 / scale} />
        );
      })}
    </Group>
  );
}

/** Quote parziali di un'apertura selezionata: distanza dagli angoli e larghezza. */
export function OpeningDimensions({ room, opening, walls }: { room: Room; opening: Opening; walls: FloorWalls }) {
  const scale = useView2D((s) => s.scale);
  const e = walls.edgesByRoom.get(room.id)?.find((x) => x.wallId === opening.wallId);
  if (!e) return null;
  const idx = room.walls.findIndex((w) => w.id === opening.wallId);
  const len = edgeLength(room.polygon, idx);
  const inward = mul(e.normal, -1);
  const p = (s: number) => add(e.a, mul(e.dir, s));
  const off = 26 / scale;
  return (
    <Group listening={false}>
      {opening.offset > 0.5 && <DimensionLine a={p(0)} b={p(opening.offset)} normal={inward} offset={off} />}
      <DimensionLine
        a={p(opening.offset)}
        b={p(opening.offset + opening.width)}
        normal={inward}
        offset={off}
        color={PLAN.ink}
      />
      {len - opening.offset - opening.width > 0.5 && (
        <DimensionLine a={p(opening.offset + opening.width)} b={p(len)} normal={inward} offset={off} />
      )}
    </Group>
  );
}
