import { describe, expect, it } from "vitest";
import { obbCorners, obbInsidePolygon, obbOverlap, verticalOverlap } from "@/lib/geometry/collision";
import { lShapePolygon, rectPolygon } from "@/lib/geometry/polygon";

const box = (x: number, y: number, w: number, d: number, r = 0) => ({ center: { x, y }, width: w, depth: d, rotation: r });

describe("collisioni", () => {
  it("vertici di un rettangolo non ruotato", () => {
    expect(obbCorners(box(50, 50, 100, 40))).toEqual([
      { x: 0, y: 30 },
      { x: 100, y: 30 },
      { x: 100, y: 70 },
      { x: 0, y: 70 },
    ]);
  });

  it("rileva sovrapposizioni e separazioni", () => {
    expect(obbOverlap(box(0, 0, 100, 100), box(80, 0, 100, 100))).toBe(true);
    expect(obbOverlap(box(0, 0, 100, 100), box(150, 0, 100, 100))).toBe(false);
  });

  it("oggetti a contatto non collidono", () => {
    expect(obbOverlap(box(0, 0, 100, 100), box(100, 0, 100, 100))).toBe(false);
  });

  it("gestisce rettangoli ruotati", () => {
    // Quadrato ruotato di 45°: la diagonale arriva a ~70,7 dal centro.
    expect(obbOverlap(box(0, 0, 100, 100, 45), box(115, 0, 40, 40))).toBe(false);
    expect(obbOverlap(box(0, 0, 100, 100, 45), box(80, 0, 40, 40))).toBe(true);
  });

  it("contenimento in una stanza rettangolare", () => {
    const room = rectPolygon(400, 300);
    expect(obbInsidePolygon(box(200, 150, 100, 100), room)).toBe(true);
    expect(obbInsidePolygon(box(380, 150, 100, 100), room)).toBe(false);
    // Appoggiato al muro: ancora dentro.
    expect(obbInsidePolygon(box(350, 150, 100, 100), room)).toBe(true);
  });

  it("contenimento in una stanza a L: la parte tagliata è fuori", () => {
    const l = lShapePolygon(600, 500, 220, 200);
    expect(obbInsidePolygon(box(100, 100, 100, 100), l)).toBe(true);
    expect(obbInsidePolygon(box(450, 350, 80, 80), l)).toBe(false);
    // A cavallo dell'angolo rientrante.
    expect(obbInsidePolygon(box(380, 300, 60, 60), l)).toBe(false);
  });

  it("sovrapposizione verticale per oggetti a parete", () => {
    expect(verticalOverlap([0, 85], [145, 217])).toBe(false);
    expect(verticalOverlap([0, 200], [145, 217])).toBe(true);
  });
});
