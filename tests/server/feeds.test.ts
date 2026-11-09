import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rowsFromFeedText } from "@/catalog/feedRows";
import { autoDetectMapping } from "@/catalog/importMapping";

const dir = mkdtempSync(join(tmpdir(), "configuratore-feed-"));
process.env.DATABASE_URL = `file:${join(dir, "feeds.db")}`;

const { prisma } = await import("@/lib/server/db");
const { decodeFeedBytes, refreshFeed, refreshStaleFeeds } = await import("@/lib/server/feeds");

const feedXml = (items: [string, string, number][]) => `<rss xmlns:g="http://base.google.com/ns/1.0"><channel>${items
  .map(([id, title, price]) => `<item><g:id>${id}</g:id><g:title>${title}</g:title><g:price>${price} EUR</g:price><g:size>100x50x80 cm</g:size></item>`)
  .join("")}</channel></rss>`;
const V1 = feedXml([["A", "Credenza Alba", 300], ["B", "Mobile Bruma", 150]]);
const V2 = feedXml([["A", "Credenza Alba", 279]]);
const mapping = JSON.stringify(autoDetectMapping(Object.keys(rowsFromFeedText(V1)[0])));

let userId = "";
let feedId = "";
beforeAll(async () => {
  userId = (await prisma.user.create({ data: {} })).id;
  feedId = (await prisma.catalogFeed.create({ data: { ownerId: userId, name: "Negozio", url: "https://feed.example.com/f.xml", mapping, retailer: "Negozio" } })).id;
});
afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});
const feed = () => prisma.catalogFeed.findUniqueOrThrow({ where: { id: feedId } });
const batchProducts = () => prisma.product.findMany({ where: { ownerId: userId, importBatch: "Negozio" }, orderBy: { name: "asc" } });

describe("feed salvati", () => {
  it("legge feed in chiaro, compressi gzip e con BOM", () => {
    expect(decodeFeedBytes(Buffer.from("﻿nome;prezzo"))).toBe("nome;prezzo");
    expect(decodeFeedBytes(gzipSync(Buffer.from(V1)))).toBe(V1);
    expect(rowsFromFeedText("nome;prezzo\nSedia;20")).toEqual([{ nome: "Sedia", prezzo: "20" }]);
    expect(rowsFromFeedText('[{"name":"Sedia"}]')).toEqual([{ name: "Sedia" }]);
  });

  it("importa il feed e all'aggiornamento sostituisce prezzi e prodotti spariti", async () => {
    const first = await refreshFeed(await feed(), async () => V1);
    expect(first).toMatchObject({ imported: 2, discarded: 0, total: 2 });
    expect((await batchProducts()).map((p) => [p.name, p.price, p.width])).toEqual([["Credenza Alba", 300, 100], ["Mobile Bruma", 150, 100]]);
    const second = await refreshFeed(await feed(), async () => V2);
    expect(second.imported).toBe(1);
    expect((await batchProducts()).map((p) => [p.name, p.price])).toEqual([["Credenza Alba", 279]]);
    expect((await feed()).lastStatus).toBe("1 prodotti aggiornati");
  });

  it("registra gli errori senza toccare i prodotti", async () => {
    await expect(refreshFeed(await feed(), async () => "<rss><channel></channel></rss>")).rejects.toThrow(/Feed non leggibile/);
    expect((await feed()).lastStatus).toMatch(/^Errore: Feed non leggibile/);
    expect(await batchProducts()).toHaveLength(1);
  });

  it("aggiorna da solo solo i feed più vecchi di un giorno, una volta anche con richieste contemporanee", async () => {
    const download = vi.fn(async () => V1);
    await prisma.catalogFeed.update({ where: { id: feedId }, data: { lastRunAt: new Date(Date.now() - 3 * 3600_000) } });
    await refreshStaleFeeds(userId, { download });
    expect(download).not.toHaveBeenCalled();
    await prisma.catalogFeed.update({ where: { id: feedId }, data: { lastRunAt: new Date(Date.now() - 25 * 3600_000) } });
    await Promise.all([refreshStaleFeeds(userId, { download }), refreshStaleFeeds(userId, { download })]);
    expect(download).toHaveBeenCalledTimes(1);
    expect(await batchProducts()).toHaveLength(2);
  });

  it("non sovrascrive prodotti di altri utenti con lo stesso identificativo", async () => {
    const other = await prisma.user.create({ data: {} });
    const mine = (await batchProducts())[0];
    await prisma.product.update({ where: { id: mine.id }, data: { ownerId: other.id } });
    await expect(refreshFeed(await feed(), async () => V1)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: mine.id } })).ownerId).toBe(other.id);
  });
});
