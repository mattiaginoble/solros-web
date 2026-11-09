import "server-only";
/**
 * Preparazione del database all'avvio: applica le migrazioni mancanti e carica
 * catalogo demo e case di esempio se non ci sono. Così un database nuovo (un
 * file locale o Turso su Vercel) funziona senza comandi manuali.
 */
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { DEMO_PRICE_DATE, DEMO_PRODUCTS } from "@/catalog/demoData";
import { EXAMPLE_HOUSES } from "@/domain/examples";
import type { PrismaClient } from "@/generated/prisma/client";
import { MIGRATIONS } from "@/generated/migrations";
import { HttpError } from "./http";
import { productToRow } from "./products";

/** Database: file SQLite locale oppure Turso (libSQL in cloud), con le variabili dell'integrazione Vercel. */
export function databaseConfig(): { url: string; authToken?: string } {
  return {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./prisma/dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined,
  };
}

/** Istruzioni SQL di una migrazione Prisma, senza commenti. */
export function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Stessa tabella di `prisma migrate`, così i due meccanismi restano compatibili.
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

/**
 * Applica le migrazioni mancanti. Ognuna gira in una transazione di scrittura
 * insieme alla sua registrazione: se un'altra istanza la applica nello stesso
 * momento, la seconda fallisce senza effetti e la trova già registrata.
 */
export async function applyMigrations(client: Client, migrations = MIGRATIONS): Promise<string[]> {
  await client.execute(MIGRATIONS_TABLE);
  const appliedNames = async () => {
    const res = await client.execute(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    return new Set(res.rows.map((r) => String(r.migration_name)));
  };
  let applied = await appliedNames();
  const done: string[] = [];
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    const now = Date.now();
    try {
      await client.batch(
        [
          ...splitStatements(m.sql),
          {
            sql: `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, ?, 1)`,
            args: [randomUUID(), m.checksum, now, m.name, now],
          },
        ],
        "write",
      );
      done.push(m.name);
    } catch (err) {
      applied = await appliedNames();
      if (!applied.has(m.name)) throw err;
    }
  }
  return done;
}

/** Carica o aggiorna catalogo demo e case di esempio quando mancano o sono cambiati. */
export async function seedDatabase(prisma: PrismaClient) {
  const demoCount = await prisma.product.count({ where: { source: "demo", ownerId: null } });
  const latest = await prisma.product.findFirst({ where: { source: "demo" }, orderBy: { priceUpdatedAt: "desc" }, select: { priceUpdatedAt: true } });
  if (demoCount < DEMO_PRODUCTS.length || latest?.priceUpdatedAt.toISOString() !== DEMO_PRICE_DATE) {
    await prisma.$transaction(
      DEMO_PRODUCTS.map((p) => {
        const row = productToRow(p);
        return prisma.product.upsert({ where: { id: p.id }, create: row, update: row });
      }),
    );
  }
  const examples = await prisma.project.count({ where: { isExample: true } });
  if (examples < EXAMPLE_HOUSES.length) {
    await prisma.$transaction(
      EXAMPLE_HOUSES.map((ex) => {
        const house = ex.build();
        const data = { name: house.name, data: JSON.stringify(house), isExample: true };
        return prisma.project.upsert({ where: { id: ex.id }, create: { id: ex.id, ...data }, update: data });
      }),
    );
  }
}

/** Migrazioni e dati iniziali. */
export async function ensureDatabase(prisma: PrismaClient) {
  const config = databaseConfig();
  if (process.env.VERCEL && config.url.startsWith("file:")) {
    // Su Vercel il disco non è persistente: serve un database Turso.
    throw new HttpError(503, "Database non configurato: collega Turso al progetto Vercel (TURSO_DATABASE_URL e TURSO_AUTH_TOKEN)");
  }
  const client = createClient(config);
  try {
    await applyMigrations(client);
  } finally {
    client.close();
  }
  await seedDatabase(prisma);
}
