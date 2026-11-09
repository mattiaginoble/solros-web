import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { autoDetectMapping, mapRows, normalizeLink, rowsFromJson, safeUrl } from "@/catalog/importMapping";
import { inferShape, parseDimensions, parseLocaleNumber } from "@/catalog/normalize";

const OPTS = { unit: "cm" as const, retailer: "Negozio Prova", currency: "EUR", batch: "test.csv", priceDate: "2026-11-01T00:00:00.000Z" };

describe("normalizzazione", () => {
  it("legge i numeri in formato italiano e inglese", () => {
    expect(parseLocaleNumber("1.299,00 €")).toBe(1299);
    expect(parseLocaleNumber("1,299.50")).toBe(1299.5);
    expect(parseLocaleNumber("45,5")).toBe(45.5);
    expect(parseLocaleNumber("1.299")).toBe(1299);
    expect(parseLocaleNumber("0,125")).toBe(0.125);
    expect(parseLocaleNumber("€ 89")).toBe(89);
    expect(parseLocaleNumber("abc")).toBeNull();
  });

  it("estrae le dimensioni da testo libero", () => {
    expect(parseDimensions("Divano 3 posti, 218x92x84 cm")).toEqual({ width: 218, depth: 92, height: 84 });
    expect(parseDimensions("L 200 x P 90 x H 85 cm")).toEqual({ width: 200, depth: 90, height: 85 });
    expect(parseDimensions("Larghezza: 1600 mm, Profondità: 2000 mm, Altezza: 950 mm")).toEqual({ width: 160, depth: 200, height: 95 });
  });

  it("deduce forma e montaggio dal nome", () => {
    expect(inferShape("Divano letto 2 posti")).toEqual({ shape: "sofa", mount: "floor" });
    expect(inferShape("Pensile cucina 60")).toEqual({ shape: "cabinet", mount: "wall" });
    expect(inferShape("Lampadario in vetro")).toEqual({ shape: "lamp-ceiling", mount: "ceiling" });
    expect(inferShape("Congelatore sottotavolo integrato").shape).toBe("fridge");
    expect(inferShape("Tavolino da caffè").shape).toBe("table");
    expect(inferShape("Tavolo allungabile").shape).toBe("table");
  });

  it("accetta solo URL http(s)", () => {
    expect(safeUrl("https://example.com/p/1")).toBe("https://example.com/p/1");
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("completa i link senza protocollo e scarta quelli non http(s)", () => {
    expect(normalizeLink("www.esempio.it/divano-lisa")).toBe("https://www.esempio.it/divano-lisa");
    expect(normalizeLink("esempio.it")).toBe("https://esempio.it/");
    expect(normalizeLink("http://esempio.it/a")).toBe("http://esempio.it/a");
    expect(normalizeLink("javascript:alert(1)")).toBeUndefined();
    expect(normalizeLink("data:text/html,<script>")).toBeUndefined();
    expect(normalizeLink("divano blu")).toBeUndefined();
    expect(normalizeLink("")).toBeUndefined();
  });
});

describe("import da CSV", () => {
  const csv = `Nome;Prezzo;Larghezza;Profondità;Altezza;SKU;Colore;Link
Divano 3 posti;"1.299,00";218;92;84;DV-1;Grigio;https://negozio.example/divano
Tavolo allungabile;459;140;90;76;TV-2;Rovere;https://negozio.example/tavolo
Senza prezzo;;10;10;10;X;;
Lampada;49;30;30;
`;
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

  it("riconosce le colonne dalle intestazioni", () => {
    const m = autoDetectMapping(parsed.meta.fields!);
    expect(m).toMatchObject({ name: "Nome", price: "Prezzo", width: "Larghezza", depth: "Profondità", height: "Altezza", code: "SKU", color: "Colore", url: "Link" });
  });

  it("converte le righe valide e segnala gli errori con il numero di riga", () => {
    const res = mapRows(parsed.data, autoDetectMapping(parsed.meta.fields!), OPTS);
    expect(res.products).toHaveLength(2);
    expect(res.products[0]).toMatchObject({ name: "Divano 3 posti", price: 1299, width: 218, retailer: "Negozio Prova", source: "import", shape: "sofa", category: "Soggiorno" });
    expect(res.errors.map((e) => e.row)).toEqual([4, 5]);
  });

  it("gli id sono stabili: reimportare lo stesso file aggiorna i prodotti", () => {
    const a = mapRows(parsed.data, autoDetectMapping(parsed.meta.fields!), OPTS);
    const b = mapRows(parsed.data, autoDetectMapping(parsed.meta.fields!), OPTS);
    expect(a.products.map((p) => p.id)).toEqual(b.products.map((p) => p.id));
  });

  it("converte le misure in millimetri", () => {
    const res = mapRows([{ n: "Letto", p: "449", w: "1680", d: "2100", h: "1000" }], { name: "n", price: "p", width: "w", depth: "d", height: "h" }, { ...OPTS, unit: "mm" });
    expect(res.products[0]).toMatchObject({ width: 168, depth: 210, height: 100, shape: "bed" });
  });
});

describe("import da JSON", () => {
  it("accetta un elenco o un oggetto con products e appiattisce i campi annidati", () => {
    const rows = rowsFromJson({ products: [{ title: "Sedia", offers: { price: "59" }, size: "45x52x82 cm" }] });
    expect(rows[0]).toEqual({ title: "Sedia", "offers.price": "59", size: "45x52x82 cm" });
    const res = mapRows(rows, { name: "title", price: "offers.price", dimensions: "size" }, OPTS);
    expect(res.products[0]).toMatchObject({ name: "Sedia", price: 59, width: 45, depth: 52, height: 82, shape: "chair" });
  });

  it("rifiuta JSON senza elenco di prodotti", () => {
    expect(() => rowsFromJson({ foo: 1 })).toThrow();
  });
});
