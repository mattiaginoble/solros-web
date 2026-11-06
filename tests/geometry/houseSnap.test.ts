import { describe, expect, it } from "vitest";
import { createRectRoom } from "@/domain/factory";
import { applyMatchThickness, joinRooms, snapRoomPosition } from "@/lib/geometry/houseSnap";
import { computeFloorWalls, listSharedWalls } from "@/lib/geometry/walls";

describe("composizione della casa", () => {
  const a = createRectRoom(300, 400, { wallThickness: 10 });
  const b = createRectRoom(250, 400, { wallThickness: 10 });

  it("aggancia due stanze alla distanza dello spessore del muro", () => {
    const r = snapRoomPosition(b, { x: 318, y: 0 }, [a], 20);
    expect(r.x).toBe(310);
    expect(r.matches[0].kind).toBe("facing");
    expect(r.matches[0].gap).toBe(10);
    const walls = computeFloorWalls([a, { ...b, x: r.x, y: r.y }]);
    expect(listSharedWalls(walls)).toHaveLength(1);
  });

  it("allinea anche gli angoli lungo il lato condiviso", () => {
    const r = snapRoomPosition(b, { x: 305, y: 7 }, [a], 20);
    expect(r.x).toBe(310);
    expect(r.y).toBe(0);
  });

  it("allinea i muri di facciata di stanze non adiacenti", () => {
    const r = snapRoomPosition(b, { x: 600, y: 6 }, [a], 20);
    expect(r.x).toBe(600);
    expect(r.y).toBe(0);
    expect(r.matches[0].kind).toBe("collinear");
  });

  it("non aggancia stanze lontane", () => {
    const r = snapRoomPosition(b, { x: 700, y: 120 }, [a], 20);
    expect(r).toEqual({ x: 700, y: 120, matches: [] });
  });

  it("usa lo spessore del muro della stanza ferma", () => {
    const thick = createRectRoom(300, 400, { wallThickness: 30 });
    const r = snapRoomPosition(b, { x: 322, y: 0 }, [thick], 20);
    expect(r.x).toBe(330);
    expect(r.matches[0].gap).toBe(30);
  });

  it("Unisci accosta una stanza lontana sul lato più vicino", () => {
    const far = { ...b, x: 900, y: 250 };
    const j = joinRooms(far, a)!;
    expect(j.x).toBe(310);
    expect(j.y).toBe(0);
    const walls = computeFloorWalls([a, { ...far, x: j.x, y: j.y }]);
    expect(listSharedWalls(walls)).toHaveLength(1);
  });

  it("Unisci funziona anche sotto la stanza", () => {
    const below = { ...createRectRoom(300, 200, { wallThickness: 10 }), x: 40, y: 700 };
    const j = joinRooms(below, a)!;
    expect(j.y).toBe(410);
    expect(j.x).toBe(0);
  });

  it("uniformano gli spessori dei muri uniti", () => {
    const moved = { ...b, x: 330, y: 0 };
    const thick = createRectRoom(300, 400, { wallThickness: 30 });
    const r = snapRoomPosition(b, { x: 330, y: 0 }, [thick], 20);
    const [t2, m2] = applyMatchThickness([thick, moved], r.matches);
    expect(m2.walls[3].thickness).toBe(30);
    expect(t2.walls[1].thickness).toBe(30);
  });
});
