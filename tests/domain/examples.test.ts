import { describe, expect, it } from "vitest";
import { EXAMPLE_HOUSES } from "@/domain/examples";
import { HouseSchema } from "@/domain/schema";
import { analyzeRoomItems, describeIssue } from "@/lib/geometry/placement";
import { computeFloorWalls, listSharedWalls } from "@/lib/geometry/walls";

describe("case di esempio", () => {
  for (const ex of EXAMPLE_HOUSES) {
    const house = ex.build();
    it(`${house.name}: documento valido`, () => {
      expect(HouseSchema.safeParse(house).success).toBe(true);
    });
    it(`${house.name}: muri condivisi tra stanze adiacenti`, () => {
      for (const f of house.floors) {
        expect(listSharedWalls(computeFloorWalls(f.rooms)).length).toBeGreaterThanOrEqual(f.rooms.length - 1);
      }
    });
    it(`${house.name}: arredi posizionati senza problemi`, () => {
      const problems: string[] = [];
      for (const f of house.floors)
        for (const r of f.rooms)
          for (const [id, issues] of analyzeRoomItems(r)) {
            const item = r.items.find((i) => i.id === id)!;
            for (const iss of issues) problems.push(`${r.name} / ${item.product.name} @(${item.x},${item.y}): ${describeIssue(iss)}`);
          }
      expect(problems).toEqual([]);
    });
  }
});
