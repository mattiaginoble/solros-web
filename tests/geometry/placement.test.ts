import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createOpening, createPlacedItem, createRectRoom } from "@/domain/factory";
import {
  analyzeRoomItems,
  clearanceOBB,
  doesNotFit,
  findFreeSpot,
  placeNearWall,
  rotationFacingAwayFrom,
  snapItem,
} from "@/lib/geometry/placement";

const product = (id: string) => DEMO_PRODUCTS.find((p) => p.id === `demo-${id}`)!;

describe("posizionamento oggetti", () => {
  it("rotazione con il retro verso il muro", () => {
    expect(rotationFacingAwayFrom({ x: 0, y: -1 })).toBe(0); // muro in alto
    expect(rotationFacingAwayFrom({ x: 1, y: 0 })).toBe(90); // muro a destra
    expect(rotationFacingAwayFrom({ x: 0, y: 1 })).toBe(180);
    expect(rotationFacingAwayFrom({ x: -1, y: 0 })).toBe(270);
  });

  it("snap del retro alla parete vicina", () => {
    const room = createRectRoom(400, 300);
    const sofa = createPlacedItem(product("divano-3p"), 200, 60);
    const r = snapItem(room, sofa, { x: 200, y: 52 }, []);
    expect(r.y).toBeCloseTo(sofa.product.depth / 2);
    expect(r.wallIndex).toBe(0);
  });

  it("snap in angolo su due pareti", () => {
    const room = createRectRoom(400, 300);
    const w = createPlacedItem(product("armadio-100"), 0, 0);
    const r = snapItem(room, w, { x: 58, y: 36 }, []);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(29);
  });

  it("snap al centro stanza", () => {
    const room = createRectRoom(400, 300);
    const t = createPlacedItem(product("tavolo-120"), 0, 0);
    const r = snapItem(room, t, { x: 203, y: 148 }, []);
    expect(r.x).toBe(200);
    expect(r.y).toBe(150);
  });

  it("rilasciato vicino a un muro, si orienta verso la stanza", () => {
    const room = createRectRoom(400, 300);
    const bed = createPlacedItem(product("letto-160"), 0, 0);
    const p = placeNearWall(room, bed, { x: 380, y: 150 });
    expect(p.rotation).toBe(90);
    expect(p.x).toBeCloseTo(400 - bed.product.depth / 2);
  });

  it("segnala sovrapposizioni tra oggetti", () => {
    const room = createRectRoom(400, 300);
    const a = createPlacedItem(product("tavolo-120"), 150, 150);
    const b = createPlacedItem(product("tavolo-120"), 200, 150);
    room.items.push(a, b);
    const issues = analyzeRoomItems(room);
    expect(issues.get(a.id)?.some((i) => i.kind === "collision")).toBe(true);
  });

  it("un tappeto non collide con i mobili", () => {
    const room = createRectRoom(400, 300);
    const rug = createPlacedItem(product("tappeto-160"), 200, 150, 90);
    const table = createPlacedItem(product("tavolino-rett"), 200, 150);
    room.items.push(rug, table);
    const issues = analyzeRoomItems(room);
    expect(issues.get(table.id)).toEqual([]);
  });

  it("pensile sopra un mobile base: nessuna collisione", () => {
    const room = createRectRoom(400, 300);
    const base = createPlacedItem(product("base-60"), 100, 30);
    const wall = createPlacedItem(product("pensile-60"), 100, 17.5);
    room.items.push(base, wall);
    expect(analyzeRoomItems(room).get(wall.id)).toEqual([]);
  });

  it("segnala oggetti fuori stanza", () => {
    const room = createRectRoom(200, 200);
    const sofa = createPlacedItem(product("divano-3p"), 100, 100);
    room.items.push(sofa);
    expect(analyzeRoomItems(room).get(sofa.id)?.[0].kind).toBe("outside");
  });

  it("segnala la porta bloccata", () => {
    const room = createRectRoom(400, 300);
    room.openings.push(createOpening("door", room.walls[0].id, 100, { width: 80 }));
    const chair = createPlacedItem(product("poltrona"), 140, 50);
    room.items.push(chair);
    expect(analyzeRoomItems(room).get(chair.id)?.some((i) => i.kind === "blocks-door")).toBe(true);
  });

  it("ingombro di apertura davanti all'armadio", () => {
    const room = createRectRoom(400, 300);
    const w = createPlacedItem(product("armadio-200"), 200, 30);
    const cl = clearanceOBB(w)!;
    expect(cl.center.y).toBeCloseTo(30 + 30 + 30);
    const bed = createPlacedItem(product("letto-160"), 200, 120);
    room.items.push(w, bed);
    expect(analyzeRoomItems(room).get(w.id)?.some((i) => i.kind === "clearance")).toBe(true);
  });

  it("riconosce un oggetto che non entra nella stanza", () => {
    const room = createRectRoom(200, 250);
    expect(doesNotFit(room, 276, 165)).toBe(true);
    expect(doesNotFit(room, 160, 230)).toBe(false);
  });
});

describe("ricerca di uno spazio libero", () => {
  it("trova un punto lungo una parete libera", () => {
    const room = createRectRoom(400, 300);
    room.items.push(createPlacedItem(product("letto-160"), 200, 150));
    const chair = createPlacedItem(product("poltrona"), 200, 150);
    const spot = findFreeSpot(room, chair)!;
    expect(spot).not.toBeNull();
    const test = { ...room, items: [...room.items, { ...chair, ...spot }] };
    expect(analyzeRoomItems(test).get(chair.id)).toEqual([]);
  });

  it("restituisce null se la stanza è piena", () => {
    const room = createRectRoom(100, 100);
    const sofa = createPlacedItem(product("divano-angolare"), 50, 50);
    expect(findFreeSpot(room, sofa)).toBeNull();
  });
});
