"use client";
import { Layer, Shape } from "react-konva";
import { useView2D } from "@/store/view2d";
import { PLAN } from "./style";

/** Carta millimetrata: linee fini ogni passo di griglia, linee marcate ogni metro. */
export function GridLayer({ grid }: { grid: number }) {
  const { scale, x, y, width, height, showGrid } = useView2D();
  if (!showGrid) return null;
  const minX = -x / scale;
  const minY = -y / scale;
  const maxX = (width - x) / scale;
  const maxY = (height - y) / scale;
  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx) => {
          const c = ctx._context;
          const lw = 1 / scale;
          const drawLines = (step: number, color: string) => {
            c.beginPath();
            c.strokeStyle = color;
            c.lineWidth = lw;
            const sx = Math.floor(minX / step) * step;
            const sy = Math.floor(minY / step) * step;
            for (let gx = sx; gx <= maxX; gx += step) {
              c.moveTo(gx, minY);
              c.lineTo(gx, maxY);
            }
            for (let gy = sy; gy <= maxY; gy += step) {
              c.moveTo(minX, gy);
              c.lineTo(maxX, gy);
            }
            c.stroke();
          };
          if (grid * scale >= 5) drawLines(grid, PLAN.gridMinor);
          const major = 100 * scale >= 8 ? 100 : 500;
          drawLines(major, PLAN.gridMajor);
        }}
      />
    </Layer>
  );
}
