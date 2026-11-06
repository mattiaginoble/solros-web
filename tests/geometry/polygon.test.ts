import { describe, expect, it } from "vitest";
import {
  area,
  areaM2,
  centroid,
  cleanPolygon,
  edges,
  ensurePositive,
  isSelfIntersecting,
  lShapePolygon,
  offsetPolygon,
  perimeter,
  pointInPolygon,
  projectOnSegment,
  rectPolygon,
  signedArea,
} from "@/lib/geometry/polygon";
import { rotate } from "@/lib/geometry/vec";

describe("poligoni", () => {
  it("calcola area e perimetro di un rettangolo", () => {
    const r = rectPolygon(400, 300);
    expect(area(r)).toBe(120000);
    expect(areaM2(r)).toBeCloseTo(12);
    expect(perimeter(r)).toBe(1400);
  });

  it("usa area con segno positiva per il verso orario a schermo", () => {
    const r = rectPolygon(100, 100);
    expect(signedArea(r)).toBeGreaterThan(0);
    expect(signedArea([...r].reverse())).toBeLessThan(0);
    expect(signedArea(ensurePositive([...r].reverse()))).toBeGreaterThan(0);
  });

  it("calcola l'area di una forma a L", () => {
    const l = lShapePolygon(600, 500, 220, 200);
    expect(area(l)).toBe(600 * 500 - 220 * 200);
    expect(isSelfIntersecting(l)).toBe(false);
  });

  it("normali esterne puntano fuori dal poligono", () => {
    const r = rectPolygon(100, 100);
    const es = edges(r);
    expect(es[0].normal).toEqual({ x: 0, y: -1 }); // lato superiore
    expect(es[1].normal).toEqual({ x: 1, y: -0 }); // lato destro
    for (const e of es) {
      const mid = { x: (e.a.x + e.b.x) / 2 + e.normal.x * 5, y: (e.a.y + e.b.y) / 2 + e.normal.y * 5 };
      expect(pointInPolygon(mid, r)).toBe(false);
    }
  });

  it("baricentro del rettangolo al centro", () => {
    expect(centroid(rectPolygon(200, 100, 10, 10))).toEqual({ x: 110, y: 60 });
  });

  it("riconosce punti interni ed esterni, anche nella L", () => {
    const l = lShapePolygon(600, 500, 220, 200);
    expect(pointInPolygon({ x: 100, y: 100 }, l)).toBe(true);
    expect(pointInPolygon({ x: 500, y: 450 }, l)).toBe(false); // nella parte tagliata
  });

  it("proietta un punto su un segmento", () => {
    const p = projectOnSegment({ x: 50, y: 20 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(p.t).toBeCloseTo(0.5);
    expect(p.dist).toBeCloseTo(20);
  });

  it("offset esterno con giunti a spigolo", () => {
    const off = offsetPolygon(rectPolygon(100, 100), 10);
    expect(off[0].x).toBeCloseTo(-10);
    expect(off[0].y).toBeCloseTo(-10);
    expect(off[2].x).toBeCloseTo(110);
    expect(off[2].y).toBeCloseTo(110);
  });

  it("offset con spessori diversi per lato", () => {
    const off = offsetPolygon(rectPolygon(100, 100), [10, 30, 10, 10]);
    // Il vertice in alto a destra unisce lato superiore (10) e destro (30).
    expect(off[1].x).toBeCloseTo(130);
    expect(off[1].y).toBeCloseTo(-10);
  });

  it("rimuove vertici duplicati e collineari", () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(cleanPolygon(poly)).toHaveLength(4);
  });

  it("individua poligoni autointersecanti", () => {
    const bow = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isSelfIntersecting(bow)).toBe(true);
  });

  it("ruota i vettori senza errori di arrotondamento a 90°", () => {
    expect(rotate({ x: 10, y: 0 }, 90)).toEqual({ x: 0, y: 10 });
    expect(rotate({ x: 10, y: 0 }, 180)).toEqual({ x: -10, y: 0 });
  });
});
