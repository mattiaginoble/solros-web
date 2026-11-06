/**
 * Elaborazione raster delle planimetrie, in TypeScript puro (nessuna dipendenza
 * dal DOM, quindi testabile). Le maschere sono Uint8Array 0/1 di larghezza `w`.
 */

export interface Mask {
  data: Uint8Array;
  w: number;
  h: number;
}

export interface Gray {
  data: Uint8Array;
  w: number;
  h: number;
}

export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Gray {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    // Pixel trasparenti considerati bianchi (sfondo).
    const lum = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    out[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { data: out, w, h };
}

/** Soglia di Otsu sull'istogramma dei grigi. */
export function otsuThreshold(g: Gray): number {
  const hist = new Array(256).fill(0);
  for (const v of g.data) hist[v]++;
  const total = g.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** 1 dove il pixel è scuro (inchiostro). */
export function binarize(g: Gray, threshold = otsuThreshold(g)): Mask {
  const data = new Uint8Array(g.w * g.h);
  for (let i = 0; i < data.length; i++) data[i] = g.data[i] <= threshold ? 1 : 0;
  return { data, w: g.w, h: g.h };
}

/**
 * Erosione o dilatazione con elemento quadrato (2r+1), separabile e lineare nel
 * numero di pixel grazie alle somme prefisse.
 */
function morph(m: Mask, r: number, erodeOp: boolean): Mask {
  if (r <= 0) return { data: m.data.slice(), w: m.w, h: m.h };
  const { w, h } = m;
  const full = 2 * r + 1;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const pre = new Int32Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + m.data[row + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w, x + r + 1);
      // Nell'erosione i pixel fuori immagine contano come pieni, per non creare artefatti sul bordo.
      const ones = pre[hi] - pre[lo] + (erodeOp ? full - (hi - lo) : 0);
      tmp[row + x] = erodeOp ? (ones === full ? 1 : 0) : ones > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) pre[y + 1] = pre[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h, y + r + 1);
      const ones = pre[hi] - pre[lo] + (erodeOp ? full - (hi - lo) : 0);
      out[y * w + x] = erodeOp ? (ones === full ? 1 : 0) : ones > 0 ? 1 : 0;
    }
  }
  return { data: out, w, h };
}

export const erode = (m: Mask, r: number) => morph(m, r, true);
export const dilate = (m: Mask, r: number) => morph(m, r, false);
/** Apertura: elimina tratti più sottili di 2r+1 pixel (testi, arredi, quote). */
export const open = (m: Mask, r: number) => dilate(erode(m, r), r);
/** Chiusura: riempie interruzioni larghe fino a 2r+1 pixel (porte). */
export const close = (m: Mask, r: number) => erode(dilate(m, r), r);

/** Istogramma pesato delle lunghezze dei tratti scuri orizzontali e verticali. */
function runHistogram(m: Mask, minRun: number, maxRun: number) {
  const hist = new Map<number, number>();
  const add = (len: number) => {
    if (len >= minRun && len <= maxRun) hist.set(len, (hist.get(len) ?? 0) + len);
  };
  for (let y = 0; y < m.h; y += 2) {
    let run = 0;
    for (let x = 0; x < m.w; x++) {
      if (m.data[y * m.w + x]) run++;
      else {
        add(run);
        run = 0;
      }
    }
    add(run);
  }
  for (let x = 0; x < m.w; x += 2) {
    let run = 0;
    for (let y = 0; y < m.h; y++) {
      if (m.data[y * m.w + x]) run++;
      else {
        add(run);
        run = 0;
      }
    }
    add(run);
  }
  const smooth = (len: number) => (hist.get(len - 1) ?? 0) + (hist.get(len) ?? 0) + (hist.get(len + 1) ?? 0);
  return { hist, smooth };
}

/**
 * Stima dello spessore dei muri in pixel: lunghezza più frequente dei tratti
 * scuri orizzontali e verticali, ignorando le linee sottili.
 */
export function estimateWallThickness(m: Mask, minRun = 3, maxRun = 80): number {
  return estimateWallThicknesses(m, minRun, maxRun).typical;
}

/**
 * Spessore tipico (il più frequente) e minimo significativo: nelle piante i
 * muri esterni sono spesso molto più spessi di quelli interni.
 */
export function estimateWallThicknesses(m: Mask, minRun = 3, maxRun = 80): { typical: number; thinnest: number } {
  const { hist, smooth } = runHistogram(m, minRun, maxRun);
  let best = 0;
  let typical = 6;
  for (const [len] of hist) {
    const score = smooth(len);
    if (score > best) {
      best = score;
      typical = len;
    }
  }
  let thinnest = typical;
  // Tramezzi: picco locale più corto, non sotto un quarto dello spessore tipico (i testi sono più sottili).
  const minThin = Math.max(minRun, Math.round(typical * 0.25));
  for (const [len] of hist) {
    const score = smooth(len);
    if (len < thinnest && len >= minThin && score >= best * 0.05 && score >= smooth(len - 1) && score >= smooth(len + 1)) thinnest = len;
  }
  return { typical, thinnest };
}

/** Etichetta le componenti connesse (4-connessione) dei pixel liberi (valore 0). */
export function labelFree(m: Mask): { labels: Int32Array; count: number; sizes: number[] } {
  const { w, h } = m;
  const labels = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (m.data[i] || labels[i] >= 0) continue;
    labels[i] = count;
    stack.push(i);
    let size = 0;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q >= 0 && !m.data[q] && labels[q] < 0) {
          labels[q] = count;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
    count++;
  }
  return { labels, count, sizes };
}

