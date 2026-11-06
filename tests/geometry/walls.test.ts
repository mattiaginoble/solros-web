import { describe, expect, it } from "vitest";
import { createOpening, createRectRoom, createRoom } from "@/domain/factory";
import {
  computeFloorWalls,
  listSharedWalls,
  openingGeometries,
  pieceQuad,
  pieceSegments,
} from "@/lib/geometry/walls";
import { lShapePolygon } from "@/lib/geometry/polygon";

describe("muri derivati", () => {
  it("una stanza isolata genera un pezzo per lato", () => {
    const r = createRectRoom(400, 300, { wallThickness: 10 });
    const w = computeFloorWalls([r]);
    expect(w.pieces).toHaveLength(4);
    expect(listSharedWalls(w)).toHaveLength(0);
    const top = w.pieces[0];
    const q = pieceQuad(top);
    // Faccia interna da (0,0) a (400,0), esterna con giunto a -10.
    expect(q[0]).toEqual({ x: 0, y: 0 });
    expect(q[2].x).toBeCloseTo(410);
    expect(q[2].y).toBeCloseTo(-10);
    expect(q[3].x).toBeCloseTo(-10);
  });

  it("due stanze affiancate alla distanza dello spessore condividono il muro", () => {
    const a = createRectRoom(300, 400, { wallThickness: 10 });
    const b = createRectRoom(250, 400, { wallThickness: 10, x: 310, y: 0 });
    const w = computeFloorWalls([a, b]);
    const shared = listSharedWalls(w);
    expect(shared).toHaveLength(1);
    expect(shared[0].roomId).toBe(a.id);
    expect(shared[0].otherRoomId).toBe(b.id);
    expect(shared[0].length).toBeCloseTo(400);
    expect(shared[0].gap).toBeCloseTo(10);
    // La stanza B non genera il muro condiviso: 4 pezzi per A, 3 per B.
    expect(w.pieces.filter((p) => p.roomId === a.id)).toHaveLength(4);
    expect(w.pieces.filter((p) => p.roomId === b.id)).toHaveLength(3);
  });

  it("sovrapposizione parziale: il resto del lato resta muro proprio", () => {
    const a = createRectRoom(300, 400, { wallThickness: 10 });
    const b = createRectRoom(200, 200, { wallThickness: 10, x: 310, y: 100 });
    const w = computeFloorWalls([a, b]);
    const right = w.pieces.filter((p) => p.roomId === a.id && p.wallId === a.walls[1].id);
    // Lato destro di A: proprio [0,100], condiviso [100,300], proprio [300,400].
    expect(right).toHaveLength(3);
    expect(right[1].shared?.roomId).toBe(b.id);
    expect(right[1].s0).toBeCloseTo(100);
    expect(right[1].s1).toBeCloseTo(300);
  });

  it("stanze troppo lontane non condividono", () => {
    const a = createRectRoom(300, 400, { wallThickness: 10 });
    const b = createRectRoom(250, 400, { wallThickness: 10, x: 330, y: 0 });
    expect(listSharedWalls(computeFloorWalls([a, b]))).toHaveLength(0);
  });

  it("riconosce il muro condiviso anche con stanze ruotate", () => {
    const a = createRectRoom(300, 400, { wallThickness: 10 });
    // B ruotata di 180° attorno alla propria origine: occupa x 310..560.
    const b = { ...createRectRoom(250, 400, { wallThickness: 10 }), x: 560, y: 400, rotation: 180 };
    expect(listSharedWalls(computeFloorWalls([a, b]))).toHaveLength(1);
  });

  it("le aperture di entrambe le stanze forano il muro condiviso", () => {
    const a = createRectRoom(300, 400, { wallThickness: 10 });
    const b = createRectRoom(250, 400, { wallThickness: 10, x: 310, y: 0 });
    // Porta sulla stanza B (lato sinistro, che va dal basso verso l'alto).
    b.openings.push(createOpening("door", b.walls[3].id, 50, { width: 80 }));
    const w = computeFloorWalls([a, b]);
    const shared = w.pieces.find((p) => p.shared)!;
    expect(shared.openings).toHaveLength(1);
    // Sul lato di A (dall'alto in basso) la porta di B occupa 400-130 .. 400-50.
    expect(shared.openings[0].s0).toBeCloseTo(270);
    expect(shared.openings[0].s1).toBeCloseTo(350);
    const segs = pieceSegments(shared);
    expect(segs.map((s) => !!s.opening)).toEqual([false, true, false]);
  });

  it("geometria delle aperture sulla faccia interna", () => {
    const a = createRectRoom(300, 400, { wallThickness: 15 });
    a.openings.push(createOpening("window", a.walls[0].id, 100, { width: 120 }));
    const g = openingGeometries([a], computeFloorWalls([a]));
    expect(g[0].start).toEqual({ x: 100, y: 0 });
    expect(g[0].end).toEqual({ x: 220, y: 0 });
    expect(g[0].inward).toEqual({ x: -0, y: 1 });
    expect(g[0].thickness).toBe(15);
  });

  it("forma a L: giunti corretti anche nell'angolo rientrante", () => {
    const r = createRoom({ polygon: lShapePolygon(600, 500, 220, 200), wallThickness: 10 });
    const w = computeFloorWalls([r]);
    expect(w.pieces).toHaveLength(6);
    // Il lato interno orizzontale (indice 2) ha faccia esterna più corta (angolo concavo).
    const inner = w.pieces[2];
    const q = pieceQuad(inner);
    const innerLen = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
    const outerLen = Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y);
    expect(innerLen).toBeCloseTo(220);
    expect(outerLen).toBeCloseTo(220);
  });
});
