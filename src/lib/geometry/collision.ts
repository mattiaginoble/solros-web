/**
 * Rettangoli orientati (OBB) e test di collisione (teorema dell'asse separatore).
 * Convenzione per gli oggetti: larghezza lungo l'asse x locale, profondità
 * lungo y; il retro è verso -y, il fronte verso +y.
 */
import { pointInPolygon, segmentsIntersect } from "./polygon";
import { type Vec2, add, dot, mul, rotate, sub } from "./vec";

export interface OBB {
  center: Vec2;
  width: number;
  depth: number;
  rotation: number;
}

export function obbAxes(o: OBB): { ux: Vec2; uy: Vec2 } {
  return { ux: rotate({ x: 1, y: 0 }, o.rotation), uy: rotate({ x: 0, y: 1 }, o.rotation) };
}

/** Vertici in senso orario a schermo: retro-sinistra, retro-destra, fronte-destra, fronte-sinistra. */
export function obbCorners(o: OBB): Vec2[] {
  const { ux, uy } = obbAxes(o);
  const hx = mul(ux, o.width / 2);
  const hy = mul(uy, o.depth / 2);
  return [
    sub(sub(o.center, hx), hy),
    sub(add(o.center, hx), hy),
    add(add(o.center, hx), hy),
    add(sub(o.center, hx), hy),
  ];
}

function projectRange(points: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const v = dot(p, axis);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Sovrapposizione di due poligoni convessi (SAT). `eps` tollera contatti di bordo. */
export function convexOverlap(a: Vec2[], b: Vec2[], eps = 0.1): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const axis = { x: -(q.y - p.y), y: q.x - p.x };
      const len = Math.hypot(axis.x, axis.y);
      if (len < 1e-9) continue;
      const n = { x: axis.x / len, y: axis.y / len };
      const [a0, a1] = projectRange(a, n);
      const [b0, b1] = projectRange(b, n);
      if (a1 <= b0 + eps || b1 <= a0 + eps) return false;
    }
  }
  return true;
}

export function obbOverlap(a: OBB, b: OBB, eps = 0.1): boolean {
  return convexOverlap(obbCorners(a), obbCorners(b), eps);
}

/**
 * Vero se il rettangolo sta interamente dentro il poligono (anche concavo):
 * tutti i vertici interni e nessun lato del poligono che lo attraversa.
 */
export function obbInsidePolygon(o: OBB, poly: Vec2[], tolerance = 0.5): boolean {
  // Si restringe leggermente il rettangolo per tollerare oggetti appoggiati ai muri.
  const shrunk = { ...o, width: Math.max(0.1, o.width - tolerance * 2), depth: Math.max(0.1, o.depth - tolerance * 2) };
  const corners = obbCorners(shrunk);
  if (!corners.every((c) => pointInPolygon(c, poly))) return false;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let j = 0; j < poly.length; j++) {
      if (segmentsIntersect(a, b, poly[j], poly[(j + 1) % poly.length])) return false;
    }
  }
  return true;
}

/** Intervalli verticali [base, sommità] che si sovrappongono. */
export function verticalOverlap(a: [number, number], b: [number, number], eps = 0.5) {
  return a[0] < b[1] - eps && b[0] < a[1] - eps;
}
