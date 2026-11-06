/**
 * Operazioni pure sulle stanze. Ogni funzione restituisce una nuova stanza,
 * mantenendo allineati poligono, muri (uno per lato) e aperture.
 */
import { MIN_WALL_FOR_OPENING } from "./constants";
import { createOpening, uid } from "./factory";
import type { Opening, OpeningKind, Room, Vec2 } from "./schema";
import {
  areaM2,
  cleanPolygon,
  edgeLength,
  edges,
  perimeter,
  projectOnSegment,
  signedArea,
} from "@/lib/geometry/polygon";
import { localToWorld, worldToLocal } from "@/lib/geometry/transform";
import { add, distance, dot, mul, normalize, sub, clamp, round } from "@/lib/geometry/vec";

export interface RoomStats {
  areaM2: number;
  perimeter: number;
  edgeLengths: number[];
}

export function roomStats(room: Room): RoomStats {
  return {
    areaM2: areaM2(room.polygon),
    perimeter: perimeter(room.polygon),
    edgeLengths: room.polygon.map((_, i) => edgeLength(room.polygon, i)),
  };
}

/**
 * Riporta la stanza in uno stato coerente: orientamento positivo, un muro per
 * lato, aperture contenute nel proprio muro.
 */
export function normalizeRoom(room: Room, defaultThickness = 10): Room {
  let polygon = room.polygon;
  let walls = room.walls;
  let openings = room.openings;
  if (walls.length !== polygon.length) {
    walls = polygon.map((_, i) => walls[i] ?? { id: uid("w"), thickness: walls[walls.length - 1]?.thickness ?? defaultThickness });
  }
  if (signedArea(polygon) < 0) {
    // Invertendo il verso, il lato i (p_i → p_i+1) diventa il lato n-2-i (p_i+1 → p_i).
    const n = polygon.length;
    const lengths = polygon.map((_, i) => edgeLength(polygon, i));
    polygon = [...polygon].reverse();
    const reversedWalls = walls.map((_, k) => walls[(n - 2 - k + n) % n]);
    openings = openings.map((o) => {
      const idx = walls.findIndex((w) => w.id === o.wallId);
      if (idx < 0) return o;
      return { ...o, offset: lengths[idx] - o.offset - o.width, hinge: o.hinge === "start" ? "end" : "start" };
    });
    walls = reversedWalls;
  }
  return clampOpenings({ ...room, polygon, walls, openings });
}

/** Mantiene le aperture dentro il proprio muro; rimuove quelle su muri inesistenti o troppo corti. */
export function clampOpenings(room: Room): Room {
  const lengths = new Map(room.walls.map((w, i) => [w.id, edgeLength(room.polygon, i)]));
  const openings: Opening[] = [];
  for (const o of room.openings) {
    const len = lengths.get(o.wallId);
    if (len === undefined || len < Math.min(MIN_WALL_FOR_OPENING, o.width)) continue;
    const width = Math.min(o.width, len);
    const offset = clamp(o.offset, 0, len - width);
    openings.push(width === o.width && offset === o.offset ? o : { ...o, width, offset });
  }
  return { ...room, openings };
}

export function setVertex(room: Room, index: number, p: Vec2): Room {
  const polygon = room.polygon.map((q, i) => (i === index ? { ...p } : q));
  return normalizeRoom({ ...room, polygon });
}

/** Sposta il lato `index` lungo la sua normale esterna di `delta` cm. */
export function moveEdge(room: Room, index: number, delta: number): Room {
  const n = room.polygon.length;
  const e = edges(room.polygon)[index];
  const d = mul(e.normal, delta);
  const polygon = room.polygon.map((q, i) => (i === index || i === (index + 1) % n ? add(q, d) : q));
  return normalizeRoom({ ...room, polygon });
}

/**
 * Imposta la lunghezza del lato `index`. Il vertice finale si sposta lungo la
 * direzione del lato; se il lato successivo è perpendicolare viene traslato
 * anch'esso, così le forme ortogonali (rettangoli, L) restano ortogonali.
 */
export function setEdgeLength(room: Room, index: number, newLength: number): Room {
  const poly = room.polygon;
  const n = poly.length;
  const a = poly[index];
  const b = poly[(index + 1) % n];
  const c = poly[(index + 2) % n];
  const dir = normalize(sub(b, a));
  const delta = newLength - distance(a, b);
  if (Math.abs(delta) < 1e-6) return room;
  const move = mul(dir, delta);
  const nextDir = normalize(sub(c, b));
  const perpendicular = Math.abs(dot(nextDir, dir)) < 0.01 && n >= 4;
  const moved = new Set([(index + 1) % n]);
  if (perpendicular) moved.add((index + 2) % n);
  const polygon = poly.map((q, i) => (moved.has(i) ? add(q, move) : q));
  return normalizeRoom({ ...room, polygon });
}

