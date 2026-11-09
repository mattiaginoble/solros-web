import "server-only";
/**
 * Feed prodotti salvati: download sicuro (anche .gz), import che sostituisce i
 * prodotti del lotto e aggiornamento dei feed più vecchi di un giorno.
 */
import { gunzipSync } from "node:zlib";
import { rowsFromFeedText } from "@/catalog/feedRows";
import { mapRows, type ColumnMapping, type MapOptions } from "@/catalog/importMapping";
import type { Product } from "@/domain/schema";
import { prisma } from "./db";
import { HttpError } from "./http";
import { productToRow } from "./products";
import { assertPublicUrl, guardedGet } from "./safeFetch";

export const FEED_MAX_BYTES = 20 * 1024 * 1024;
const FEED_MAX_UNZIPPED = 80 * 1024 * 1024;
export const FEED_MAX_PRODUCTS = 5000;
const FEED_TIMEOUT_MS = 30_000;
const STALE_MS = 24 * 3600_000;

/** Testo del feed dai byte scaricati, decomprimendo i file gzip. */
export function decodeFeedBytes(bytes: Buffer): string {
  let data = bytes;
  if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
    try {
      data = gunzipSync(data, { maxOutputLength: FEED_MAX_UNZIPPED });
    } catch (err) {
      if (err instanceof RangeError) throw new HttpError(413, "Il feed decompresso è troppo grande");
      throw new HttpError(422, "Il file compresso del feed non è leggibile");
    }
  }
  return data.toString("utf8").replace(/^﻿/, "");
}

const busyUsers = new Set<string>();

/** Scarica un feed (un download alla volta per utente). */
export async function downloadFeed(rawUrl: string, userId: string): Promise<string> {
  if (busyUsers.has(userId)) throw new HttpError(429, "È già in corso il download di un feed: attendi che finisca");
  busyUsers.add(userId);
  try {
    const url = await assertPublicUrl(rawUrl);
    const res = await guardedGet(url, "application/xml,text/xml,text/csv,application/json,application/gzip,*/*", FEED_MAX_BYTES, {
      timeoutMs: FEED_TIMEOUT_MS,
    });
    if (res.status >= 400) throw new HttpError(502, `Il server del feed ha risposto con errore ${res.status}`);
    if (res.truncated) throw new HttpError(413, "Il feed supera i 20 MB: usa un feed filtrato (per categoria o marca)");
    return decodeFeedBytes(res.bytes);
  } finally {
    busyUsers.delete(userId);
  }
}

/** Righe del feed; i formati non riconosciuti diventano errori leggibili. */
export function parseFeed(text: string): Record<string, unknown>[] {
  try {
    return rowsFromFeedText(text);
  } catch (err) {
    throw new HttpError(422, err instanceof Error ? `Feed non leggibile: ${err.message}` : "Feed non leggibile");
  }
}

/**
 * Sostituisce i prodotti di un lotto importato con quelli nuovi: i prodotti
 * spariti dal feed vengono rimossi. Non tocca mai prodotti di altri utenti.
 */
export async function replaceBatch(userId: string, batch: string, products: Product[]): Promise<number> {
  const rows = new Map<string, ReturnType<typeof productToRow>>();
  for (const p of products) {
    const id = `${p.id}-${userId.slice(-6)}`;
    if (!rows.has(id)) rows.set(id, productToRow({ ...p, id, source: "import" }, { ownerId: userId, importBatch: batch }));
  }
  const ids = [...rows.keys()];
  const clash = ids.length ? await prisma.product.findFirst({ where: { id: { in: ids }, NOT: { ownerId: userId } }, select: { name: true } }) : null;
  if (clash) throw new HttpError(409, `«${clash.name}» ha lo stesso identificativo di un prodotto che non è tuo: aggiornamento annullato`);
  const data = [...rows.values()];
  const chunks = Array.from({ length: Math.ceil(data.length / 500) }, (_, i) => data.slice(i * 500, i * 500 + 500));
  await prisma.$transaction([
    prisma.product.deleteMany({ where: { ownerId: userId, source: "import", importBatch: batch } }),
    ...chunks.map((c) => prisma.product.createMany({ data: c })),
  ]);
  return data.length;
}

export interface FeedConfig {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  mapping: string;
  unit: string;
  retailer: string;
  currency: string;
}

export interface FeedRunResult {
  imported: number;
  discarded: number;
  total: number;
  status: string;
}

/** Scarica, converte e importa un feed salvato, registrando l'esito. */
export async function refreshFeed(feed: FeedConfig, download: (url: string, userId: string) => Promise<string> = downloadFeed): Promise<FeedRunResult> {
  try {
    const rows = parseFeed(await download(feed.url, feed.ownerId));
    const opts: MapOptions = {
      unit: (["cm", "mm", "m"].includes(feed.unit) ? feed.unit : "cm") as MapOptions["unit"],
      retailer: feed.retailer,
      currency: feed.currency,
      batch: feed.name,
      priceDate: new Date().toISOString(),
    };
    const { products, errors } = mapRows(rows.slice(0, FEED_MAX_PRODUCTS), JSON.parse(feed.mapping) as ColumnMapping, opts);
    if (!products.length) throw new HttpError(422, `Nessun prodotto valido nel feed (${errors[0]?.message ?? "righe senza dati utilizzabili"})`);
    const imported = await replaceBatch(feed.ownerId, feed.name, products);
    const extra = rows.length > FEED_MAX_PRODUCTS ? `, limitato ai primi ${FEED_MAX_PRODUCTS} di ${rows.length}` : "";
    const status = `${imported} prodotti aggiornati${errors.length ? `, ${errors.length} righe scartate` : ""}${extra}`;
    await prisma.catalogFeed.update({ where: { id: feed.id }, data: { lastRunAt: new Date(), lastStatus: status } });
    return { imported, discarded: errors.length, total: rows.length, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Aggiornamento non riuscito";
    await prisma.catalogFeed.update({ where: { id: feed.id }, data: { lastRunAt: new Date(), lastStatus: `Errore: ${message}` } }).catch(() => {});
    throw err;
  }
}

/**
 * Aggiorna i feed dell'utente più vecchi di un giorno. Ogni feed viene
 * "prenotato" con un aggiornamento condizionale, così più istanze del server
 * non lo scaricano due volte.
 */
export async function refreshStaleFeeds(userId: string, opts: { now?: number; download?: typeof downloadFeed } = {}) {
  const now = opts.now ?? Date.now();
  const stale = { OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(now - STALE_MS) } }] };
  const feeds = await prisma.catalogFeed.findMany({ where: { ownerId: userId, ...stale } });
  for (const feed of feeds) {
    const claimed = await prisma.catalogFeed.updateMany({
      where: { id: feed.id, ...stale },
      data: { lastRunAt: new Date(now), lastStatus: "Aggiornamento in corso" },
    });
    if (claimed.count) await refreshFeed(feed, opts.download).catch(() => {});
  }
}
