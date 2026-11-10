import "server-only";
import { extractProductMetadata, type LinkMetadata } from "@/catalog/linkMetadata";
import { shortHash } from "@/catalog/normalize";
import { STORE_PAGES, type StorePageEntry } from "@/catalog/store/pages";
import { ProductSchema, type Product } from "@/domain/schema";
import type { StorePage } from "@/generated/prisma/client";
import { prisma } from "./db";
import { productToRow } from "./products";
import { assertPublicUrl, guardedGet, parseRobots, robotsAllows } from "./safeFetch";

/**
 * Catalogo «Negozi»: il server rilegge una per volta le pagine prodotto
 * dell'elenco (src/catalog/store), con una pausa fra le richieste e solo dove
 * robots.txt lo consente, e tiene aggiornati prezzo, misure e foto.
 */

export const STORE_USER_AGENT = "ConfiguratoreCasa/1.0 (aggiornamento dei prezzi di un catalogo personale, una pagina ogni pochi secondi)";

const DAY = 86_400_000;
/** Dopo quanto si rilegge una pagina, secondo l'esito dell'ultima lettura. */
const RECHECK_MS: Record<string, number> = {
  pending: 0,
  ok: 3 * DAY,
  error: DAY,
  robots: 7 * DAY,
  incomplete: 14 * DAY,
  removed: 30 * DAY,
};
const PAGE_BYTES = 4 * 1024 * 1024;
/** Crawl-delay oltre questo valore non viene seguito: il sito viene saltato. */
const MAX_CRAWL_DELAY_S = 30;

export interface FetchedPage {
  status: number;
  url: string;
  html: string;
}

export interface SyncOptions {
  /** Pagine dell'elenco (predefinito: STORE_PAGES). */
  pages?: StorePageEntry[];
  maxPages?: number;
  /** Tempo massimo per le letture, in ms: la funzione su Vercel ha un limite di durata. */
  timeBudgetMs?: number;
  /** Pausa fra due richieste allo stesso sito. */
  delayMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  fetchPage?: (url: string) => Promise<FetchedPage>;
  /** Testo di robots.txt, "" se il sito non lo ha, null se non è leggibile. */
  fetchRobots?: (origin: string) => Promise<string | null>;
  /** Rilegge subito le pagine con dati incompleti (dopo un miglioramento della lettura). */
  retryIncomplete?: boolean;
}

export interface SyncReport {
  checked: number;
  updated: number;
  incomplete: number;
  removed: number;
  errors: number;
  /** Pagine ancora da leggere dopo questa esecuzione. */
  remaining: number;
  products: number;
  stoppedBy?: string;
}

async function fetchPage(url: string): Promise<FetchedPage> {
  const res = await guardedGet(await assertPublicUrl(url), "text/html,application/xhtml+xml", PAGE_BYTES, { userAgent: STORE_USER_AGENT, timeoutMs: 20_000 });
  return { status: res.status, url: res.url.toString(), html: res.body };
}

async function fetchRobots(origin: string): Promise<string | null> {
  try {
    const res = await guardedGet(new URL("/robots.txt", origin), "text/plain", 512 * 1024, { userAgent: STORE_USER_AGENT });
    if (res.status === 404 || res.status === 410) return "";
    if (res.status === 401 || res.status === 403) return "User-agent: *\nDisallow: /";
    return res.status >= 200 && res.status < 300 ? res.body : null;
  } catch {
    return null;
  }
}

const storeProductId = (e: Pick<StorePageEntry, "retailer" | "url">) => `store-${shortHash(`${e.retailer}|${e.url}`)}`;

