import { type Vec2, add, angleDeg, distance, dot, length, mul, rotate, sub } from "./vec";

export function snapValue(v: number, step: number) {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

export function snapToGrid(p: Vec2, grid: number): Vec2 {
  return { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
}

/**
 * Vincola il segmento `from → p` alla direzione multipla di `stepDeg` più vicina,
 * se lo scarto angolare è entro `tolDeg`. Restituisce il punto proiettato.
 */
export function snapAngle(from: Vec2, p: Vec2, stepDeg = 90, tolDeg = 10): { point: Vec2; snapped: boolean; angle: number } {
  const d = sub(p, from);
  const len = length(d);
  if (len < 1e-6) return { point: p, snapped: false, angle: 0 };
  const ang = angleDeg(d);
  const target = Math.round(ang / stepDeg) * stepDeg;
  if (Math.abs(ang - target) > tolDeg) return { point: p, snapped: false, angle: ang };
  const dir = rotate({ x: 1, y: 0 }, target);
  // Proiezione sulla direzione vincolata (mantiene la lunghezza lungo l'asse).
  const proj = dot(d, dir);
  return { point: add(from, mul(dir, proj)), snapped: true, angle: target % 360 };
}

/** Aggancia al punto più vicino entro la tolleranza. */
export function snapToPoints(p: Vec2, candidates: Vec2[], tol: number): { point: Vec2; index: number } | null {
  let best = -1;
  let bestD = tol;
  candidates.forEach((c, i) => {
    const d = distance(p, c);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best >= 0 ? { point: { ...candidates[best] }, index: best } : null;
}

export interface AlignGuide {
  axis: "x" | "y";
  value: number;
  from: Vec2;
}

/**
 * Allinea separatamente x e y del punto ai valori x/y dei candidati entro la tolleranza
 * (guide di allineamento come nei CAD).
 */
export function alignToAxes(p: Vec2, candidates: Vec2[], tol: number): { point: Vec2; guides: AlignGuide[] } {
  let bestX: Vec2 | null = null;
  let bestY: Vec2 | null = null;
  let dx = tol;
  let dy = tol;
  for (const c of candidates) {
    const ex = Math.abs(c.x - p.x);
    const ey = Math.abs(c.y - p.y);
    if (ex <= dx) {
      dx = ex;
      bestX = c;
    }
    if (ey <= dy) {
      dy = ey;
      bestY = c;
    }
  }
  const point = { x: bestX ? bestX.x : p.x, y: bestY ? bestY.y : p.y };
  const guides: AlignGuide[] = [];
  if (bestX) guides.push({ axis: "x", value: bestX.x, from: bestX });
  if (bestY) guides.push({ axis: "y", value: bestY.y, from: bestY });
  return { point, guides };
}

export interface DrawSnapOptions {
  grid: number;
  /** Tolleranza in cm per aggancio a punti e allineamenti. */
  tolerance: number;
  angleStep?: number;
  angleTolerance?: number;
  /** Disattiva tutti gli snap (es. tasto Alt premuto). */
  free?: boolean;
}

export interface DrawSnapResult {
  point: Vec2;
  guides: AlignGuide[];
  /** Il punto coincide con il primo vertice: il poligono può essere chiuso. */
  closes: boolean;
  snappedTo: "free" | "grid" | "angle" | "point" | "close";
}

/**
 * Snap usato durante il disegno dei muri: chiusura sul primo vertice, aggancio ai
 * vertici esistenti, angoli a 90° rispetto al vertice precedente, allineamenti e griglia.
 */
export function snapDrawPoint(
  raw: Vec2,
  drawn: Vec2[],
  others: Vec2[],
  opts: DrawSnapOptions,
): DrawSnapResult {
  if (opts.free) return { point: raw, guides: [], closes: false, snappedTo: "free" };
  const first = drawn[0];
  if (first && drawn.length >= 3 && distance(raw, first) <= opts.tolerance) {
    return { point: { ...first }, guides: [], closes: true, snappedTo: "close" };
  }
  const hit = snapToPoints(raw, others, opts.tolerance);
  if (hit) return { point: hit.point, guides: [], closes: false, snappedTo: "point" };

  let p = snapToGrid(raw, opts.grid);
  let snappedTo: DrawSnapResult["snappedTo"] = "grid";
  const prev = drawn[drawn.length - 1];
  if (prev) {
    const a = snapAngle(prev, raw, opts.angleStep ?? 90, opts.angleTolerance ?? 10);
    if (a.snapped) {
      // Sull'asse vincolato, la lunghezza è arrotondata alla griglia.
      const d = sub(a.point, prev);
      const len = length(d);
      const snappedLen = Math.round(len / opts.grid) * opts.grid;
      const dir = len > 0 ? mul(d, 1 / len) : d;
      p = add(prev, mul(dir, snappedLen));
      snappedTo = "angle";
    }
  }
  // Allineamento con gli altri vertici disegnati (utile per chiudere forme ortogonali).
  const alignCandidates = [...drawn.slice(0, -1), ...others];
  const al = alignToAxes(p, alignCandidates, opts.tolerance);
  if (prev && snappedTo === "angle") {
    // Mantiene il vincolo angolare: allinea solo lungo l'asse libero.
    const horizontal = Math.abs(p.y - prev.y) < 1e-6;
    const vertical = Math.abs(p.x - prev.x) < 1e-6;
    const guides = al.guides.filter((g) => (horizontal ? g.axis === "x" : vertical ? g.axis === "y" : false));
    const point = {
      x: horizontal ? al.point.x : p.x,
      y: vertical ? al.point.y : p.y,
    };
    return { point, guides, closes: false, snappedTo };
  }
  return { point: al.point, guides: al.guides, closes: false, snappedTo };
}
