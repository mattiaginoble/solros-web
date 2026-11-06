import type { Room } from "@/domain/schema";
import { centroid } from "./polygon";
import { type Vec2, add, rotate, sub, normalizeAngle } from "./vec";

export interface Transform {
  x: number;
  y: number;
  rotation: number;
}

export function localToWorld(t: Transform, p: Vec2): Vec2 {
  return add(rotate(p, t.rotation), { x: t.x, y: t.y });
}

export function worldToLocal(t: Transform, p: Vec2): Vec2 {
  return rotate(sub(p, { x: t.x, y: t.y }), -t.rotation);
}

/** Converte una direzione (senza traslazione) da locale a mondo. */
export function dirToWorld(t: Transform, d: Vec2): Vec2 {
  return rotate(d, t.rotation);
}

export function dirToLocal(t: Transform, d: Vec2): Vec2 {
  return rotate(d, -t.rotation);
}

export function roomWorldPolygon(room: Room): Vec2[] {
  return room.polygon.map((p) => localToWorld(room, p));
}

/** Centro della stanza (baricentro del poligono) in coordinate di piano. */
export function roomWorldCenter(room: Room): Vec2 {
  return localToWorld(room, centroid(room.polygon));
}

/**
 * Nuova trasformazione dopo aver ruotato la stanza di `delta` gradi attorno al
 * proprio baricentro (che resta fermo nel piano).
 */
export function rotateRoomTransform(room: Room, delta: number): Transform {
  const c = centroid(room.polygon);
  const before = localToWorld(room, c);
  const rotation = normalizeAngle(room.rotation + delta);
  const after = localToWorld({ x: room.x, y: room.y, rotation }, c);
  const d = sub(before, after);
  return { x: room.x + d.x, y: room.y + d.y, rotation };
}
