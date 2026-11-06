import type { OpeningKind, RoomType } from "./schema";

export const ROOM_TYPES: { id: RoomType; label: string; color: string }[] = [
  { id: "soggiorno", label: "Soggiorno", color: "#fde2b3" },
  { id: "cucina", label: "Cucina", color: "#fcd5ce" },
  { id: "sala_pranzo", label: "Sala da pranzo", color: "#fbe3c9" },
  { id: "camera", label: "Camera", color: "#d8e2fc" },
  { id: "cameretta", label: "Cameretta", color: "#e3d8fc" },
  { id: "bagno", label: "Bagno", color: "#c8ecf5" },
  { id: "studio", label: "Studio", color: "#d5f0d5" },
  { id: "ingresso", label: "Ingresso", color: "#ece6da" },
  { id: "corridoio", label: "Corridoio", color: "#e6e6e6" },
  { id: "ripostiglio", label: "Ripostiglio", color: "#dddcd8" },
  { id: "lavanderia", label: "Lavanderia", color: "#d3eef0" },
  { id: "balcone", label: "Balcone", color: "#dff0c8" },
  { id: "garage", label: "Garage", color: "#d6d6d6" },
  { id: "altro", label: "Altro", color: "#eeeeee" },
];

export const ROOM_TYPE_LABEL: Record<RoomType, string> = Object.fromEntries(
  ROOM_TYPES.map((t) => [t.id, t.label]),
) as Record<RoomType, string>;

export const ROOM_TYPE_COLOR: Record<RoomType, string> = Object.fromEntries(
  ROOM_TYPES.map((t) => [t.id, t.color]),
) as Record<RoomType, string>;

/** Palette proposta nel selettore colore delle stanze. */
export const ROOM_COLOR_SWATCHES = [
  "#fde2b3",
  "#fcd5ce",
  "#fbe3c9",
  "#d8e2fc",
  "#e3d8fc",
  "#c8ecf5",
  "#d5f0d5",
  "#ece6da",
  "#e6e6e6",
  "#dff0c8",
  "#f7d6e6",
  "#fff3b0",
];

export const OPENING_DEFAULTS: Record<
  OpeningKind,
  { width: number; height: number; sill: number; label: string }
> = {
  door: { width: 80, height: 210, sill: 0, label: "Porta" },
  window: { width: 120, height: 140, sill: 90, label: "Finestra" },
  passage: { width: 90, height: 210, sill: 0, label: "Passaggio" },
};

export const DEFAULT_WALL_THICKNESS = 10;
export const EXTERIOR_WALL_THICKNESS = 30;
export const DEFAULT_CEILING_HEIGHT = 270;
export const DEFAULT_GRID = 10;

/** Larghezza minima di un lato perché vi si possa inserire un'apertura. */
export const MIN_WALL_FOR_OPENING = 30;
