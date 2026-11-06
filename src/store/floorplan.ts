/** Azioni sulla planimetria di sfondo del piano attivo. */
import { analysisToRooms } from "@/floorplan/apply";
import { calibrateBackground, initialBackground, runAnalysis } from "@/floorplan/client";
import type { LoadedImage } from "@/floorplan/load";
import type { FloorplanBackground } from "@/domain/schema";
import { activeFloor, useEditor } from "./editor";
import { floorBBox } from "./actions";
import { useView2D } from "./view2d";

const st = () => useEditor.getState();

export function getBackground(): FloorplanBackground | null {
  return activeFloor(st()).background ?? null;
}

export function setBackground(bg: FloorplanBackground | null) {
  const s = st();
  const id = s.activeFloorId;
  s.apply((h) => {
    const f = h.floors.find((x) => x.id === id);
    if (f) f.background = bg;
  });
}

export function updateBackground(patch: Partial<FloorplanBackground>) {
  const bg = getBackground();
  if (bg) setBackground({ ...bg, ...patch });
}

export function fitToBackground(bg = getBackground()) {
  if (!bg) return;
  useView2D.getState().fit({
    minX: bg.x,
    minY: bg.y,
    maxX: bg.x + bg.pixelWidth * bg.cmPerPixel,
    maxY: bg.y + bg.pixelHeight * bg.cmPerPixel,
  }, 40);
}

/** Inserisce l'immagine come sfondo del piano attivo e avvia la calibrazione. */
export function placeFloorplan(img: LoadedImage) {
  const s = st();
  const box = floorBBox(activeFloor(s).rooms);
  const at = box ? { x: Math.round(box.maxX + 200), y: Math.round(box.minY) } : { x: 0, y: 0 };
  const bg = initialBackground(img, at);
  setBackground(bg);
  requestAnimationFrame(() => fitToBackground(bg));
  s.select(null);
  s.setTool("calibrate");
}

export function applyCalibration(p1: { x: number; y: number }, p2: { x: number; y: number }, realCm: number) {
  const bg = getBackground();
  if (!bg) return;
  const next = calibrateBackground(bg, p1, p2, realCm);
  setBackground(next);
  st().setTool("select");
  requestAnimationFrame(() => fitToBackground(next));
}

/** Riconoscimento automatico: aggiunge al piano le stanze e le aperture trovate. */
export async function recognizeFloorplan(analyzer: "local" | "claude") {
  const s = st();
  const bg = getBackground();
  if (!bg) return { rooms: 0, openings: 0, notes: [] as string[] };
  const { analysis, analyzedWidth } = await runAnalysis(bg, analyzer);
  // Se l'analizzatore ha letto la scala dalle quote e lo sfondo non è calibrato, la si usa.
  let base = bg;
  if (!bg.calibrated && analysis.cmPerPixel) {
    base = { ...bg, cmPerPixel: (analysis.cmPerPixel * analyzedWidth) / bg.pixelWidth, calibrated: true };
    setBackground(base);
  }
  const res = analysisToRooms(analysis, base, analyzedWidth, {
    ceilingHeight: s.house.settings.defaultCeilingHeight,
  });
  const floorId = s.activeFloorId;
  st().apply((h) => {
    const f = h.floors.find((x) => x.id === floorId);
    if (f) f.rooms.push(...res.rooms);
  });
  return { rooms: res.rooms.length, openings: res.openingsPlaced, notes: analysis.notes };
}
