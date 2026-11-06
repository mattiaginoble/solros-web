import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { colorFamily, normalizeText, scoreProduct, searchProducts } from "@/catalog/filter";

describe("catalogo", () => {
  it("contiene circa 80 prodotti demo con dati completi", () => {
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(80);
    const ids = new Set(DEMO_PRODUCTS.map((p) => p.id));
    expect(ids.size).toBe(DEMO_PRODUCTS.length);
    for (const p of DEMO_PRODUCTS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.source).toBe("demo");
    }
  });

  it("normalizza testo con accenti", () => {
    expect(normalizeText("  Città  Più ")).toBe("citta piu");
  });

  it("ricerca testuale con tutte le parole", () => {
    const r = searchProducts(DEMO_PRODUCTS, { text: "divano pelle" });
    expect(r.items.map((p) => p.id)).toEqual(["demo-divano-3p-pelle"]);
    expect(searchProducts(DEMO_PRODUCTS, { text: "zzzz" }).total).toBe(0);
  });

  it("la parola nel nome pesa più della categoria", () => {
    const sofa = DEMO_PRODUCTS.find((p) => p.id === "demo-divano-2p")!;
    const armchair = DEMO_PRODUCTS.find((p) => p.id === "demo-poltrona")!;
    expect(scoreProduct(sofa, "divano")).toBeGreaterThan(scoreProduct(armchair, "soggiorno"));
  });

  it("filtra per categoria, prezzo e ingombro", () => {
    const r = searchProducts(DEMO_PRODUCTS, { category: "Camera", priceMax: 300, maxWidth: 110 });
    expect(r.total).toBeGreaterThan(0);
    for (const p of r.items) {
      expect(p.category).toBe("Camera");
      expect(p.price).toBeLessThanOrEqual(300);
      expect(p.width).toBeLessThanOrEqual(110);
    }
  });

  it("filtra per rivenditore e colore", () => {
    const r = searchProducts(DEMO_PRODUCTS, { retailers: ["Demo Elettro"], color: "Metallo" });
    expect(r.items.every((p) => p.retailer === "Demo Elettro" && colorFamily(p) === "Metallo")).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });

  it("ordina per prezzo", () => {
    const r = searchProducts(DEMO_PRODUCTS, { category: "Soggiorno", sort: "price-asc" });
    const prices = r.items.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("le faccette ignorano il proprio filtro", () => {
    const r = searchProducts(DEMO_PRODUCTS, { category: "Bagno" });
    expect(r.facets.categories.length).toBeGreaterThan(3);
    expect(r.facets.retailers.every((f) => f.count > 0)).toBe(true);
  });

  it("riconosce le famiglie di colore", () => {
    expect(colorFamily({ color: "Rovere" })).toBe("Legno");
    expect(colorFamily({ color: "Grigio antracite" })).toBe("Nero");
    expect(colorFamily({ colorHex: "#2f3b55" })).toBe("Blu");
    expect(colorFamily({})).toBe("Altro");
  });
});
