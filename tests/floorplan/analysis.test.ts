import { describe, expect, it } from "vitest";
import { analyzeRaster, wallEdgeLines } from "@/floorplan/localAnalysis";
import { close, dilate, erode, estimateWallThickness, open, orthogonalize, simplifyPolygon } from "@/floorplan/raster";

/** Planimetria sintetica: due stanze, muro interno con porta, finestra a linee sottili, un mobile. */
function syntheticPlan() {
  const w = 400;
  const h = 300;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const fill = (x0: number, y0: number, x1: number, y1: number, v = 0) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
  };
  // Muri esterni spessi 12 px.
  fill(20, 20, 380, 32);
  fill(20, 268, 380, 280);
  fill(20, 20, 32, 280);
  fill(368, 20, 380, 280);
  // Muro interno spesso 10 px con porta tra y 120 e 170.
  fill(190, 32, 200, 120);
  fill(190, 170, 200, 268);
  // Finestra nel muro superiore: vano x 80..140 disegnato con linee sottili sulle facce e sul vetro.
  fill(80, 20, 140, 32, 255);
  fill(80, 20, 140, 21);
  fill(80, 26, 140, 27);
  fill(80, 31, 140, 32);
  // Mobile disegnato con tratto sottile.
  fill(60, 150, 120, 151);
  fill(60, 200, 120, 201);
  fill(60, 150, 61, 201);
  fill(119, 150, 120, 201);
  return { data, width: w, height: h };
}

describe("analisi raster delle planimetrie", () => {
  it("morfologia: apertura toglie i tratti sottili, chiusura riempie i varchi", () => {
    const w = 20;
    const h = 5;
    const m = { data: new Uint8Array(w * h), w, h };
    for (let x = 0; x < w; x++) m.data[2 * w + x] = 1; // linea di 1 px
    expect(open(m, 1).data.some((v) => v === 1)).toBe(false);
    const bar = { data: new Uint8Array(w * h), w, h };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 8 || x > 11) bar.data[y * w + x] = 1;
    expect(close(bar, 2).data[2 * w + 9]).toBe(1);
    expect(dilate(erode(bar, 0), 0).data).toEqual(bar.data);
  });

  it("stima lo spessore dei muri", () => {
    const plan = syntheticPlan();
    const gray = new Uint8Array(plan.width * plan.height);
    for (let i = 0; i < gray.length; i++) gray[i] = plan.data[i * 4] < 128 ? 1 : 0;
    const t = estimateWallThickness({ data: gray, w: plan.width, h: plan.height });
    expect(t).toBeGreaterThanOrEqual(9);
    expect(t).toBeLessThanOrEqual(13);
  });

  it("riconosce le due stanze con i loro contorni", () => {
    const res = analyzeRaster(syntheticPlan());
    expect(res.rooms).toHaveLength(2);
    const boxes = res.rooms
      .map((r) => {
        const xs = r.polygon.map((p) => p.x);
        const ys = r.polygon.map((p) => p.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), n: r.polygon.length };
      })
      .sort((a, b) => a.minX - b.minX);
    expect(boxes[0]).toMatchObject({ minX: 32, maxX: 190, minY: 32, maxY: 268, n: 4 });
    expect(boxes[1]).toMatchObject({ minX: 200, maxX: 368, minY: 32, maxY: 268, n: 4 });
  });

  it("riconosce la porta tra le stanze e la finestra verso l'esterno", () => {
    const res = analyzeRaster(syntheticPlan());
    const door = res.openings.find((o) => o.kind === "door");
    const win = res.openings.find((o) => o.kind === "window");
    expect(door).toBeDefined();
    expect(Math.abs(door!.a.y - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(door!.b.y - 170)).toBeLessThanOrEqual(2);
    expect(win).toBeDefined();
    expect(Math.abs(win!.a.x - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(win!.b.x - 140)).toBeLessThanOrEqual(2);
  });

  it("trova le facce dei muri per lo snap del ricalco", () => {
    const { lines } = wallEdgeLines(syntheticPlan());
    expect(lines.some((l) => l.axis === "h" && l.value === 32)).toBe(true);
    expect(lines.some((l) => l.axis === "v" && l.value === 190)).toBe(true);
  });

  it("semplifica e ortogonalizza un contorno rumoroso", () => {
    const noisy = [
      { x: 0, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 0 },
      { x: 101, y: 60 },
      { x: 100, y: 120 },
      { x: 0, y: 121 },
    ];
    const out = orthogonalize(simplifyPolygon(noisy, 2));
    expect(out).toHaveLength(4);
    expect(out.every((p, i) => {
      const q = out[(i + 1) % out.length];
      return p.x === q.x || p.y === q.y;
    })).toBe(true);
  });
});

