import type { Vec2 } from "@/domain/schema";

export type { Vec2 };

export const EPS = 1e-6;

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** Componente z del prodotto vettoriale. */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const midpoint = (a: Vec2, b: Vec2): Vec2 => lerp(a, b, 0.5);

export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/**
 * Normale "esterna" di una direzione per poligoni con area con segno positiva
 * nel sistema y-verso-il-basso (senso orario sullo schermo).
 */
export const outwardNormal = (dir: Vec2): Vec2 => ({ x: dir.y, y: -dir.x });

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Ruota un vettore di `deg` gradi (senso orario sullo schermo). */
export function rotate(a: Vec2, deg: number): Vec2 {
  if (deg === 0) return { x: a.x, y: a.y };
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  // Correzione per angoli multipli di 90° per evitare errori di arrotondamento.
  const cc = Math.abs(c) < 1e-12 ? 0 : c;
  const ss = Math.abs(s) < 1e-12 ? 0 : s;
  return { x: a.x * cc - a.y * ss, y: a.x * ss + a.y * cc };
}

export function rotateAround(p: Vec2, center: Vec2, deg: number): Vec2 {
  return add(center, rotate(sub(p, center), deg));
}

export function nearlyEqual(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

export function vecNearlyEqual(a: Vec2, b: Vec2, eps = 1e-6) {
  return nearlyEqual(a.x, b.x, eps) && nearlyEqual(a.y, b.y, eps);
}

/** Arrotonda a `decimals` decimali (default 1 decimo di cm). */
export function round(n: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function roundVec(a: Vec2, decimals = 1): Vec2 {
  return { x: round(a.x, decimals), y: round(a.y, decimals) };
}

/** Angolo della direzione in gradi in [0, 360). */
export function angleDeg(a: Vec2): number {
  const d = toDeg(Math.atan2(a.y, a.x));
  return (d + 360) % 360;
}

/** Normalizza un angolo in gradi nell'intervallo [0, 360). */
export function normalizeAngle(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