/** Etichette delle componenti che toccano il bordo dell'immagine (esterno). */
export function borderLabels(labels: Int32Array, w: number, h: number): Set<number> {
  const s = new Set<number>();
  for (let x = 0; x < w; x++) {
    if (labels[x] >= 0) s.add(labels[x]);
    if (labels[(h - 1) * w + x] >= 0) s.add(labels[(h - 1) * w + x]);
  }
  for (let y = 0; y < h; y++) {
    if (labels[y * w] >= 0) s.add(labels[y * w]);
    if (labels[y * w + w - 1] >= 0) s.add(labels[y * w + w - 1]);
  }
  return s;
}

export interface P {
  x: number;
  y: number;
}

/**
 * Contorno esterno di una componente seguendo i lati dei pixel ("crack
 * following"): restituisce un poligono ortogonale nelle coordinate degli
 * angoli dei pixel, con verso orario a schermo.
 */
export function traceComponent(labels: Int32Array, w: number, h: number, label: number): P[] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === label;
  // Lati orientati con l'interno a destra (verso orario a schermo).
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (w + 1) + x;
  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const k = key(x0, y0);
    const list = next.get(k);
    const v = key(x1, y1);
    if (list) list.push(v);
    else next.set(k, [v]);
  };
  let start = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) {
        addEdge(x, y, x + 1, y);
        if (start < 0) start = key(x, y);
      }
      if (!inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  if (start < 0) return [];
  const pts: P[] = [];
  let cur = start;
  let prevDir: P | null = null;
  const toP = (k: number) => ({ x: k % (w + 1), y: Math.floor(k / (w + 1)) });
  for (let guard = 0; guard < 4 * w * h + 10; guard++) {
    const p = toP(cur);
    pts.push(p);
    const outs = next.get(cur);
    if (!outs || outs.length === 0) break;
    // In caso di ambiguità (pixel che si toccano in diagonale) si preferisce girare a destra.
    let choice = 0;
    if (outs.length > 1 && prevDir) {
      let bestScore = -Infinity;
      outs.forEach((o, i) => {
        const q = toP(o);
        const d = { x: q.x - p.x, y: q.y - p.y };
        const crossZ = prevDir!.x * d.y - prevDir!.y * d.x;
        if (crossZ > bestScore) {
          bestScore = crossZ;
          choice = i;
        }
      });
    }
    const nxt = outs.splice(choice, 1)[0];
    const q = toP(nxt);
    prevDir = { x: q.x - p.x, y: q.y - p.y };
    cur = nxt;
    if (cur === start) break;
  }
  return removeCollinear(pts);
}

export function removeCollinear(pts: P[]): P[] {
  if (pts.length < 4) return pts;
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  return out;
}

/** Semplificazione di Douglas-Peucker su un poligono chiuso. */
export function simplifyPolygon(pts: P[], epsilon: number): P[] {
  if (pts.length <= 4) return pts;
  // Si spezza il poligono nei due punti più lontani e si semplificano le due catene.
  let i0 = 0;
  let i1 = 0;
  let maxD = -1;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d > maxD) {
        maxD = d;
        i0 = i;
        i1 = j;
      }
    }
  const chainA = pts.slice(i0, i1 + 1);
  const chainB = [...pts.slice(i1), ...pts.slice(0, i0 + 1)];
  const a = rdp(chainA, epsilon);
  const b = rdp(chainB, epsilon);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function rdp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let idx = -1;
  let maxD = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return [...left.slice(0, -1), ...right];
}

/** Porta a orizzontali/verticali i lati quasi ortogonali (entro `tolDeg`). */
export function orthogonalize(pts: P[], tolDeg = 12): P[] {
  const out = pts.map((p) => ({ ...p }));
  const n = out.length;
  const tol = Math.tan((tolDeg * Math.PI) / 180);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dy <= dx * tol) {
        const y = (a.y + b.y) / 2;
        a.y = y;
        b.y = y;
      } else if (dx <= dy * tol) {
        const x = (a.x + b.x) / 2;
        a.x = x;
        b.x = x;
      }
    }
  }
  return removeCollinear(out.filter((p, i) => Math.hypot(p.x - out[(i + 1) % n].x, p.y - out[(i + 1) % n].y) > 0.5));
}

export interface EdgeLine {
  axis: "h" | "v";
  /** y per le linee orizzontali, x per quelle verticali (pixel). */
  value: number;
  from: number;
  to: number;
}

/** Facce dei muri (bordi tra muro e spazio libero) lunghe almeno `minLen` pixel. */
export function detectEdgeLines(m: Mask, minLen: number): EdgeLine[] {
  const lines: EdgeLine[] = [];
  const { w, h, data } = m;
  for (let y = 1; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      const edge = x < w && data[y * w + x] !== data[(y - 1) * w + x];
      if (edge) run++;
      else {
        if (run >= minLen) lines.push({ axis: "h", value: y, from: x - run, to: x });
        run = 0;
      }
    }
  }
  for (let x = 1; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      const edge = y < h && data[y * w + x] !== data[y * w + x - 1];
      if (edge) run++;
      else {
        if (run >= minLen) lines.push({ axis: "v", value: x, from: y - run, to: y });
        run = 0;
      }
    }
  }
  return lines;
}
