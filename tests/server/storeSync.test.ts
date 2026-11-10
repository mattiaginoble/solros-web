import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { StorePageEntry } from "@/catalog/store/pages";

const dir = mkdtempSync(join(tmpdir(), "configuratore-negozi-"));
process.env.DATABASE_URL = `file:${join(dir, "store.db")}`;

const { prisma } = await import("@/lib/server/db");
const { syncStorePages, storeSyncStatus, productFromPage } = await import("@/lib/server/storeSync");
const { extractProductMetadata } = await import("@/catalog/linkMetadata");

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const BASE = "https://www.ikea.com/it/it/p/";
const entry = (slug: string, subcategory = "Divani"): StorePageEntry => ({ url: `${BASE}${slug}/`, retailer: "IKEA", category: "Soggiorno", subcategory });

function productPage(name: string, price: number, dims: { width?: string; depth?: string; height?: string } = { width: "190 cm", depth: "95 cm", height: "83 cm" }) {
  const ld = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name,
    mpn: "094.405.99",
    brand: { "@type": "Brand", name: "IKEA" },
    category: "Divani a due posti",
    image: [{ "@type": "ImageObject", contentUrl: "https://www.ikea.com/it/it/images/products/kivik__1577305_pe1033079_s5.jpg" }],
    offers: { "@type": "Offer", priceSpecification: [{ "@type": "UnitPriceSpecification", price: String(price), priceCurrency: "EUR" }] },
    ...dims,
  };
  return `<html><head><meta property="og:type" content="product"><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;
}
const categoryPage = `<html><head><title>Divani</title><meta property="og:type" content="product.group"></head></html>`;
const ROBOTS = "User-agent: *\nDisallow: */ikea-family/home-project-planner/*\nDisallow: /it/it/p/vietato-";

/** Sito finto: pagine per indirizzo, con il numero di richieste. */
function fakeSite(pages: Record<string, { status?: number; html?: string; url?: string } | Error>) {
  const fetchPage = vi.fn(async (url: string) => {
    const p = pages[url];
    if (!p) return { status: 404, url, html: "" };
    if (p instanceof Error) throw p;
    return { status: p.status ?? 200, url: p.url ?? url, html: p.html ?? "" };
  });
  return { fetchPage, fetchRobots: vi.fn(async () => ROBOTS), sleep: vi.fn(async () => {}) };
}

const storeProducts = () => prisma.product.findMany({ where: { source: "store" }, orderBy: { name: "asc" } });
const page = (url: string) => prisma.storePage.findUniqueOrThrow({ where: { url } });

const kivik = entry("kivik-s09440599");
const ektorp = entry("ektorp-s39628670");
const senzaMisure = entry("soderhamn-s1");
const sparito = entry("vimle-s2");
const vietato = entry("vietato-s3");
let clock = new Date("2026-11-10T04:17:00Z");
const now = () => clock;

describe("catalogo Negozi", () => {
  it("crea i prodotti dalle pagine complete e registra l'esito delle altre", async () => {
    const site = fakeSite({
      [kivik.url]: { html: productPage("KIVIK Divano a 2 posti - beige", 299) },
      [ektorp.url]: { html: productPage("EKTORP Divano angolare - beige", 649) },
      [senzaMisure.url]: { html: productPage("SÖDERHAMN Divano", 499, { width: "198 cm" }) },
    });
    const report = await syncStorePages({ pages: [kivik, ektorp, senzaMisure, sparito, vietato], now, delayMs: 2000, ...site });
    expect(report).toMatchObject({ checked: 5, updated: 2, incomplete: 1, removed: 2, errors: 0, remaining: 0, products: 2 });
    // robots.txt letto una volta sola; la pagina vietata non viene richiesta.
    expect(site.fetchRobots).toHaveBeenCalledTimes(1);
    expect(site.fetchPage).toHaveBeenCalledTimes(4);
    expect(site.fetchPage).not.toHaveBeenCalledWith(vietato.url);
    expect(site.sleep).toHaveBeenCalledTimes(3);

    const products = await storeProducts();
    expect(products.map((p) => [p.name, p.price, p.width, p.depth, p.height, p.category, p.subcategory, p.retailer, p.ownerId])).toEqual([
      ["EKTORP Divano angolare - beige", 649, 190, 95, 83, "Soggiorno", "Divani a due posti", "IKEA", null],
      ["KIVIK Divano a 2 posti - beige", 299, 190, 95, 83, "Soggiorno", "Divani a due posti", "IKEA", null],
    ]);
    expect(products[1].imageUrl).toBe("https://www.ikea.com/it/it/images/products/kivik__1577305_pe1033079_s5.jpg?f=s");
    expect(products[1].url).toBe(kivik.url);
    expect(await page(senzaMisure.url)).toMatchObject({ status: "incomplete", productId: null });
    expect((await page(senzaMisure.url)).note).toMatch(/depth, height/);
    expect(await page(sparito.url)).toMatchObject({ status: "removed" });
    expect(await page(vietato.url)).toMatchObject({ status: "robots" });
  });

  it("non rilegge prima della scadenza; dopo due giorni aggiorna prezzi e toglie i prodotti spariti", async () => {
    const site = fakeSite({
      [kivik.url]: { html: productPage("KIVIK Divano a 2 posti - beige", 279) },
      [ektorp.url]: { html: categoryPage, url: "https://www.ikea.com/it/it/cat/divani-fu003/" },
    });
    clock = new Date("2026-11-10T16:47:00Z");
    expect(await syncStorePages({ pages: [kivik, ektorp, senzaMisure, sparito, vietato], now, ...site })).toMatchObject({ checked: 0 });
    expect(site.fetchPage).not.toHaveBeenCalled();

    clock = new Date("2026-11-12T05:00:00Z");
    const report = await syncStorePages({ pages: [kivik, ektorp, senzaMisure, sparito, vietato], now, ...site });
    expect(report).toMatchObject({ checked: 2, updated: 1, removed: 1, products: 1 });
    const [p] = await storeProducts();
    expect([p.name, p.price, p.priceUpdatedAt.toISOString()]).toEqual(["KIVIK Divano a 2 posti - beige", 279, "2026-11-12T05:00:00.000Z"]);
    expect(await page(ektorp.url)).toMatchObject({ status: "removed", productId: null });
  });

  it("si ferma quando il sito chiede di rallentare e rispetta il numero massimo di pagine", async () => {
    const nuove = [entry("a-1"), entry("a-2"), entry("a-3"), entry("a-4")];
    const site = fakeSite({
      [nuove[0].url]: { html: productPage("A1 Poltrona", 99) },
      [nuove[1].url]: { status: 429 },
      [nuove[2].url]: { html: productPage("A3 Poltrona", 99) },
    });
    const all = [kivik, ektorp, senzaMisure, sparito, vietato, ...nuove];
    const first = await syncStorePages({ pages: all, now, ...site });
    expect(first).toMatchObject({ checked: 2, updated: 1, errors: 1, stoppedBy: "il sito ha chiesto di rallentare (429)" });
    expect(site.fetchPage).toHaveBeenCalledTimes(2);

    const second = await syncStorePages({ pages: all, now, maxPages: 1, ...site });
    expect(second).toMatchObject({ checked: 1, remaining: 1 });
    expect(site.fetchPage).toHaveBeenLastCalledWith(nuove[2].url);
  });

  it("senza robots.txt leggibile non legge nessuna pagina", async () => {
    const site = { ...fakeSite({}), fetchRobots: vi.fn(async () => null) };
    const report = await syncStorePages({ pages: [kivik, entry("b-1")], now, ...site });
    expect(report.checked).toBe(0);
    expect(report.stoppedBy).toMatch(/robots\.txt/);
    expect(site.fetchPage).not.toHaveBeenCalled();
  });

  it("con retryIncomplete rilegge subito le pagine incomplete", async () => {
    const pages = [kivik, senzaMisure];
    const html: Record<string, { html: string }> = { [senzaMisure.url]: { html: productPage("SÖDERHAMN Divano", 499, { width: "198 cm" }) } };
    const site = fakeSite(html);
    await syncStorePages({ pages, now, ...site });
    expect(await page(senzaMisure.url)).toMatchObject({ status: "incomplete" });
    // La pagina ora ha tutte le misure: senza retryIncomplete aspetta la scadenza, con l'opzione viene riletta.
    html[senzaMisure.url] = { html: productPage("SÖDERHAMN Divano", 499) };
    expect(await syncStorePages({ pages, now, ...site })).toMatchObject({ checked: 0 });
    expect(await syncStorePages({ pages, now, retryIncomplete: true, ...site })).toMatchObject({ checked: 1, updated: 1 });
    expect(await page(senzaMisure.url)).toMatchObject({ status: "ok" });
  });

  it("toglie pagine e prodotti usciti dall'elenco", async () => {
    const site = fakeSite({});
    await syncStorePages({ pages: [ektorp], now, ...site });
    expect(await prisma.storePage.count()).toBe(1);
    expect(await storeProducts()).toEqual([]);
    expect(await storeSyncStatus()).toMatchObject({ products: 0, pages: { removed: 1 } });
  });

  it("scarta i prodotti senza prezzo o con dati non validi", () => {
    const meta = extractProductMetadata(productPage("Divano", 0), kivik.url);
    expect(productFromPage(kivik, { ...meta, price: undefined }, clock)).toBeNull();
    expect(productFromPage(kivik, { ...meta, width: -1 }, clock)).toBeNull();
    expect(productFromPage(kivik, meta, clock)).toMatchObject({ id: expect.stringMatching(/^store-/), source: "store", price: 0, shape: "sofa" });
  });
});
