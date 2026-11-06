import { describe, expect, it } from "vitest";
import { createFloor, createHouse, createRectRoom } from "@/domain/factory";
import { adjacentFloor, recomputeElevations } from "@/domain/floors";

describe("piani", () => {
  it("impila i piani sopra e sotto il piano terra", () => {
    const h = createHouse();
    h.floors[0].rooms.push(createRectRoom(300, 300, { ceilingHeight: 280 }));
    h.floors.push(createFloor(1), createFloor(2), createFloor(-1));
    const r = recomputeElevations(h);
    const byLevel = Object.fromEntries(r.floors.map((f) => [f.level, f.elevation]));
    expect(byLevel[0]).toBe(0);
    expect(byLevel[1]).toBe(280 + 30);
    expect(byLevel[2]).toBe(310 + 270 + 30);
    expect(byLevel[-1]).toBe(-(270 + 30));
  });

  it("trova il piano adiacente", () => {
    const h = createHouse();
    const up = createFloor(1);
    h.floors.push(up);
    expect(adjacentFloor(h, h.floors[0].id, 1)?.id).toBe(up.id);
    expect(adjacentFloor(h, h.floors[0].id, -1)).toBeNull();
  });
});
