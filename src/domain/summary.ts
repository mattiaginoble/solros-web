/** Statistiche e miniatura di una casa, usate negli elenchi dei progetti. */
import { roomWorldPolygon } from "@/lib/geometry/transform";
import type { House } from "./schema";

export interface HouseStats {
  floors: number;
  rooms: number;
  items: number;
  areaM2: number;
}

/** Poligoni del piano principale (coordinate di piano) per la miniatura. */
export type HousePreview = { points: { x: number; y: number }[]; color: string }[];

export function houseStats(house: House): HouseStats {
  let rooms = 0;
  let items = 0;
  let area = 0;
  for (const f of house.floors) {
    rooms += f.rooms.length;
    for (const r of f.rooms) {
      items += r.items.length;
      let a = 0;
      for (let i = 0; i < r.polygon.length; i++) {
        const p = r.polygon[i];
        const q = r.polygon[(i + 1) % r.polygon.length];
        a += p.x * q.y - q.x * p.y;
      }
      area += Math.abs(a) / 2 / 10000;
    }
  }
  return { floors: house.floors.length, rooms, items, areaM2: Math.round(area * 10) / 10 };
}

export function housePreview(house: House): HousePreview {
  const floor = [...house.floors].sort((a, b) => Math.abs(a.level) - Math.abs(b.level))[0];
  return (floor?.rooms ?? []).map((r) => ({
    points: roomWorldPolygon(r).map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })),
    color: r.color,
  }));
}