/** Foto in formato piccolo per le miniature (servizio immagini di IKEA). */
function thumbnail(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  try {
    const u = new URL(imageUrl);
    if (!u.hostname.endsWith("ikea.com")) return imageUrl;
    u.search = "?f=s";
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Prodotto dalla pagina letta, se ci sono nome, prezzo e le tre misure. */
export function productFromPage(entry: StorePageEntry, meta: LinkMetadata, at: Date): Product | null {
  if (!meta.name || meta.price === undefined || !meta.width || !meta.depth || !meta.height) return null;
  const pageCategory = meta.found.some((f) => f.startsWith("category (")) && meta.category && meta.category.length <= 60 ? meta.category : undefined;
  const parsed = ProductSchema.safeParse({
    id: storeProductId(entry),
    source: "store",
    retailer: entry.retailer,
    code: meta.code,
    name: meta.name.slice(0, 200),
    category: entry.category,
    subcategory: pageCategory ?? entry.subcategory,
    width: Math.round(meta.width * 10) / 10,
    depth: Math.round(meta.depth * 10) / 10,
    height: Math.round(meta.height * 10) / 10,
    price: Math.round(meta.price * 100) / 100,
    currency: meta.currency ?? "EUR",
    color: meta.color?.slice(0, 60),
    imageUrl: thumbnail(meta.imageUrl),
    url: entry.url,
    mount: meta.mount,
    shape: meta.shape,
    priceUpdatedAt: at.toISOString(),
  });
  return parsed.success ? parsed.data : null;
}

const missing = (meta: LinkMetadata) =>
  (["name", "price", "width", "depth", "height"] as const).filter((k) => meta[k] === undefined || meta[k] === 0).join(", ");

/** Allinea le righe StorePage all'elenco: aggiunge le nuove pagine, toglie quelle uscite e i loro prodotti. */
async function reconcile(entries: StorePageEntry[]): Promise<StorePage[]> {
  const wanted = new Map(entries.map((e) => [e.url, e]));
  let rows = await prisma.storePage.findMany();
  const known = new Set(rows.map((r) => r.url));
  const added = entries.filter((e) => !known.has(e.url));
  if (added.length) {
    await prisma.storePage.createMany({ data: added.map((e) => ({ url: e.url, retailer: e.retailer, category: e.category, subcategory: e.subcategory })) });
  }
  const gone = rows.filter((r) => !wanted.has(r.url)).map((r) => r.url);
  if (gone.length) await prisma.storePage.deleteMany({ where: { url: { in: gone } } });
  for (const r of rows) {
    const e = wanted.get(r.url);
    if (e && (e.category !== r.category || e.subcategory !== r.subcategory || e.retailer !== r.retailer)) {
      await prisma.storePage.update({ where: { url: r.url }, data: { category: e.category, subcategory: e.subcategory, retailer: e.retailer } });
    }
  }
  if (added.length || gone.length) rows = await prisma.storePage.findMany();
  // Prodotti del catalogo «Negozi» senza più una pagina nell'elenco.
  const keep = rows.map((r) => r.productId).filter((id): id is string => !!id);
  await prisma.product.deleteMany({ where: { source: "store", ownerId: null, id: { notIn: keep } } });
  return rows;
}

const isDue = (r: StorePage, t: number) => !r.lastCheckedAt || t - r.lastCheckedAt.getTime() >= (RECHECK_MS[r.status] ?? DAY);

/** Rilegge le pagine in scadenza, dalla meno recente, entro i limiti indicati. */
export async function syncStorePages(opts: SyncOptions = {}): Promise<SyncReport> {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const getPage = opts.fetchPage ?? fetchPage;
  const getRobots = opts.fetchRobots ?? fetchRobots;
  const maxPages = opts.maxPages ?? 100;
  const budget = opts.timeBudgetMs ?? 240_000;
  const delay = opts.delayMs ?? 2_000;
  const started = Date.now();
  const entries = new Map((opts.pages ?? STORE_PAGES).map((e) => [e.url, e]));

  let rows = await reconcile([...entries.values()]);
  if (opts.retryIncomplete) {
    const { count } = await prisma.storePage.updateMany({ where: { status: "incomplete" }, data: { lastCheckedAt: null } });
    if (count) rows = await prisma.storePage.findMany();
  }
  const due = rows.filter((r) => isDue(r, now().getTime())).sort((a, b) => (a.lastCheckedAt?.getTime() ?? 0) - (b.lastCheckedAt?.getTime() ?? 0));
  const report: SyncReport = { checked: 0, updated: 0, incomplete: 0, removed: 0, errors: 0, remaining: due.length, products: 0 };
  const robots = new Map<string, ReturnType<typeof parseRobots> | null>();
  // Ultima richiesta per sito: la pausa vale per ciascun negozio.
  const lastRequest = new Map<string, number>();

  const save = (url: string, data: { status: string; note?: string | null; productId?: string | null }) =>
    prisma.storePage.update({ where: { url }, data: { ...data, note: data.note?.slice(0, 300) ?? null } });
  const dropProduct = async (row: StorePage) => {
    if (row.productId) await prisma.product.deleteMany({ where: { id: row.productId, source: "store" } });
  };

  for (const row of due) {
    if (report.checked >= maxPages) break;
    if (Date.now() - started > budget) {
      report.stoppedBy = "tempo massimo dell'esecuzione";
      break;
    }
    const entry = entries.get(row.url)!;
    const url = new URL(row.url);
    if (!robots.has(url.origin)) {
      const txt = await getRobots(url.origin);
      robots.set(url.origin, txt === null ? null : parseRobots(txt));
    }
    const rules = robots.get(url.origin);
    if (!rules) {
      report.stoppedBy = `robots.txt di ${url.hostname} non leggibile: nessuna pagina letta`;
      continue;
    }
    if ((rules.crawlDelay ?? 0) > MAX_CRAWL_DELAY_S) {
      report.stoppedBy = `${url.hostname} chiede più di ${MAX_CRAWL_DELAY_S} secondi fra due richieste: sito saltato`;
      continue;
    }
    // Una sola esecuzione per pagina anche con richieste contemporanee.
    const at = now();
    const claim = await prisma.storePage.updateMany({ where: { url: row.url, lastCheckedAt: row.lastCheckedAt }, data: { lastCheckedAt: at } });
    if (!claim.count) continue;
    report.checked++;
    report.remaining--;

    if (!robotsAllows(rules, url.pathname + url.search)) {
      await dropProduct(row);
      await save(row.url, { status: "robots", note: "Pagina esclusa da robots.txt", productId: null });
      report.removed++;
      continue;
    }

    const gap = Math.max(delay, (rules.crawlDelay ?? 0) * 1000);
    const last = lastRequest.get(url.origin);
    const wait = last === undefined ? 0 : last + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest.set(url.origin, Date.now());
    let page: FetchedPage;
    try {
      page = await getPage(row.url);
    } catch (err) {
      await save(row.url, { status: "error", note: err instanceof Error ? err.message : "Lettura non riuscita", productId: row.productId });
      report.errors++;
      continue;
    }
    if (page.status === 429 || page.status === 503) {
      // Il sito chiede di rallentare: ci si ferma fino alla prossima esecuzione.
      await save(row.url, { status: "error", note: `Il sito ha risposto ${page.status}`, productId: row.productId });
      report.errors++;
      report.stoppedBy = `il sito ha chiesto di rallentare (${page.status})`;
      break;
    }
    if (page.status === 404 || page.status === 410) {
      await dropProduct(row);
      await save(row.url, { status: "removed", note: `Pagina non più disponibile (${page.status})`, productId: null });
      report.removed++;
      continue;
    }
    if (page.status >= 400) {
      await save(row.url, { status: "error", note: `Il sito ha risposto ${page.status}`, productId: row.productId });
      report.errors++;
      continue;
    }
    const meta = extractProductMetadata(page.html, page.url);
    if (!meta.isProduct) {
      // Prodotto tolto dal catalogo: la pagina rimanda a una categoria.
      await dropProduct(row);
      await save(row.url, { status: "removed", note: `Non è più una pagina prodotto (${page.url})`, productId: null });
      report.removed++;
      continue;
    }
    const product = productFromPage(entry, meta, at);
    if (!product) {
      // Dati incompleti: il prodotto già salvato resta, con la data del suo prezzo.
      await save(row.url, { status: "incomplete", note: `Mancano: ${missing(meta) || "dati non validi"}`, productId: row.productId });
      report.incomplete++;
      continue;
    }
    const data = productToRow(product, { ownerId: null, importBatch: null });
    await prisma.product.upsert({ where: { id: product.id }, create: data, update: data });
    await save(row.url, { status: "ok", note: null, productId: product.id });
    report.updated++;
  }
  report.products = await prisma.product.count({ where: { source: "store", ownerId: null } });
  return report;
}

/** Stato del catalogo «Negozi» per la pagina di diagnosi. */
export async function storeSyncStatus() {
  const rows = await prisma.storePage.groupBy({ by: ["status"], _count: { _all: true } });
  const last = await prisma.storePage.findFirst({ where: { lastCheckedAt: { not: null } }, orderBy: { lastCheckedAt: "desc" }, select: { lastCheckedAt: true } });
  // Pagine non andate a buon fine, con il motivo: servono a migliorare la lettura.
  const problems = await prisma.storePage.findMany({
    where: { status: { in: ["incomplete", "error", "removed", "robots"] } },
    select: { url: true, status: true, note: true, subcategory: true },
    orderBy: { url: "asc" },
    take: 100,
  });
  return {
    pages: Object.fromEntries(rows.map((r) => [r.status, r._count._all])),
    products: await prisma.product.count({ where: { source: "store", ownerId: null } }),
    lastCheckedAt: last?.lastCheckedAt?.toISOString() ?? null,
    problems,
  };
}
