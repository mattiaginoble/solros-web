/** Miniatura SVG di una o più stanze (per modelli e tavole di progetto). */
import { bbox } from "@/lib/geometry/polygon";
import type { Vec2 } from "@/lib/geometry/vec";

export interface PreviewShape {
  points: Vec2[];
  color?: string;
}

export function PlanPreview({
  shapes,
  className = "",
  stroke = "#23272b",
  padding = 0.08,
  wall = 10,
}: {
  shapes: PreviewShape[];
  className?: string;
  stroke?: string;
  padding?: number;
  /** Spessore del muro in cm, scalato con il disegno. */
  wall?: number;
}) {
  if (shapes.length === 0) {
    return <svg className={className} viewBox="0 0 100 70" aria-hidden="true" />;
  }
  const b = bbox(shapes.flatMap((s) => s.points));
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const pad = Math.max(w, h) * padding + wall;
  return (
    <svg
      className={className}
      viewBox={`${b.minX - pad} ${b.minY - pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {shapes.map((s, i) => (
        <polygon
          key={i}
          points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={s.color ?? "#ffffff"}
          stroke={stroke}
          strokeWidth={wall}
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  );
}