/** Inserisce un vertice sul lato `edgeIndex` nel punto locale `p` (proiettato sul lato). */
export function insertVertex(room: Room, edgeIndex: number, p: Vec2): Room {
  const n = room.polygon.length;
  const a = room.polygon[edgeIndex];
  const b = room.polygon[(edgeIndex + 1) % n];
  const proj = projectOnSegment(p, a, b);
  if (proj.t < 0.01 || proj.t > 0.99) return room;
  const split = round(distance(a, proj.point), 2);
  const point = { x: round(proj.point.x, 2), y: round(proj.point.y, 2) };
  const polygon = [...room.polygon.slice(0, edgeIndex + 1), point, ...room.polygon.slice(edgeIndex + 1)];
  const oldWall = room.walls[edgeIndex];
  const newWall = { id: uid("w"), thickness: oldWall.thickness };
  const walls = [...room.walls.slice(0, edgeIndex + 1), newWall, ...room.walls.slice(edgeIndex + 1)];
  const openings = room.openings.map((o) => {
    if (o.wallId !== oldWall.id) return o;
    const center = o.offset + o.width / 2;
    return center > split ? { ...o, wallId: newWall.id, offset: o.offset - split } : o;
  });
  return normalizeRoom({ ...room, polygon, walls, openings });
}

/** Rimuove un vertice unendo i due lati adiacenti (minimo 3 vertici). */
export function removeVertex(room: Room, index: number): Room {
  const n = room.polygon.length;
  if (n <= 3) return room;
  const prevIdx = (index - 1 + n) % n;
  const prevWall = room.walls[prevIdx];
  const curWall = room.walls[index];
  const prevA = room.polygon[prevIdx];
  const next = room.polygon[(index + 1) % n];
  const es = edges(room.polygon);
  const newDir = normalize(sub(next, prevA));
  // Centri delle aperture sui due lati coinvolti, riproiettati sul nuovo lato.
  const openings = room.openings.map((o) => {
    if (o.wallId !== prevWall.id && o.wallId !== curWall.id) return o;
    const e = es[o.wallId === prevWall.id ? prevIdx : index];
    const center = add(e.a, mul(e.dir, o.offset + o.width / 2));
    const s = dot(sub(center, prevA), newDir);
    return { ...o, wallId: prevWall.id, offset: s - o.width / 2 };
  });
  const polygon = room.polygon.filter((_, i) => i !== index);
  const walls = room.walls.filter((_, i) => i !== index);
  const cleaned = cleanPolygon(polygon, false);
  if (cleaned.length < 3) return room;
  return normalizeRoom({ ...room, polygon, walls, openings });
}

export function setWallThickness(room: Room, wallId: string | "all", thickness: number): Room {
  const walls = room.walls.map((w) => (wallId === "all" || w.id === wallId ? { ...w, thickness } : w));
  return { ...room, walls };
}

export interface NearestWall {
  wallId: string;
  index: number;
  /** Distanza dal vertice iniziale lungo il lato (cm). */
  s: number;
  dist: number;
  length: number;
}

/** Muro della stanza più vicino al punto locale `p`. */
export function nearestWall(room: Room, p: Vec2): NearestWall | null {
  let best: NearestWall | null = null;
  edges(room.polygon).forEach((e, i) => {
    const proj = projectOnSegment(p, e.a, e.b);
    if (!best || proj.dist < best.dist) {
      best = { wallId: room.walls[i].id, index: i, s: proj.t * e.length, dist: proj.dist, length: e.length };
    }
  });
  return best;
}

/** Muro più vicino a un punto del piano, tra tutte le stanze. */
export function nearestWallInRooms(
  rooms: Room[],
  world: Vec2,
  maxDist: number,
): (NearestWall & { roomId: string }) | null {
  let best: (NearestWall & { roomId: string }) | null = null;
  for (const r of rooms) {
    const local = worldToLocal(r, world);
    const w = nearestWall(r, local);
    if (!w) continue;
    const thickness = r.walls[w.index]?.thickness ?? 10;
    // Il cursore può trovarsi sopra lo spessore del muro: la distanza è misurata dalla faccia interna.
    const effective = Math.max(0, w.dist - thickness);
    if (effective > maxDist) continue;
    if (!best || effective < best.dist) best = { ...w, dist: effective, roomId: r.id };
  }
  return best;
}

/** Aggiunge un'apertura centrata nel punto `s` del muro. */
export function addOpening(
  room: Room,
  kind: OpeningKind,
  wallId: string,
  centerS: number,
  overrides: Partial<Omit<Opening, "id" | "kind" | "wallId">> = {},
): { room: Room; opening: Opening | null } {
  const idx = room.walls.findIndex((w) => w.id === wallId);
  if (idx < 0) return { room, opening: null };
  const len = edgeLength(room.polygon, idx);
  const base = createOpening(kind, wallId, 0, overrides);
  const width = Math.min(base.width, Math.max(len - 10, 20));
  if (len < MIN_WALL_FOR_OPENING) return { room, opening: null };
  const opening = { ...base, width, offset: clamp(round(centerS - width / 2, 0), 0, len - width) };
  return { room: { ...room, openings: [...room.openings, opening] }, opening };
}

export function updateOpening(room: Room, openingId: string, patch: Partial<Opening>): Room {
  return clampOpenings({
    ...room,
    openings: room.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)),
  });
}

/** Posizione nel piano di un vertice locale. */
export function vertexWorld(room: Room, index: number): Vec2 {
  return localToWorld(room, room.polygon[index]);
}
