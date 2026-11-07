import { describe, expect, it } from "vitest";
import { createHouse, createPlacedItem, createRectRoom } from "@/domain/factory";
import { ProductSchema, safeParseHouse } from "@/domain/schema";

const base = {
  id: "p1",
  name: "Divano",
  category: "Soggiorno",
  width: 200,
  depth: 90,
  height: 85,
  price: 499,
  priceUpdatedAt: "2026-10-15",
};

describe("link dei prodotti", () => {
  it("mantiene gli indirizzi http(s)", () => {
    const p = ProductSchema.parse({ ...base, url: "https://esempio.it/divano", imageUrl: "http://cdn.esempio.it/d.jpg", modelUrl: "https://esempio.it/d.glb" });
    expect(p.url).toBe("https://esempio.it/divano");
    expect(p.imageUrl).toBe("http://cdn.esempio.it/d.jpg");
    expect(p.modelUrl).toBe("https://esempio.it/d.glb");
  });

  it("scarta javascript:, data: e testo libero senza rifiutare il prodotto", () => {
    const p = ProductSchema.parse({ ...base, url: "javascript:alert(document.cookie)", imageUrl: "data:image/svg+xml,<svg/>", modelUrl: "non un link" });
    expect(p.url).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
    expect(p.modelUrl).toBeUndefined();
  });

  it("un progetto con link non validi si carica comunque, senza quei link", () => {
    const house = createHouse("Prova");
    const room = createRectRoom(400, 300);
    const item = createPlacedItem(ProductSchema.parse(base), 100, 100);
    room.items.push({ ...item, product: { ...item.product, url: "javascript:alert(1)" } });
    house.floors[0].rooms.push(room);
    const parsed = safeParseHouse(JSON.parse(JSON.stringify(house)));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.floors[0].rooms[0].items[0].product.url).toBeUndefined();
  });
});
