import { describe, expect, it } from "vitest";
import { createRectRoom } from "@/domain/factory";
import {
  DEFAULT_CHOICES,
  applyKitchen,
  choicesFromConfig,
  composeKitchen,
  fillWidths,
  kitchenExtras,
  kitchenItems,
  runWidth,
  type KitchenChoices,
} from "@/kitchen/compose";
import { analyzeRoomItems } from "@/lib/geometry/placement";
import { quoteForRoom } from "@/lib/pricing/quote";

const room = () => createRectRoom(400, 300, { type: "cucina" });
const choices = (patch: Partial<KitchenChoices> = {}): KitchenChoices => ({
  ...DEFAULT_CHOICES,
  wallIndex: 0,
  start: 0,
  length: 400,
  lengthB: 250,
  ...patch,
});

describe("riempimento delle misure", () => {
  it("copre esattamente lo spazio con moduli standard e compensatore", () => {
    for (const space of [60, 100, 130, 205, 270, 333, 50]) {
      const r = fillWidths(space);
      const total = r.widths.reduce((a, b) => a + b, 0) + r.filler;
      expect(total).toBeCloseTo(space);
      expect(r.filler).toBeLessThan(30);
    }
  });

  it("preferisce pochi moduli larghi", () => {
    expect(fillWidths(120).widths).toEqual([60, 60]);
    expect(fillWidths(140).widths).toEqual([80, 60]);
  });
});

describe("composizione della cucina", () => {
  it("cucina lineare: la somma dei moduli è la lunghezza della parete", () => {
    const k = composeKitchen(room(), choices());
    expect(k.runs).toHaveLength(1);
    expect(runWidth(k.runs[0].base)).toBeCloseTo(400);
    const variants = k.runs[0].base.map((m) => m.variant);
    expect(variants).toContain("lavello");
    expect(variants).toContain("lavastoviglie");
    expect(variants).toContain("piano-forno");
    expect(variants).toContain("frigo");
    // I pensili sono allineati ai moduli base, con la cappa sopra il piano cottura.
    expect(runWidth(k.runs[0].wall)).toBeCloseTo(400);
    expect(k.runs[0].wall.some((m) => m.variant === "cappa")).toBe(true);
  });

  it("cucina ad angolo: due file e modulo d'angolo", () => {
    const k = composeKitchen(room(), choices({ layout: "corner", length: 300, lengthB: 200 }));
    expect(k.runs).toHaveLength(2);
    expect(runWidth(k.runs[0].base)).toBeCloseTo(300);
    expect(runWidth(k.runs[1].base)).toBeCloseTo(200);
    expect(k.runs[0].base[k.runs[0].base.length - 1].kind).toBe("corner");
    expect(k.runs[1].start).toBe(90);
  });

  it("gli arredi generati stanno nella stanza e non segnalano problemi", () => {
    for (const c of [choices(), choices({ layout: "corner", length: 300, lengthB: 200 })]) {
      const r = applyKitchen(room(), composeKitchen(room(), c));
      const issues = [...analyzeRoomItems(r).values()].flat();
      expect(issues).toEqual([]);
    }
  });

  it("gli elettrodomestici si agganciano ai moduli compatibili", () => {
    const r = room();
    const items = kitchenItems(r, composeKitchen(r, choices()));
    const names = items.map((i) => i.product.id);
    expect(names).toContain("demo-forno-incasso");
    expect(names).toContain("demo-piano-induzione");
    expect(names).toContain("demo-lavastoviglie");
    expect(names).toContain("demo-frigo-incasso");
    expect(names).toContain("demo-cappa-60");
    expect(items.some((i) => i.product.shape === "worktop")).toBe(true);
  });

  it("forno in colonna e frigo a libera installazione", () => {
    const k = composeKitchen(room(), choices({ oven: "tall", fridge: "freestanding" }));
    const kinds = k.runs[0].base.map((m) => `${m.kind}:${m.variant}`);
    expect(kinds).toContain("tall:forno");
    expect(kinds).toContain("appliance-slot:frigo-libero");
    expect(kinds).toContain("base:piano");
  });

  it("riapre il configuratore con le scelte salvate", () => {
    const r = room();
    const c = choices({ layout: "corner", length: 320, lengthB: 180, hood: "wall-90", frontId: "rovere" });
    const back = choicesFromConfig(r, composeKitchen(r, c));
    expect(back).toMatchObject({ layout: "corner", hood: "wall-90", frontId: "rovere", length: 320 });
  });
});

describe("distinta e prezzo della cucina", () => {
  it("include frontali, maniglie e zoccolo nel preventivo della stanza", () => {
    const r = applyKitchen(room(), composeKitchen(room(), choices({ frontId: "rovere", handleId: "barra-acciaio" })));
    const extras = kitchenExtras(r);
    expect(extras.map((l) => l.productId)).toEqual(["kitchen-front-rovere", "kitchen-handle-barra-acciaio", "kitchen-plinth"]);
    const q = quoteForRoom(r);
    const itemsTotal = r.items.reduce((a, i) => a + i.product.price, 0);
    const extrasTotal = extras.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
    expect(q.totals.EUR).toBeCloseTo(itemsTotal + extrasTotal);
  });

  it("con la gola le maniglie si contano al metro", () => {
    const r = applyKitchen(room(), composeKitchen(room(), choices({ handleId: "gola" })));
    const line = kitchenExtras(r).find((l) => l.productId === "kitchen-handle-gola")!;
    expect(line.quantity).toBe(4);
  });

  it("rimuovere la cucina toglie solo i suoi oggetti", () => {
    const r = applyKitchen(room(), composeKitchen(room(), choices()));
    const cleared = applyKitchen(r, null);
    expect(cleared.items).toHaveLength(0);
    expect(cleared.kitchen).toBeUndefined();
  });
});

describe("finestre e pensili", () => {
  it("non mette pensili davanti a una finestra", async () => {
    const { createOpening } = await import("@/domain/factory");
    const r = room();
    r.openings.push(createOpening("window", r.walls[0].id, 150, { width: 100, sill: 100, height: 130 }));
    const k = composeKitchen(r, choices());
    let s = 0;
    for (const m of k.runs[0].wall) {
      const overlaps = s < 250 && s + m.width > 150;
      if (overlaps) expect(["gap"]).toContain(m.kind);
      s += m.width;
    }
  });
});
