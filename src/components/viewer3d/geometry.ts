/**
 * Geometrie per la vista 3D. Unità: metri. Assi: x = x di pianta, z = y di
 * pianta, y verso l'alto. Le coordinate di pianta arrivano in cm.
 */
import * as THREE from "three";
import type { Vec2 } from "@/domain/schema";

export const CM = 0.01;

type V3 = [number, number, number];
type V2 = [number, number];

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  groups: { start: number; count: number; mat: number }[] = [];

  /** Aggiunge un triangolo orientandolo in modo che la normale coincida con `n`. */
  tri(mat: number, a: V3, b: V3, c: V3, n: V3, ua: V2, ub: V2, uc: V2) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const verts = flip ? [a, c, b] : [a, b, c];
    const uv = flip ? [ua, uc, ub] : [ua, ub, uc];
    const start = this.positions.length / 3;
    for (let i = 0; i < 3; i++) {
      this.positions.push(...verts[i]);
      this.normals.push(...n);
      this.uvs.push(...uv[i]);
    }
    const last = this.groups[this.groups.length - 1];
    if (last && last.mat === mat && last.start + last.count === start) last.count += 3;
    else this.groups.push({ start, count: 3, mat });
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.mat);
    return g;
  }
}

function polygonCentroid(pts: Vec2[]) {
  return pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
}

/**
 * Prisma verticale con base poligonale (punti in pianta, cm) tra y0 e y1 (cm).
 * Gruppi di materiale: 0 = faccia del lato `innerEdge`, 1 = lato `outerEdge`,
 * 2 = altre facce laterali e basi (sezione del muro).
 */
export function prismGeometry(points: Vec2[], y0: number, y1: number, innerEdge = -1, outerEdge = -1): THREE.BufferGeometry {
  const b = new Builder();
  const n = points.length;
  const Y0 = y0 * CM;
  const Y1 = y1 * CM;
  const c = polygonCentroid(points);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.y - p.y) * CM;
    if (len < 1e-6) continue;
    // Normale orizzontale rivolta verso l'esterno del prisma (convesso o quasi).
    let nx = (q.y - p.y) * CM;
    let nz = -(q.x - p.x) * CM;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    if (nx * (mid.x - c.x) + nz * (mid.y - c.y) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const l = Math.hypot(nx, nz);
    const nn: V3 = [nx / l, 0, nz / l];
    const mat = i === innerEdge ? 0 : i === outerEdge ? 1 : 2;
    const a0: V3 = [p.x * CM, Y0, p.y * CM];
    const b0: V3 = [q.x * CM, Y0, q.y * CM];
    const b1: V3 = [q.x * CM, Y1, q.y * CM];
    const a1: V3 = [p.x * CM, Y1, p.y * CM];
    b.tri(mat, a0, b0, b1, nn, [0, Y0], [len, Y0], [len, Y1]);
    b.tri(mat, a0, b1, a1, nn, [0, Y0], [len, Y1], [0, Y1]);
  }
  const contour = points.map((p) => new THREE.Vector2(p.x * CM, p.y * CM));
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    const A = contour[i];
    const B = contour[j];
    const C = contour[k];
    b.tri(2, [A.x, Y1, A.y], [B.x, Y1, B.y], [C.x, Y1, C.y], [0, 1, 0], [A.x, A.y], [B.x, B.y], [C.x, C.y]);
    b.tri(2, [A.x, Y0, A.y], [B.x, Y0, B.y], [C.x, Y0, C.y], [0, -1, 0], [A.x, A.y], [B.x, B.y], [C.x, C.y]);
  }
  return b.build();
}

/** Superficie orizzontale (pavimento o soffitto) da un poligono in pianta (cm), alla quota y (cm). */
export function polygonSurface(points: Vec2[], y: number, facingUp = true): THREE.BufferGeometry {
  const b = new Builder();
  const contour = points.map((p) => new THREE.Vector2(p.x * CM, p.y * CM));
  const Y = y * CM;
  const n: V3 = [0, facingUp ? 1 : -1, 0];
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    const A = contour[i];
    const B = contour[j];
    const C = contour[k];
    b.tri(0, [A.x, Y, A.y], [B.x, Y, B.y], [C.x, Y, C.y], n, [A.x, A.y], [B.x, B.y], [C.x, C.y]);
  }
  return b.build();
}