describe("dalla bozza alle stanze", () => {
  it("converte stanze e aperture nelle coordinate del piano con la scala", async () => {
    const { analysisToRooms } = await import("@/floorplan/apply");
    const { computeFloorWalls, listSharedWalls } = await import("@/lib/geometry/walls");
    const res = analyzeRaster(syntheticPlan());
    // 1 px = 2 cm; sfondo posizionato in (100, 50).
    const out = analysisToRooms(res, { x: 100, y: 50, cmPerPixel: 2, pixelWidth: 400 }, 400, { ceilingHeight: 270 });
    expect(out.rooms).toHaveLength(2);
    const left = out.rooms.find((r) => r.x < 300)!;
    expect(left.x).toBe(100 + 32 * 2);
    expect(left.y).toBe(50 + 32 * 2);
    expect(out.openingsPlaced).toBe(2);
    // Il muro interno di 10 px (20 cm) diventa un muro condiviso.
    expect(listSharedWalls(computeFloorWalls(out.rooms))).toHaveLength(1);
    const door = out.rooms.flatMap((r) => r.openings).find((o) => o.kind === "door")!;
    expect(door.width).toBeGreaterThan(90);
    expect(door.width).toBeLessThan(110);
  });
});

describe("muri di spessori diversi", () => {
  it("conserva i tramezzi sottili accanto ai muri esterni spessi e ne misura lo spessore", async () => {
    const w = 420;
    const h = 300;
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    };
    // Esterni 18 px, tramezzo 6 px con porta.
    fill(20, 20, 400, 38);
    fill(20, 262, 400, 280);
    fill(20, 20, 38, 280);
    fill(382, 20, 400, 280);
    fill(200, 38, 206, 110);
    fill(200, 160, 206, 262);
    const res = analyzeRaster({ data, width: w, height: h });
    expect(res.rooms).toHaveLength(2);
    expect(res.openings.filter((o) => o.kind === "door")).toHaveLength(1);
    const left = res.rooms.find((r) => Math.min(...r.polygon.map((p) => p.x)) < 100)!;
    const t = left.edgeThicknessPx!;
    expect(Math.max(...t)).toBeGreaterThanOrEqual(16);
    expect(Math.min(...t)).toBeLessThanOrEqual(7);
    const { analysisToRooms } = await import("@/floorplan/apply");
    const { computeFloorWalls, listSharedWalls } = await import("@/lib/geometry/walls");
    const out = analysisToRooms(res, { x: 0, y: 0, cmPerPixel: 1.7, pixelWidth: w }, w, { ceilingHeight: 270 });
    expect(listSharedWalls(computeFloorWalls(out.rooms))).toHaveLength(1);
  });
});

describe("calibrazione della scala", () => {
  it("ricalcola i cm per pixel tenendo fermo il primo punto", async () => {
    const { calibrateBackground, initialBackground } = await import("@/floorplan/client");
    const bg = initialBackground({ dataUrl: "data:image/png;base64,AAAA", width: 700, height: 520 }, { x: 100, y: 50 });
    // Due punti a 500 px di distanza sull'immagine, misurati alla scala stimata.
    const p1 = { x: 100 + 75 * bg.cmPerPixel, y: 50 + 75 * bg.cmPerPixel };
    const p2 = { x: 100 + 575 * bg.cmPerPixel, y: p1.y };
    const out = calibrateBackground(bg, p1, p2, 1000);
    expect(out.cmPerPixel).toBeCloseTo(2);
    expect(out.calibrated).toBe(true);
    // Il primo punto corrisponde ancora al pixel (75, 75).
    expect(out.x + 75 * out.cmPerPixel).toBeCloseTo(p1.x);
    expect(out.y + 75 * out.cmPerPixel).toBeCloseTo(p1.y);
  });
});
