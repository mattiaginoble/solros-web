import { describe, expect, it } from "vitest";
import { IKEA_PLANNER_GROUPS, IKEA_PLANNERS, ikeaPlanner } from "@/catalog/ikeaPlanners";

describe("configuratori IKEA", () => {
  it("collegano solo pagine di IKEA Italia in https", () => {
    for (const p of IKEA_PLANNERS) {
      const url = new URL(p.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.ikea.com");
      expect(url.pathname.startsWith("/it/it/")).toBe(true);
    }
  });

  it("non hanno doppioni e ogni gruppo ha almeno un configuratore", () => {
    expect(new Set(IKEA_PLANNERS.map((p) => p.id)).size).toBe(IKEA_PLANNERS.length);
    expect(new Set(IKEA_PLANNERS.map((p) => p.url)).size).toBe(IKEA_PLANNERS.length);
    for (const g of IKEA_PLANNER_GROUPS) expect(g.planners.length).toBeGreaterThan(0);
  });

  it("includono quelli usati dal configuratore cucina", () => {
    expect(ikeaPlanner("kitchen-planner")?.url).toBe("https://www.ikea.com/it/it/planners/kitchen-planner/");
    expect(ikeaPlanner("knoxhult-planner")).toBeDefined();
    expect(ikeaPlanner("inesistente")).toBeUndefined();
  });
});
