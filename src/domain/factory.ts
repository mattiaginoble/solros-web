import { customAlphabet } from "nanoid";
import {
  DEFAULT_CEILING_HEIGHT,
  DEFAULT_GRID,
  DEFAULT_WALL_THICKNESS,
  OPENING_DEFAULTS,
  ROOM_TYPE_COLOR,
  ROOM_TYPE_LABEL,
} from "./constants";
import { defaultFloorMaterialFor, defaultWallMaterialFor } from "./materials";
import type { Floor, House, Opening, OpeningKind, Room, RoomType, Vec2, Wall } from "./schema";
import { bbox, cleanPolygon, ensurePositive, rectPolygon } from "@/lib/geometry/polygon";

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

/** Identificativo breve, sicuro da usare come chiave (nessun ':' o spazio). */
export const uid = (prefix = "") => (prefix ? `${prefix}_${nano()}` : nano());

export function createWalls(count: number, thickness = DEFAULT_WALL_THICKNESS): Wall[] {
  return Array.from({ length: count }, () => ({ id: uid("w"), thickness }));
}

export interface CreateRoomOptions {
  name?: string;
  type?: RoomType;
  color?: string;
  /** Poligono in coordinate di piano (verrà normalizzato con origine nel suo angolo in alto a sinistra). */
  polygon: Vec2[];
  rotation?: number;
  wallThickness?: number | number[];
  ceilingHeight?: number;
}

/**
 * Crea una stanza a partire da un poligono nel piano: lo orienta con area positiva,
 * rimuove i vertici superflui e porta l'origine locale nell'angolo del suo ingombro.
 */
export function createRoom(opts: CreateRoomOptions): Room {
  const type = opts.type ?? "altro";
  const cleaned = ensurePositive(cleanPolygon(opts.polygon));
  const b = bbox(cleaned);
  const local = cleaned.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY }));
  const rotation = opts.rotation ?? 0;
  // L'origine locale corrisponde all'angolo dell'ingombro nel piano (prima della rotazione).
  const origin = { x: b.minX, y: b.minY };
  const thickness = opts.wallThickness ?? DEFAULT_WALL_THICKNESS;
  const walls = local.map((_, i) => ({
    id: uid("w"),
    thickness: Array.isArray(thickness) ? (thickness[i] ?? DEFAULT_WALL_THICKNESS) : thickness,
  }));
  return {
    id: uid("r"),
    name: opts.name ?? ROOM_TYPE_LABEL[type],
    type,
    color: opts.color ?? ROOM_TYPE_COLOR[type],
    x: origin.x,
    y: origin.y,
    rotation,
    polygon: local,
    walls,
    openings: [],
    items: [],
    ceilingHeight: opts.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    floorMaterial: { ...pickMaterial(defaultFloorMaterialFor(type)) },
    wallMaterial: { ...pickMaterial(defaultWallMaterialFor(type)) },
  };
}

function pickMaterial(m: { id: string; color: string }) {
  return { id: m.id, color: m.color };
}

export function createRectRoom(
  width: number,
  length: number,
  opts: Omit<CreateRoomOptions, "polygon"> & { x?: number; y?: number } = {},
): Room {
  return createRoom({ ...opts, polygon: rectPolygon(width, length, opts.x ?? 0, opts.y ?? 0) });
}

export function createOpening(
  kind: OpeningKind,
  wallId: string,
  offset: number,
  overrides: Partial<Omit<Opening, "id" | "kind" | "wallId">> = {},
): Opening {
  const d = OPENING_DEFAULTS[kind];
  return {
    id: uid("o"),
    kind,
    wallId,
    offset,
    width: d.width,
    height: d.height,
    sill: d.sill,
    hinge: "start",
    swing: "in",
    ...overrides,
  };
}

export function floorName(level: number) {
  if (level === 0) return "Piano terra";
  if (level < 0) return level === -1 ? "Seminterrato" : `Interrato ${-level}`;
  return `Piano ${level}`;
}

export function createFloor(level = 0, opts: Partial<Floor> = {}): Floor {
  return {
    id: uid("f"),
    name: floorName(level),
    level,
    elevation: level * (DEFAULT_CEILING_HEIGHT + 30),
    slabThickness: 30,
    rooms: [],
    background: null,
    ...opts,
  };
}

export function createHouse(name = "Nuova casa"): House {
  return {
    schemaVersion: 1,
    id: uid("h"),
    name,
    floors: [createFloor(0)],
    settings: {
      gridSize: DEFAULT_GRID,
      defaultWallThickness: DEFAULT_WALL_THICKNESS,
      defaultCeilingHeight: DEFAULT_CEILING_HEIGHT,
      currency: "EUR",
    },
  };
}

/** Copia profonda di una stanza con nuovi identificativi (muri, aperture, oggetti). */
export function cloneRoomWithNewIds(room: Room, offset: Vec2 = { x: 0, y: 0 }): Room {
  const wallMap = new Map<string, string>();
  const walls = room.walls.map((w) => {
    const id = uid("w");
    wallMap.set(w.id, id);
    return { ...w, id };
  });
  return {
    ...structuredClone(room),
    id: uid("r"),
    x: room.x + offset.x,
    y: room.y + offset.y,
    walls,
    openings: room.openings.map((o) => ({ ...o, id: uid("o"), wallId: wallMap.get(o.wallId) ?? o.wallId })),
    items: room.items.map((it) => ({ ...structuredClone(it), id: uid("i") })),
    kitchen: room.kitchen
      ? {
          ...structuredClone(room.kitchen),
          runs: room.kitchen.runs.map((r) => ({ ...structuredClone(r), wallId: wallMap.get(r.wallId) ?? r.wallId })),
        }
      : undefined,
  };
}

/** Rinnova tutti gli id di una casa (duplicazione di progetto, import). */
export function cloneHouseWithNewIds(house: House): House {
  const floorMap = new Map<string, string>();
  const floors = house.floors.map((f) => {
    const id = uid("f");
    floorMap.set(f.id, id);
    return { ...structuredClone(f), id, rooms: f.rooms.map((r) => cloneRoomWithNewIds(r)) };
  });
  for (const f of floors)
    for (const r of f.rooms)
      for (const it of r.items) if (it.linkFloorId) it.linkFloorId = floorMap.get(it.linkFloorId);
  return { ...structuredClone(house), id: uid("h"), floors };
}


/** Oggetto del catalogo posizionato in una stanza (copia del prodotto inclusa). */
export function createPlacedItem(
  product: import("./schema").Product,
  x: number,
  y: number,
  rotation = 0,
  elevation?: number,
): import("./schema").PlacedItem {
  return {
    id: uid("i"),
    product: structuredClone(product),
    x,
    y,
    rotation,
    elevation: elevation ?? (product.mount === "floor" ? 0 : (product.elevation ?? (product.mount === "wall" ? 120 : 0))),
    quantity: 1,
  };
}
