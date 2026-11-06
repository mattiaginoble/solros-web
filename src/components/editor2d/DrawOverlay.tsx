"use client";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { AlignGuide } from "@/lib/geometry/snap";
import { type Vec2, angleDeg, distance } from "@/lib/geometry/vec";
import { useView2D } from "@/store/view2d";
import { PLAN, formatCm, planFonts } from "./style";

export interface DrawState {
  points: Vec2[];
  cursor: Vec2 | null;
  guides: AlignGuide[];
  closes: boolean;
  typed: string;
}

export const emptyDraw = (): DrawState => ({ points: [], cursor: null, guides: [], closes: false, typed: "" });

/** Anteprima del disegno dei muri: tracciato, segmento corrente, guide e misura. */
export function DrawOverlay({ state }: { state: DrawState }) {
  const { scale, x, y, width, height } = useView2D();
  const fonts = planFonts();
  const { points, cursor, guides, closes, typed } = state;
  const last = points[points.length - 1];
  const r = 5 / scale;
  const minX = -x / scale;
  const minY = -y / scale;
  const maxX = (width - x) / scale;
  const maxY = (height - y) / scale;
  const segLen = last && cursor ? distance(last, cursor) : 0;
  const fontSize = 12 / scale;
  const label = typed
    ? `${typed.replace(".", ",")} cm ⏎`
    : last && cursor
      ? `${formatCm(segLen)} cm  ${Math.round(angleDeg({ x: cursor.x - last.x, y: cursor.y - last.y }))}°`
      : "";
  const labelW = Math.max(90, label.length * 7.2) / scale;

  return (
    <Group listening={false}>
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <Line key={i} points={[g.value, minY, g.value, maxY]} stroke={PLAN.accent} strokeWidth={0.8} dash={[6, 6]} opacity={0.6} strokeScaleEnabled={false} />
        ) : (
          <Line key={i} points={[minX, g.value, maxX, g.value]} stroke={PLAN.accent} strokeWidth={0.8} dash={[6, 6]} opacity={0.6} strokeScaleEnabled={false} />
        ),
      )}
      {points.length > 0 && (
        <Line
          points={[...points.flatMap((p) => [p.x, p.y]), ...(cursor ? [cursor.x, cursor.y] : [])]}
          stroke={PLAN.accent}
          strokeWidth={2}
          strokeScaleEnabled={false}
          fill={points.length >= 2 ? PLAN.accentTint : undefined}
          closed={points.length >= 2 && closes}
        />
      )}
      {points.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={i === 0 && closes ? r * 1.8 : r}
          fill={i === 0 ? PLAN.accent : PLAN.white}
          stroke={PLAN.accent}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      ))}
      {cursor && (
        <>
          <Line points={[cursor.x - 10 / scale, cursor.y, cursor.x + 10 / scale, cursor.y]} stroke={PLAN.ink} strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[cursor.x, cursor.y - 10 / scale, cursor.x, cursor.y + 10 / scale]} stroke={PLAN.ink} strokeWidth={1} strokeScaleEnabled={false} />
        </>
      )}
      {cursor && label && (
        <Group x={cursor.x + 14 / scale} y={cursor.y + 14 / scale}>
          <Rect width={labelW} height={fontSize * 1.9} fill={PLAN.white} stroke={PLAN.accent} strokeWidth={1} strokeScaleEnabled={false} cornerRadius={3 / scale} />
          <Text
            text={label}
            fontFamily={fonts.narrow}
            fontSize={fontSize}
            fill={PLAN.accent}
            width={labelW}
            height={fontSize * 1.9}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </Group>
  );
}
