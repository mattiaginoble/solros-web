import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createHouse, createPlacedItem, createRectRoom } from "@/domain/factory";
import type { Product } from "@/domain/schema";
import { addItems, amazonCartUrl, cartListText, cartTotals, checkoutFor, groupByRetailer, itemsFromHouse, shopifyCartUrl } from "@/lib/cart/cart";
import { formatMoney } from "@/lib/pricing/quote";

const base = DEMO_PRODUCTS[0];
const p = (over: Partial<Product>): Product => ({ ...base, ...over });

describe("carrello", () => {
  it("somma le quantità degli stessi prodotti e calcola i totali in centesimi", () => {
    const a = p({ id: "a", price: 0.1 });
    const b = p({ id: "b", price: 0.2, currency: "CHF" });
    const items = addItems(addItems([], [{ product: a, quantity: 2 }]), [{ product: a, quantity: 1 }, { product: b, quantity: 1 }, { product: b, quantity: 0 }]);
    expect(items.map((i) => [i.product.id, i.quantity])).toEqual([["a", 3], ["b", 1]]);
    expect(cartTotals(items)).toEqual({ EUR: 0.3, CHF: 0.2 });
  });

  it("prende gli arredi di tutta la casa con le quantità", () => {
    const h = createHouse("Casa");
    const r = createRectRoom(400, 300);
    const chair = DEMO_PRODUCTS.find((x) => x.id === "demo-sedia-legno")!;
    r.items.push(createPlacedItem(chair, 10, 10), createPlacedItem(chair, 60, 10));
    h.floors[0].rooms.push(r);
    expect(itemsFromHouse(h)).toEqual([{ product: expect.objectContaining({ id: "demo-sedia-legno" }), quantity: 2 }]);
  });

  it("crea il link al carrello Amazon dagli ASIN, conservando il codice affiliato", () => {
    const items = [
      { product: p({ id: "1", url: "https://www.amazon.it/Divano/dp/B0ABCDEF12/?tag=miotag-21" }), quantity: 2 },
      { product: p({ id: "2", url: "https://www.amazon.it/gp/product/B0XYZ98765" }), quantity: 1 },
    ];
    expect(amazonCartUrl(items)).toBe("https://www.amazon.it/gp/aws/cart/add.html?ASIN.1=B0ABCDEF12&Quantity.1=2&ASIN.2=B0XYZ98765&Quantity.2=1&AssociateTag=miotag-21");
    expect(amazonCartUrl([...items, { product: p({ id: "3", url: "https://www.amazon.de/dp/B0AAAAAAAA" }), quantity: 1 }])).toBeNull();
  });

  it("crea il link al carrello Shopify dagli identificativi dei feed", () => {
    const items = [
      { product: p({ id: "1", code: "shopify_IT_111_9001", url: "https://negozio.example.com/products/sedia" }), quantity: 4 },
      { product: p({ id: "2", code: "shopify_IT_222_9002", url: "https://negozio.example.com/products/tavolo" }), quantity: 1 },
    ];
    expect(shopifyCartUrl(items)).toBe("https://negozio.example.com/cart/9001:4,9002:1");
    expect(checkoutFor(items)).toEqual({ kind: "cart", url: "https://negozio.example.com/cart/9001:4,9002:1", label: "Vai al carrello del negozio" });
  });

  it("negli altri negozi apre le pagine dei prodotti e prepara l'elenco con i codici", () => {
    const ikea = [
      { product: p({ id: "k", retailer: "IKEA", name: "BILLY libreria", code: "002.638.50", price: 59, url: "https://www.ikea.com/it/it/p/billy-00263850/" }), quantity: 2 },
      { product: p({ id: "m", retailer: "IKEA", name: "MALM cassettiera", code: "504.035.70", price: 129, url: "https://www.ikea.com/it/it/p/malm-50403570/" }), quantity: 1 },
    ];
    const groups = groupByRetailer([...ikea, { product: p({ id: "d", retailer: "Demo Arredo", url: undefined }), quantity: 1 }]);
    expect(groups.map((g) => g.retailer)).toEqual(["Demo Arredo", "IKEA"]);
    expect(groups[0].checkout).toEqual({ kind: "pages", urls: [] });
    expect(groups[1].checkout).toEqual({ kind: "pages", urls: ikea.map((i) => i.product.url) });
    // Intl separa importo e valuta con uno spazio non separabile.
    expect(cartListText(groups[1], formatMoney).replace(/\u00a0/g, " ")).toBe(
      "IKEA:\n2 × BILLY libreria (art. 002.638.50) — 118,00 €\n1 × MALM cassettiera (art. 504.035.70) — 129,00 €\nTotale: 247,00 €",
    );
  });
});
