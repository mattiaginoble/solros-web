"use client";
import { useState } from "react";
import { Circle, Group, Line } from "react-konva";
import { Button } from "@/components/ui/controls";
import type { Vec2 } from "@/lib/geometry/vec";
import { useView2D, worldToScreen } from "@/store/view2d";
import { useEditor } from "@/store/editor";
import { applyCalibration, getBackground } from "@/store/floorplan";
import { PLAN } from "./style";

/** Segmento di calibrazione disegnato sulla pianta (parte Konva). */
export function CalibrationShapes({ points, cursor }: { points: Vec2[]; cursor: Vec2 | null }) {
  const scale = useView2D((s) => s.scale);
  const pts = points.length === 1 && cursor ? [points[0], cursor] : points;
  return (
    <Group listening={false}>
      {pts.length === 2 && (
        <Line points={[pts[0].x, pts[0].y, pts[1].x, pts[1].y]} stroke="#c2410c" strokeWidth={2.5} dash={[8, 5]} strokeScaleEnabled={false} />
      )}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={6 / scale} fill="#c2410c" stroke={PLAN.white} strokeWidth={2} strokeScaleEnabled={false} />
      ))}
    </Group>
  );
}

/** Istruzioni e richiesta della distanza reale (parte HTML sopra la pianta). */
export function CalibrationPanel({ points, onReset }: { points: Vec2[]; onReset: () => void }) {
  const bg = getBackground();
  const setTool = useEditor((s) => s.setTool);
  const openDialog = useEditor((s) => s.openDialog);
  const measured = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0;
  const [value, setValue] = useState("");
  const view = useView2D();
  if (!bg) {
    return (
      <div className="absolute left-3 top-3 rounded-[5px] border border-line bg-panel px-3 py-2 text-sm">
        Carica prima una planimetria.{" "}
        <button type="button" className="font-medium text-prussian underline" onClick={() => openDialog("import")}>
          Carica
        </button>
      </div>
    );
  }
  const anchor = points.length === 2 ? worldToScreen({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }) : null;
  const submit = () => {
    const real = Number(value.replace(",", "."));
    if (!(real > 0)) return;
    applyCalibration(points[0], points[1], real);
    onReset();
    openDialog("import-next");
  };
  return (
    <>
      <div className="pointer-events-auto absolute left-3 top-3 max-w-md rounded-[6px] border border-[#c2410c]/50 bg-panel/95 px-3 py-2 text-[13px] leading-snug text-graphite-soft">
        <strong className="block text-graphite">Imposta la scala</strong>
        {points.length === 0 && "Clicca il primo estremo di una misura nota, ad esempio un muro quotato o una porta da 80 cm."}
        {points.length === 1 && "Ora clicca il secondo estremo della misura."}
        {points.length === 2 && "Inserisci la distanza reale tra i due punti."}
        <span className="mt-1.5 flex gap-2">
          <button type="button" className="text-xs font-medium text-prussian underline" onClick={onReset}>
            Ricomincia
          </button>
          <button
            type="button"
            className="text-xs font-medium text-prussian underline"
            onClick={() => {
              onReset();
              setTool("select");
              openDialog("import-next");
            }}
          >
            Salta: mantieni la scala stimata
          </button>
        </span>
      </div>
      {anchor && (
        <form
          className="absolute z-10 flex items-end gap-2 rounded-[6px] border border-line-strong bg-panel p-2.5 shadow-[0_12px_30px_-12px_rgba(35,39,43,0.45)]"
          style={{
            left: Math.min(Math.max(8, anchor.x - 130), view.width - 270),
            top: Math.min(Math.max(8, anchor.y + 16), view.height - 80),
          }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Distanza reale</span>
            <span className="flex h-9 items-center rounded-[5px] border border-line-strong bg-panel pr-2 focus-within:border-prussian">
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                placeholder={String(Math.round(measured))}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-full w-24 bg-transparent px-2 text-sm outline-none"
                aria-label="Distanza reale in centimetri"
              />
              <span className="text-xs text-muted">cm</span>
            </span>
          </label>
          <Button type="submit" variant="primary">
            Applica scala
          </Button>
        </form>
      )}
    </>
  );
}
