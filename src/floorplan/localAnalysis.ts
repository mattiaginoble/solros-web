/**
 * Analizzatore locale delle planimetrie (euristico, senza servizi esterni).
 *
 * 1. scala di grigi e soglia di Otsu → maschera dell'inchiostro;
 * 2. stima dello spessore dei muri e apertura morfologica per eliminare
 *    testi, quote e arredi disegnati con tratto sottile;
 * 3. chiusura morfologica per sigillare le aperture delle porte;
 * 4. lo spazio libero collegato al bordo è l'esterno, le altre regioni sono stanze;
 * 5. contorni ortogonalizzati delle stanze; le porte sono i varchi chiusi
 *    dalla chiusura grande, le finestre i vani ricostruiti dalle linee sottili.
 */
import type { AnalyzeOptions, DetectedOpening, DetectedRoom, FloorplanAnalysis } from "./types";
import {
  type Mask,
  binarize,
  borderLabels,
  close,
  detectEdgeLines,
  estimateWallThicknesses,
  labelFree,
  open,
  orthogonalize,
  simplifyPolygon,
  toGray,
  traceComponent,
} from "./raster";

export interface RasterInput {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface WallMasks {
  ink: Mask;
  /** Muri con le finestre ricostruite (linee sottili nella fascia del muro). */
  walls: Mask;
  /** Muri senza ricostruzione: le finestre restano come vani. */
  wallsStrict: Mask;
  thickness: number;
  /** Spessore dei muri più sottili (in genere i tramezzi interni). */
  thinnest: number;
}

/** Maschera dei soli muri (tratti spessi) e spessore stimato. */
export function wallMask(input: RasterInput): WallMasks {
  const gray = toGray(input.data, input.width, input.height);
  const ink = binarize(gray);
  const est = estimateWallThicknesses(ink);
  const thickness = Math.max(2, est.typical);
  const thinnest = Math.max(2, est.thinnest);
  // L'apertura deve conservare anche i muri più sottili: si dimensiona sul minimo.
  const rOpen = Math.max(1, Math.floor(thinnest * 0.4));
  // Le finestre stanno nei muri esterni: le loro linee distano fino a circa metà dello spessore tipico.
  const rFuse = Math.max(1, Math.ceil(thinnest * 0.35), Math.ceil(thickness * 0.3));
  const wallsStrict = open(ink, rOpen);
  // Le finestre sono disegnate come linee sottili parallele dentro lo spessore del muro:
  // una piccola chiusura le fonde in una fascia piena prima di eliminare i tratti sottili.
  const walls = open(close(ink, rFuse), rOpen);
  return { ink, walls, wallsStrict, thickness, thinnest };
}

/** Linee delle facce dei muri, usate per lo snap durante il ricalco. */
export function wallEdgeLines(input: RasterInput) {
  const { walls, thickness } = wallMask(input);
  return { lines: detectEdgeLines(walls, Math.max(12, thickness * 3)), thickness };
}

export function analyzeRaster(input: RasterInput, opts: AnalyzeOptions = {}): FloorplanAnalysis {
  const { width: w, height: h } = input;
  const notes: string[] = [];
  const { walls, wallsStrict, thickness, thinnest } = wallMask(input);
  // Porte larghe fino a ~110 cm se la scala è nota, altrimenti ~6 volte lo spessore dei muri.
  const gapPx = opts.cmPerPixel ? 110 / opts.cmPerPixel : thickness * 6;
  const rClose = Math.max(2, Math.min(Math.ceil(gapPx / 2), Math.ceil(Math.min(w, h) / 6)));
  const closed = close(walls, rClose);

  const { labels, count, sizes } = labelFree(closed);
  const exterior = borderLabels(labels, w, h);
  const minArea = opts.cmPerPixel ? 8000 / opts.cmPerPixel ** 2 : w * h * 0.004;
  const rooms: DetectedRoom[] = [];
  const roomLabels: number[] = [];
  for (let l = 0; l < count; l++) {
    if (exterior.has(l) || sizes[l] < minArea) continue;
    const contour = traceComponent(labels, w, h, l);
    if (contour.length < 4) continue;
    const poly = orthogonalize(simplifyPolygon(contour, Math.max(1.5, thinnest * 0.5)));
    if (poly.length < 3) continue;
    rooms.push({ polygon: poly, edgeThicknessPx: measureEdgeThickness(poly, walls, thickness * 3) });
    roomLabels.push(l);
  }
  if (rooms.length === 0) notes.push("Nessuna stanza chiusa riconosciuta: prova a calibrare la scala o a ricalcare a mano.");

  // Aperture: porte = pixel aggiunti dalla chiusura grande; finestre = vani ricostruiti dalle linee sottili.
  const openings: DetectedOpening[] = [];
  const roomSet = new Set(roomLabels);
  const probe = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return -2;
    return labels[yi * w + xi];
  };
  const collect = (added: Uint8Array, forced: "door" | "window" | null) => {
    const gaps = labelFree({ data: added.map((v) => (v ? 0 : 1)), w, h });
    for (let g = 0; g < gaps.count; g++) {
      if (gaps.sizes[g] < thinnest * thinnest * 1.2) continue;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      for (let i = 0; i < gaps.labels.length; i++) {
        if (gaps.labels[i] !== g) continue;
        const x = i % w;
        const y = (i - x) / w;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const horizontal = bw >= bh;
      const length = horizontal ? bw : bh;
      const depth = horizontal ? bh : bw;
      // Un'apertura è più lunga che spessa e non più profonda di un paio di muri.
      if (length < Math.max(thinnest * 1.5, 6) || depth > thickness * 3) continue;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const off = depth / 2 + thinnest * 0.8 + 2;
      const sideA = horizontal ? probe(cx, cy - off) : probe(cx - off, cy);
      const sideB = horizontal ? probe(cx, cy + off) : probe(cx + off, cy);
      const aRoom = roomSet.has(sideA);
      const bRoom = roomSet.has(sideB);
      // Un'apertura separa due ambienti diversi: i tratti dentro una stanza (testi, arredi) si scartano.
      if ((!aRoom && !bRoom) || sideA === sideB) continue;
      const kind = forced ?? (aRoom && bRoom ? "door" : "window");
      openings.push(
        horizontal
          ? { kind, a: { x: minX, y: cy }, b: { x: maxX + 1, y: cy } }
          : { kind, a: { x: cx, y: minY }, b: { x: cx, y: maxY + 1 } },
      );
    }
  };
  const doorPixels = new Uint8Array(w * h);
  const windowPixels = new Uint8Array(w * h);
  for (let i = 0; i < doorPixels.length; i++) {
    doorPixels[i] = closed.data[i] && !walls.data[i] ? 1 : 0;
    windowPixels[i] = walls.data[i] && !wallsStrict.data[i] ? 1 : 0;
  }
  // I varchi senza linee sono porte (anche il portoncino verso l'esterno); le finestre sono i vani con le linee del vetro.
  collect(doorPixels, "door");
  collect(windowPixels, "window");

  return { rooms, openings, wallThicknessPx: thinnest, notes, analyzer: "local" };
}

/**
 * Spessore del muro dietro ogni lato del poligono: si contano i pixel di muro
 * procedendo verso l'esterno in tre punti del lato e si prende la mediana.
 */
function measureEdgeThickness(poly: { x: number; y: number }[], walls: Mask, max: number): number[] {
  const n = poly.length;
  // Verso del poligono (area con segno positiva = orario a schermo, normale esterna (dy, -dx)).
  let area = 0;
  for (let i = 0; i < n; i++) area += poly[i].x * poly[(i + 1) % n].y - poly[(i + 1) % n].x * poly[i].y;
  const sign = area >= 0 ? 1 : -1;
  return poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    const nx = dy * sign;
    const ny = -dx * sign;
    const samples: number[] = [];
    for (const t of [0.25, 0.5, 0.75]) {
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      let count = 0;
      for (let d = 0.5; d < max; d += 1) {
        const x = Math.floor(px + nx * d);
        const y = Math.floor(py + ny * d);
        if (x < 0 || y < 0 || x >= walls.w || y >= walls.h || !walls.data[y * walls.w + x]) break;
        count++;
      }
      if (count > 0) samples.push(count);
    }
    samples.sort((p, q) => p - q);
    return samples.length ? samples[Math.floor(samples.length / 2)] : 0;
  });
}
