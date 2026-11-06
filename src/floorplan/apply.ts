/**
 * Conversione della bozza riconosciuta (pixel dell'immagine) in stanze e
 * aperture del modello, nelle coordinate del piano. Funzione pura.
 */
import { createRoom } from "@/domain/factory";
import { addOpening, nearestWallInRooms } from "@/domain/roomOps";
import type { FloorplanBackground, Room } from "@/domain/schema";
import { area } from "@/lib/geometry/polygon";
import type { FloorplanAnalysis, PixelPoint } from "./types";

export interface ApplyResult {
  rooms: Room[];
  openingsPlaced: number;
  openingsSkipped: number;
}

/**
 * @param analyzedWidth larghezza in pixel dell'immagine analizzata (può essere ridotta rispetto allo sfondo)
 */
export function analysisToRooms(
  analysis: FloorplanAnalysis,
  bg: Pick<FloorplanBackground, "x" | "y" | "cmPerPixel" | "pixelWidth">,
  analyzedWidth: number,
  opts: { ceilingHeight: number; namePrefix?: string } = { ceilingHeight: 270 },
): ApplyResult {
  const pxToSrc = bg.pixelWidth / analyzedWidth;
  const cmPerPx = bg.cmPerPixel * pxToSrc;
  const toWorld = (p: PixelPoint) => ({
    x: Math.round((bg.x + p.x * cmPerPx) * 10) / 10,
    y: Math.round((bg.y + p.y * cmPerPx) * 10) / 10,
  });
  const thickness = Math.min(40, Math.max(6, Math.round(analysis.wallThicknessPx * cmPerPx)));
  let rooms: Room[] = [];
  analysis.rooms.forEach((r, i) => {
    const poly = r.polygon.map(toWorld);
    if (poly.length < 3 || area(poly) < 5000) return;
    const perEdge = r.edgeThicknessPx?.length === r.polygon.length
      ? r.edgeThicknessPx.map((t) => (t > 0 ? Math.min(60, Math.max(6, Math.round(t * cmPerPx))) : thickness))
      : thickness;
    rooms.push(
      createRoom({
        polygon: poly,
        type: r.type ?? "altro",
        name: r.name ?? `${opts.namePrefix ?? "Stanza"} ${i + 1}`,
        wallThickness: perEdge,
        ceilingHeight: opts.ceilingHeight,
      }),
    );
  });

  let placed = 0;
  let skipped = 0;
  for (const o of analysis.openings) {
    const a = toWorld(o.a);
    const b = toWorld(o.b);
    const width = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const hit = nearestWallInRooms(rooms, center, thickness + 15);
    if (!hit || width < 30) {
      skipped++;
      continue;
    }
    const idx = rooms.findIndex((r) => r.id === hit.roomId);
    const res = addOpening(rooms[idx], o.kind, hit.wallId, hit.s, { width: Math.min(width, hit.length) });
    if (res.opening) {
      rooms = rooms.map((r, i) => (i === idx ? res.room : r));
      placed++;
    } else skipped++;
  }
  return { rooms, openingsPlaced: placed, openingsSkipped: skipped };
}
