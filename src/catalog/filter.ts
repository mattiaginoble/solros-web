/** Ricerca, filtri e faccette del catalogo: funzioni pure, usate dal server e nei test. */
import type { Product } from "@/domain/schema";
import type { CatalogFacets, CatalogQuery, CatalogResult, FacetValue } from "./types";

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

const COLOR_RULES: [string, RegExp][] = [
  ["Legno", /rovere|noce|faggio|legno|teak|frassino|ciliegio|cognac/],
  ["Metallo", /inox|acciaio|ottone|cromo|oro|rame|metallo|alluminio/],
  ["Bianco", /bianc|ceramica|ecru|avorio|panna/],
  ["Nero", /nero|antracite|grafite/],
  ["Grigio", /grigi|tortora|cemento|perla|seta|melange/],
  ["Beige", /beige|sabbia|crema|naturale|corda/],
  ["Blu", /blu|azzurr|navy|notte/],
  ["Verde", /verde|salvia|oliva/],
  ["Rosso e rosa", /ross|rosa|bordeaux|terracotta/],
  ["Giallo", /giall|senape|ocra/],
];

function hueFamily(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.12) return l > 0.85 ? "Bianco" : l < 0.2 ? "Nero" : "Grigio";
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 20 || h >= 330) return "Rosso e rosa";
  if (h < 45) return l < 0.55 ? "Legno" : "Beige";
  if (h < 70) return "Giallo";
  if (h < 170) return "Verde";
  if (h < 260) return "Blu";
  return "Rosso e rosa";
}

/** Famiglia di colore del prodotto, dal nome del colore o in mancanza dal valore esadecimale. */
export function colorFamily(p: Pick<Product, "color" | "colorHex">): string {
  const name = p.color ? normalizeText(p.color) : "";
  for (const [family, re] of COLOR_RULES) if (re.test(name)) return family;
  if (p.colorHex) return hueFamily(p.colorHex) ?? "Altro";
  return "Altro";
}

function searchable(p: Product) {
  return normalizeText([p.name, p.category, p.subcategory, p.retailer, p.color, p.code].filter(Boolean).join(" "));
}

/** Punteggio di pertinenza: 0 = non corrisponde. Tutte le parole devono comparire. */
export function scoreProduct(p: Product, text: string): number {
  const tokens = normalizeText(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return 1;
  const hay = searchable(p);
  const name = normalizeText(p.name);
  let score = 0;
  for (const t of tokens) {
    if (!hay.includes(t)) return 0;
    score += 1;
    if (name.startsWith(t)) score += 3;
    else if (name.split(" ").some((w) => w.startsWith(t))) score += 2;
    if (p.subcategory && normalizeText(p.subcategory).includes(t)) score += 1;
  }
  return score;
}

export function matchesFilters(p: Product, q: CatalogQuery, ignore: Partial<Record<keyof CatalogQuery, boolean>> = {}) {
  if (!ignore.retailers && q.retailers?.length && !q.retailers.includes(p.retailer)) return false;
  if (!ignore.category && q.category && p.category !== q.category) return false;
  if (!ignore.subcategory && q.subcategory && p.subcategory !== q.subcategory) return false;
  if (q.priceMin !== undefined && p.price < q.priceMin) return false;
  if (q.priceMax !== undefined && p.price > q.priceMax) return false;
  if (q.maxWidth !== undefined && p.width > q.maxWidth) return false;
  if (q.maxDepth !== undefined && p.depth > q.maxDepth) return false;
  if (q.maxHeight !== undefined && p.height > q.maxHeight) return false;
  if (!ignore.color && q.color && colorFamily(p) !== q.color) return false;
  if (!ignore.sources && q.sources?.length && !q.sources.includes(p.source)) return false;
  if (q.mount && p.mount !== q.mount) return false;
  return true;
}

function countBy(list: Product[], key: (p: Product) => string | undefined): FacetValue[] {
  const m = new Map<string, number>();
  for (const p of list) {
    const k = key(p);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "it"));
}

export function computeFacets(all: Product[], q: CatalogQuery): CatalogFacets {
  const textOk = (p: Product) => !q.text || scoreProduct(p, q.text) > 0;
  // Ogni faccetta ignora il proprio filtro, così l'utente vede le alternative.
  const forRetailers = all.filter((p) => textOk(p) && matchesFilters(p, q, { retailers: true }));
  const forCategories = all.filter((p) => textOk(p) && matchesFilters(p, q, { category: true, subcategory: true }));
  const forColors = all.filter((p) => textOk(p) && matchesFilters(p, q, { color: true }));
  const forSources = all.filter((p) => textOk(p) && matchesFilters(p, q, { sources: true }));
  const categories = countBy(forCategories, (p) => p.category).map((c) => ({
    ...c,
    subcategories: countBy(
      forCategories.filter((p) => p.category === c.value),
      (p) => p.subcategory,
    ),
  }));
  const prices = all.map((p) => p.price);
  return {
    retailers: countBy(forRetailers, (p) => p.retailer),
    categories,
    colors: countBy(forColors, colorFamily),
    sources: countBy(forSources, (p) => p.source),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

export function searchProducts(all: Product[], q: CatalogQuery): CatalogResult {
  const scored = all
    .map((p) => ({ p, s: q.text ? scoreProduct(p, q.text) : 1 }))
    .filter((x) => x.s > 0 && matchesFilters(x.p, q));
  const sort = q.sort ?? "relevance";
  scored.sort((a, b) => {
    if (sort === "price-asc") return a.p.price - b.p.price;
    if (sort === "price-desc") return b.p.price - a.p.price;
    if (sort === "name") return a.p.name.localeCompare(b.p.name, "it");
    return b.s - a.s || a.p.category.localeCompare(b.p.category, "it") || a.p.price - b.p.price;
  });
  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(200, Math.max(1, q.limit ?? 60));
  return {
    items: scored.slice(offset, offset + limit).map((x) => x.p),
    total: scored.length,
    facets: computeFacets(all, q),
  };
}
