"use client";
/** Operazioni lato browser sulle planimetrie importate. */
import type { FloorplanBackground } from "@/domain/schema";
import type { SnapLine } from "@/lib/geometry/snap";
import { analyzeRaster, wallEdgeLines } from "./localAnalysis";
import { imagePixels } from "./load";
import type { FloorplanAnalysis } from "./types";

const ANALYSIS_SIDE = 1100;
const REMOTE_SIDE = 1600;

const lineCache = new Map<string, Promise<{ lines: SnapLine[]; thicknessCm: number }>>();

function key(bg: FloorplanBackground) {
  return `${bg.src.length}:${bg.src.slice(-64)}`;
}

/** Facce dei muri rilevate nella planimetria, in coordinate di piano (cm). */
export function backgroundSnapLines(bg: FloorplanBackground): Promise<{ lines: SnapLine[]; thicknessCm: number }> {
  const k = key(bg);
  let pixelLines = lineCache.get(k);
  if (!pixelLines) {
    pixelLines = imagePixels(bg.src, ANALYSIS_SIDE).then((px) => {
      const { lines, thickness } = wallEdgeLines({ data: px.data, width: px.width, height: px.height });
      // Coordinate in pixel dell'immagine originale (cm per pixel = 1 provvisorio).
      const toSrc = 1 / px.scale;
      return {
        lines: lines.map((l) => ({ axis: l.axis, value: l.value * toSrc, from: l.from * toSrc, to: l.to * toSrc })),
        thicknessCm: thickness * toSrc,
      };
    });
    lineCache.set(k, pixelLines);
  }
  return pixelLines.then(({ lines, thicknessCm }) => ({
    lines: lines.map((l) => ({
      axis: l.axis,
      value: (l.axis === "h" ? bg.y : bg.x) + l.value * bg.cmPerPixel,
      from: (l.axis === "h" ? bg.x : bg.y) + l.from * bg.cmPerPixel,
      to: (l.axis === "h" ? bg.x : bg.y) + l.to * bg.cmPerPixel,
    })),
    thicknessCm: thicknessCm * bg.cmPerPixel,
  }));
}

export interface AnalyzerInfo {
  id: "local" | "claude";
  label: string;
  available: boolean;
}

export async function availableAnalyzers(): Promise<{ analyzers: AnalyzerInfo[]; default: "local" | "claude" }> {
  try {
    const res = await fetch("/api/floorplan/analyze");
    if (res.ok) return res.json();
  } catch {
    /* rete non disponibile: solo analisi locale */
  }
  return { analyzers: [{ id: "local", label: "Riconoscimento locale", available: true }], default: "local" };
}

/** Esegue il riconoscimento: restituisce la bozza e la larghezza dell'immagine analizzata. */
export async function runAnalysis(
  bg: FloorplanBackground,
  analyzer: "local" | "claude",
): Promise<{ analysis: FloorplanAnalysis; analyzedWidth: number }> {
  if (analyzer === "claude") {
    const px = await imagePixels(bg.src, REMOTE_SIDE);
    const image = px.canvas.toDataURL("image/jpeg", 0.9);
    const res = await fetch("/api/floorplan/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, width: px.width, height: px.height }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Analisi non riuscita");
    return { analysis: body.analysis as FloorplanAnalysis, analyzedWidth: px.width };
  }
  const px = await imagePixels(bg.src, ANALYSIS_SIDE);
  // La scala dell'immagine analizzata è quella dello sfondo divisa per il fattore di riduzione.
  const cmPerPixel = bg.calibrated ? bg.cmPerPixel / px.scale : undefined;
  const analysis = analyzeRaster({ data: px.data, width: px.width, height: px.height }, { cmPerPixel });
  return { analysis, analyzedWidth: px.width };
}

/** Sfondo iniziale: scala presunta (larghezza ~15 m) da correggere con la calibrazione. */
export function initialBackground(img: { dataUrl: string; width: number; height: number }, at: { x: number; y: number }): FloorplanBackground {
  return {
    src: img.dataUrl,
    pixelWidth: img.width,
    pixelHeight: img.height,
    x: at.x,
    y: at.y,
    cmPerPixel: 1500 / Math.max(img.width, img.height),
    opacity: 0.55,
    visible: true,
    calibrated: false,
    locked: true,
  };
}

/** Nuova scala dello sfondo dati due punti (coordinate di piano) e la distanza reale in cm. */
export function calibrateBackground(
  bg: FloorplanBackground,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  realCm: number,
): FloorplanBackground {
  const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (measured < 1e-6 || realCm <= 0) return bg;
  const k = realCm / measured;
  // Il primo punto resta fermo nel piano.
  return {
    ...bg,
    cmPerPixel: bg.cmPerPixel * k,
    x: p1.x - (p1.x - bg.x) * k,
    y: p1.y - (p1.y - bg.y) * k,
    calibrated: true,
  };
}
