import { describe, expect, it } from "vitest";
import { alignToAxes, snapAngle, snapDrawPoint, snapToGrid, snapToPoints } from "@/lib/geometry/snap";

describe("snap", () => {
  it("aggancia alla griglia", () => {
    expect(snapToGrid({ x: 12.4, y: 27.6 }, 10)).toEqual({ x: 10, y: 30 });
  });

  it("vincola a 90° entro la tolleranza", () => {
    const r = snapAngle({ x: 0, y: 0 }, { x: 100, y: 8 }, 90, 10);
    expect(r.snapped).toBe(true);
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.x).toBeCloseTo(100);
  });

  it("non vincola oltre la tolleranza", () => {
    const r = snapAngle({ x: 0, y: 0 }, { x: 100, y: 60 }, 90, 10);
    expect(r.snapped).toBe(false);
  });

  it("aggancia al punto più vicino", () => {
    const hit = snapToPoints({ x: 102, y: 1 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }], 5);
    expect(hit?.index).toBe(1);
    expect(snapToPoints({ x: 50, y: 50 }, [{ x: 0, y: 0 }], 5)).toBeNull();
  });

  it("allinea agli assi dei vertici esistenti", () => {
    const r = alignToAxes({ x: 98, y: 203 }, [{ x: 100, y: 0 }, { x: 0, y: 200 }], 5);
    expect(r.point).toEqual({ x: 100, y: 200 });
    expect(r.guides).toHaveLength(2);
  });

  it("chiude il poligono vicino al primo vertice", () => {
    const drawn = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
    ];
    const r = snapDrawPoint({ x: 3, y: 4 }, drawn, [], { grid: 10, tolerance: 10 });
    expect(r.closes).toBe(true);
    expect(r.point).toEqual({ x: 0, y: 0 });
  });

  it("disegnando un muro ortogonale arrotonda la lunghezza alla griglia", () => {
    const r = snapDrawPoint({ x: 247, y: 6 }, [{ x: 0, y: 0 }], [], { grid: 10, tolerance: 8 });
    expect(r.snappedTo).toBe("angle");
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.x).toBeCloseTo(250);
  });

  it("allinea al primo vertice per chiudere forme ortogonali", () => {
    const drawn = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
    ];
    // Muovendosi in orizzontale verso sinistra, la x si allinea a quella del primo vertice.
    const r = snapDrawPoint({ x: 4, y: 203 }, drawn, [], { grid: 10, tolerance: 8 });
    expect(r.point).toEqual({ x: 0, y: 200 });
  });

  it("modalità libera senza snap", () => {
    const r = snapDrawPoint({ x: 3.3, y: 4.4 }, [{ x: 0, y: 0 }], [], { grid: 10, tolerance: 10, free: true });
    expect(r.point).toEqual({ x: 3.3, y: 4.4 });
  });
});

describe("snap alle facce dei muri importati", () => {
  it("aggancia il punto alle linee rilevate", () => {
    const r = snapDrawPoint({ x: 103, y: 47 }, [], [], {
      grid: 10,
      tolerance: 8,
      lines: [
        { axis: "v", value: 101.5, from: 0, to: 300 },
        { axis: "h", value: 52.5, from: 0, to: 300 },
      ],
    });
    expect(r.point).toEqual({ x: 101.5, y: 52.5 });
  });

  it("ignora linee fuori dal loro tratto", () => {
    const r = snapDrawPoint({ x: 500, y: 47 }, [], [], {
      grid: 10,
      tolerance: 8,
      lines: [{ axis: "h", value: 52.5, from: 0, to: 300 }],
    });
    expect(r.point).toEqual({ x: 500, y: 50 });
  });
});
