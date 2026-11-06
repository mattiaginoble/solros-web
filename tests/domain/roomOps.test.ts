import { describe, expect, it } from "vitest";
import { createOpening, createRectRoom, createRoom } from "@/domain/factory";
import {
  addOpening,
  clampOpenings,
  insertVertex,
  moveEdge,
  nearestWall,
  normalizeRoom,
  removeVertex,
  roomStats,
  setEdgeLength,
} from "@/domain/roomOps";
import { lShapePolygon, signedArea } from "@/lib/geometry/polygon";

describe("operazioni sulle stanze", () => {
  it("crea stanze con origine nell'angolo dell'ingombro", () => {
    const r = createRoom({ polygon: [{ x: 100, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 350 }, { x: 100, y: 350 }] });
    expect(r.x).toBe(100);
    expect(r.y).toBe(50);
    expect(r.polygon[0]).toEqual({ x: 0, y: 0 });
    expect(r.walls).toHaveLength(4);
  });

  it("orienta automaticamente i poligoni disegnati in senso antiorario", () => {
    const r = createRoom({ polygon: [{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 0 }] });
    expect(signedArea(r.polygon)).toBeGreaterThan(0);
  });

  it("statistiche: area in m² e lunghezze dei lati", () => {
    const s = roomStats(createRectRoom(420, 350));
    expect(s.areaM2).toBeCloseTo(14.7);
    expect(s.edgeLengths).toEqual([420, 350, 420, 350]);
  });

  it("modifica la lunghezza di un lato mantenendo il rettangolo", () => {
    const r = setEdgeLength(createRectRoom(400, 300), 0, 450);
    expect(roomStats(r).edgeLengths).toEqual([450, 300, 450, 300]);
  });

  it("modifica la lunghezza di un lato della L", () => {
    const r = createRoom({ polygon: lShapePolygon(600, 500, 220, 200) });
    const out = setEdgeLength(r, 1, 350); // lato destro superiore 300 → 350
    const lens = roomStats(out).edgeLengths;
    expect(lens[1]).toBeCloseTo(350);
    expect(lens[3]).toBeCloseTo(150); // il gradino si accorcia
    expect(lens[0]).toBeCloseTo(600);
  });

  it("sposta un lato lungo la normale", () => {
    const r = moveEdge(createRectRoom(400, 300), 1, 50);
    expect(roomStats(r).edgeLengths).toEqual([450, 300, 450, 300]);
  });

  it("inserisce un vertice e sposta le aperture sul nuovo muro", () => {
    const r = createRectRoom(400, 300);
    r.openings.push(createOpening("door", r.walls[0].id, 300, { width: 80 }));
    const out = insertVertex(r, 0, { x: 200, y: 5 });
    expect(out.polygon).toHaveLength(5);
    expect(out.walls).toHaveLength(5);
    expect(out.openings[0].wallId).toBe(out.walls[1].id);
    expect(out.openings[0].offset).toBeCloseTo(100);
  });

  it("rimuove un vertice unendo i lati", () => {
    const r = createRoom({ polygon: lShapePolygon(600, 500, 220, 200) });
    const out = removeVertex(r, 3);
    expect(out.polygon).toHaveLength(5);
    expect(out.walls).toHaveLength(5);
    expect(removeVertex(createRectRoom(100, 100), 0).polygon).toHaveLength(3);
  });

  it("non scende sotto i tre vertici", () => {
    const tri = createRoom({ polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] });
    expect(removeVertex(tri, 0)).toBe(tri);
  });

  it("mantiene le aperture dentro il muro", () => {
    const r = createRectRoom(200, 200);
    r.openings.push(createOpening("window", r.walls[0].id, 180, { width: 100 }));
    const out = clampOpenings(r);
    expect(out.openings[0].offset).toBe(100);
  });

  it("aggiunge un'apertura centrata sul punto", () => {
    const r = createRectRoom(400, 300);
    const { room, opening } = addOpening(r, "door", r.walls[0].id, 200);
    expect(opening?.offset).toBe(160);
    expect(room.openings).toHaveLength(1);
  });

  it("trova il muro più vicino", () => {
    const r = createRectRoom(400, 300);
    const w = nearestWall(r, { x: 395, y: 150 });
    expect(w?.index).toBe(1);
    expect(w?.s).toBeCloseTo(150);
  });

  it("invertendo il verso, muri e aperture restano coerenti", () => {
    const r = createRectRoom(400, 300);
    r.openings.push(createOpening("door", r.walls[0].id, 50, { width: 80 }));
    const reversed = { ...r, polygon: [...r.polygon].reverse() };
    const out = normalizeRoom(reversed);
    expect(signedArea(out.polygon)).toBeGreaterThan(0);
    const o = out.openings[0];
    const idx = out.walls.findIndex((w) => w.id === o.wallId);
    const len = roomStats(out).edgeLengths[idx];
    // Stessa posizione fisica: la porta resta tra x=50 e x=130 del lato superiore.
    expect(len).toBe(400);
  });
});
