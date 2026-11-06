/** Operazioni pure sui piani della casa. */
import type { Floor, House } from "./schema";

/** Ricalcola le quote dei piani: ognuno poggia sul solaio di quello sottostante. */
export function recomputeElevations(house: House): House {
  const sorted = [...house.floors].sort((a, b) => a.level - b.level);
  const groundIdx = Math.max(0, sorted.findIndex((f) => f.level >= 0));
  const height = (f: Floor) =>
    Math.max(house.settings.defaultCeilingHeight, ...f.rooms.map((r) => r.ceilingHeight)) + f.slabThickness;
  const elev = new Map<string, number>();
  let z = 0;
  for (let i = groundIdx; i < sorted.length; i++) {
    elev.set(sorted[i].id, z);
    z += height(sorted[i]);
  }
  z = 0;
  for (let i = groundIdx - 1; i >= 0; i--) {
    z -= height(sorted[i]);
    elev.set(sorted[i].id, z);
  }
  return { ...house, floors: house.floors.map((f) => ({ ...f, elevation: elev.get(f.id) ?? f.elevation })) };
}

/** Piano immediatamente sotto (o sopra) quello indicato, se esiste. */
export function adjacentFloor(house: House, floorId: string, dir: -1 | 1): Floor | null {
  const f = house.floors.find((x) => x.id === floorId);
  if (!f) return null;
  const candidates = house.floors.filter((x) => (dir === 1 ? x.level > f.level : x.level < f.level));
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (Math.abs(b.level - f.level) < Math.abs(a.level - f.level) ? b : a));
}
