/**
 * Riconoscimento automatico delle planimetrie.
 * Un FloorplanAnalyzer riceve l'immagine e restituisce una BOZZA in pixel
 * dell'immagine: stanze (poligoni sulla faccia interna dei muri) e aperture.
 * La bozza viene poi convertita in stanze modificabili come quelle disegnate.
 */
import type { OpeningKind, RoomType } from "@/domain/schema";

export interface PixelPoint {
  x: number;
  y: number;
}

export interface DetectedRoom {
  polygon: PixelPoint[];
  /** Spessore del muro dietro ogni lato (pixel), se misurato. */
  edgeThicknessPx?: number[];
  name?: string;
  type?: RoomType;
}

export interface DetectedOpening {
  kind: OpeningKind;
  /** Estremi dell'apertura lungo il muro (pixel). */
  a: PixelPoint;
  b: PixelPoint;
}

export interface FloorplanAnalysis {
  rooms: DetectedRoom[];
  openings: DetectedOpening[];
  /** Spessore tipico dei muri in pixel dell'immagine. */
  wallThicknessPx: number;
  /** Scala stimata dall'analizzatore (cm per pixel), se ricavabile dalle quote. */
  cmPerPixel?: number;
  notes: string[];
  analyzer: "local" | "claude";
}

export interface FloorplanImage {
  /** Data URL (PNG/JPEG). */
  dataUrl: string;
  width: number;
  height: number;
}

export interface AnalyzeOptions {
  /** Scala nota (cm per pixel dell'immagine), se già calibrata. */
  cmPerPixel?: number;
}

export interface FloorplanAnalyzer {
  id: "local" | "claude";
  label: string;
  analyze(image: FloorplanImage, opts: AnalyzeOptions): Promise<FloorplanAnalysis>;
}
