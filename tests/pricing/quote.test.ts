import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createFloor, createHouse, createPlacedItem, createRectRoom } from "@/domain/factory";
import { aggregateLines, formatMoney, lineFromProduct, quoteForHouse, quoteForRoom } from "@/lib/pricing/quote";

const product = (id: string) => DEMO_PRODUCTS.find((p) => p.id === `demo-${id}`)!;

function sampleHouse() {
  const house = createHouse("Prova");
  const living = createRectRoom(500, 400, { type: "soggiorno", name: "Soggiorno" });
  living.items.push(createPlacedItem(product("divano-3p"), 100, 100));
  living.items.push(createPlacedItem(product("sedia-legno"), 200, 200));
  living.items.push(createPlacedItem(product("sedia-legno"), 250, 200));
  const bed = createRectRoom(350, 400, { type: "camera", name: "Camera" });
  bed.items.push(createPlacedItem(product("letto-160"), 100, 100));
  bed.items.push(createPlacedItem(product("sedia-legno"), 300, 300));
  house.floors[0].rooms.push(living, bed);
  return house;
}

describe("preventivo", () => {
  it("totale di una stanza", () => {
    const house = sampleHouse();
    const q = quoteForRoom(house.floors[0].rooms[0]);
    expect(q.totals.EUR).toBe(699 + 59 * 2);
    expect(q.lines.find((l) => l.productId === "demo-sedia-legno")?.quantity).toBe(2);
  });

  it("aggrega le quantità su tutta la casa e ricorda le stanze", () => {
    const q = quoteForHouse(sampleHouse());
    const chairs = q.lines.find((l) => l.productId === "demo-sedia-legno")!;
    expect(chairs.quantity).toBe(3);
    expect(chairs.total).toBe(177);
    expect(chairs.rooms).toEqual(["Soggiorno", "Camera"]);
    expect(q.totals.EUR).toBe(699 + 59 * 3 + 449);
    expect(q.itemCount).toBe(5);
  });

  it("raggruppa per rivenditore", () => {
    const house = sampleHouse();
    house.floors[0].rooms[0].items.push(createPlacedItem(product("frigo-libera"), 50, 50));
    const q = quoteForHouse(house);
    const elettro = q.byRetailer.find((r) => r.retailer === "Demo Elettro")!;
    expect(elettro.totals.EUR).toBe(599);
    expect(q.byRetailer.reduce((a, r) => a + r.totals.EUR, 0)).toBe(q.totals.EUR);
  });

  it("considera la quantità degli oggetti e i piani", () => {
    const house = sampleHouse();
    const upper = createFloor(1);
    const room = createRectRoom(300, 300, { name: "Studio" });
    const chair = createPlacedItem(product("sedia-ufficio"), 50, 50);
    chair.quantity = 2;
    room.items.push(chair);
    upper.rooms.push(room);
    house.floors.push(upper);
    const q = quoteForHouse(house);
    expect(q.totals.EUR).toBe(699 + 59 * 3 + 449 + 189 * 2);
    expect(quoteForHouse(house, { floorId: upper.id }).totals.EUR).toBe(378);
  });

  it("evita errori di arrotondamento con i decimali", () => {
    const p = { ...product("sedia-legno"), price: 0.1 };
    const lines = aggregateLines([lineFromProduct(p, 1), lineFromProduct(p, 2)]);
    expect(lines[0].total).toBe(0.3);
  });

  it("tiene separate le valute diverse", () => {
    const eur = lineFromProduct(product("poltrona"));
    const chf = lineFromProduct({ ...product("poltrona"), id: "x", currency: "CHF", price: 100 });
    const lines = aggregateLines([eur, chf]);
    expect(lines).toHaveLength(2);
  });

  it("segnala la presenza di dati demo e la data dei prezzi", () => {
    const q = quoteForHouse(sampleHouse());
    expect(q.hasDemo).toBe(true);
    expect(q.oldestPriceDate).toBe("2026-10-15T00:00:00.000Z");
  });

  it("formatta gli importi in euro", () => {
    expect(formatMoney(1234.5)).toMatch(/1\.234,50/);
  });
});
