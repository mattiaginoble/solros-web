import {
  type Vec2,
  EPS,
  add,
  cross,
  distance,
  dot,
  length,
  mul,
  normalize,
  outwardNormal,
  sub,
} from "./vec";

/** Area con segno (formula di Gauss). Positiva = senso orario sullo schermo (y verso il basso). */
export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function area(poly: Vec2[]): number {
  return Math.abs(signedArea(poly));
}

/** Area in metri quadrati, a partire da un poligono in cm. */
export function areaM2(poly: Vec2[]): number {
  return area(poly) / 10000;
}

export function perimeter(poly: Vec2[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) p += distance(poly[i], poly[(i + 1) % poly.length]);
  return p;
}

export function centroid(poly: Vec2[]): Vec2 {
  const a = signedArea(poly);
  if (Math.abs(a) < EPS) {
    const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return mul(s, 1 / poly.length);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(points: Vec2[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function bboxUnion(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function bboxesOverlap(a: BBox, b: BBox, margin = 0) {
  return !(
    a.maxX + margin < b.minX ||
    b.maxX + margin < a.minX ||
    a.maxY + margin < b.minY ||
    b.maxY + margin < a.minY
  );
}

/** Restituisce il poligono orientato con area positiva (senso orario a schermo). */
export function ensurePositive(poly: Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/** Ray casting: punto interno al poligono (bordo escluso in modo non deterministico). */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersect =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface SegmentProjection {
  /** Punto più vicino sul segmento. */
  point: Vec2;
  /** Parametro normalizzato in [0, 1]. */
  t: number;
  /** Distanza dal punto al segmento. */
  dist: number;
}

export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): SegmentProjection {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < EPS ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const point = add(a, mul(ab, t));
  return { point, t, dist: distance(p, point) };
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2) {
  return projectOnSegment(p, a, b).dist;
}

/** Intersezione tra rette (punto + direzione). Restituisce null se parallele. */
export function lineIntersection(p: Vec2, d1: Vec2, q: Vec2, d2: Vec2): Vec2 | null {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(q, p), d2) / den;
  return add(p, mul(d1, t));
}

/** Intersezione propria tra segmenti [a,b] e [c,d]. */
export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(d, c), sub(a, c));
  const d2 = cross(sub(d, c), sub(b, c));
  const d3 = cross(sub(b, a), sub(c, a));
  const d4 = cross(sub(b, a), sub(d, a));
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}

/** Vero se lati non adiacenti del poligono si intersecano. */
export function isSelfIntersecting(poly: Vec2[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const c = poly[j];
      const d = poly[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Rimuove vertici duplicati consecutivi e (opzionalmente) vertici collineari. */
export function cleanPolygon(poly: Vec2[], removeCollinear = true, eps = 0.01): Vec2[] {
  let pts = poly.filter((p, i) => distance(p, poly[(i + 1) % poly.length]) > eps);
  if (!removeCollinear || pts.length <= 3) return pts;
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const c = cross(sub(cur, prev), sub(next, cur));
      if (Math.abs(c) < eps * Math.max(1, distance(prev, next))) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

export interface Edge {
  index: number;
  a: Vec2;
  b: Vec2;
  dir: Vec2;
  normal: Vec2;
  length: number;
}

/** Lati del poligono con direzione unitaria e normale esterna. */
export function edges(poly: Vec2[]): Edge[] {
  return poly.map((a, index) => {
    const b = poly[(index + 1) % poly.length];
    const d = sub(b, a);
    const dir = normalize(d);
    return { index, a, b, dir, normal: outwardNormal(dir), length: length(d) };
  });
}

export function edgeLength(poly: Vec2[], i: number) {
  return distance(poly[i], poly[(i + 1) % poly.length]);
}

export function translatePolygon(poly: Vec2[], d: Vec2): Vec2[] {
  return poly.map((p) => add(p, d));
}

/** Rettangolo con angolo in alto a sinistra in (x, y). */
export function rectPolygon(width: number, height: number, x = 0, y = 0): Vec2[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/**
 * Poligono a L: rettangolo `width × height` a cui è tolto l'angolo in basso a destra
 * di dimensioni `cutWidth × cutHeight`.
 */
export function lShapePolygon(
  width: number,
  height: number,
  cutWidth: number,
  cutHeight: number,
): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height - cutHeight },
    { x: width - cutWidth, y: height - cutHeight },
    { x: width - cutWidth, y: height },
    { x: 0, y: height },
  ];
}

/** Offset del poligono verso l'esterno con spessori variabili per lato (giunti a spigolo vivo). */
export function offsetPolygon(poly: Vec2[], thickness: number[] | number): Vec2[] {
  const es = edges(poly);
  const t = (i: number) => (Array.isArray(thickness) ? thickness[i] : thickness);
  return es.map((e, i) => {
    const prev = es[(i - 1 + es.length) % es.length];
    return miterPoint(prev, t(prev.index), e, t(i));
  });
}

/**
 * Punto di giunzione esterno tra il lato `prev` (spessore tPrev) e il lato `next`
 * (spessore tNext) che condividono il vertice `next.a`.
 * Se i lati sono quasi paralleli o l'angolo è troppo acuto si usa un offset perpendicolare.
 */
export function miterPoint(prev: Edge, tPrev: number, next: Edge, tNext: number): Vec2 {
  const p1 = add(prev.a, mul(prev.normal, tPrev));
  const p2 = add(next.a, mul(next.normal, tNext));
  const hit = lineIntersection(p1, prev.dir, p2, next.dir);
  const fallback = p2;
  if (!hit) return fallback;
  const maxT = Math.max(tPrev, tNext);
  if (distance(hit, next.a) > maxT * 4 + 1) return fallback;
  return hit;
}
