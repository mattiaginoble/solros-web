import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { afterAll, describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { EXAMPLE_HOUSES } from "@/domain/examples";
import { PrismaClient } from "@/generated/prisma/client";
import { MIGRATIONS } from "@/generated/migrations";
import { applyMigrations, seedDatabase, splitStatements } from "@/lib/server/dbSetup";

const dir = mkdtempSync(join(tmpdir(), "configuratore-db-"));
const dbUrl = (name: string) => `file:${join(dir, name)}`;
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const tables = async (url: string) => {
  const c = createClient({ url });
  const res = await c.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  c.close();
  return res.rows.map((r) => String(r.name));
};

describe("preparazione del database", () => {
  it("separa le istruzioni di una migrazione ignorando i commenti", () => {
    const stmts = splitStatements(MIGRATIONS[0].sql);
    expect(stmts.length).toBeGreaterThan(3);
    expect(stmts.every((s) => !s.startsWith("--") && !s.endsWith(";"))).toBe(true);
    expect(stmts.filter((s) => s.startsWith("CREATE TABLE"))).toHaveLength(3);
  });

  it("crea lo schema su un database nuovo e non lo riapplica", async () => {
    const url = dbUrl("nuovo.db");
    const client = createClient({ url });
    expect(await applyMigrations(client)).toEqual(MIGRATIONS.map((m) => m.name));
    expect(await applyMigrations(client)).toEqual([]);
    const rows = (await client.execute(`SELECT migration_name, checksum, applied_steps_count FROM "_prisma_migrations"`)).rows;
    client.close();
    expect(rows.map((r) => [r.migration_name, r.checksum, Number(r.applied_steps_count)])).toEqual(MIGRATIONS.map((m) => [m.name, m.checksum, 1]));
    expect(await tables(url)).toEqual(expect.arrayContaining(["Product", "Project", "User", "_prisma_migrations"]));
  });

  it("regge due avvii contemporanei: la migrazione viene registrata una volta sola", async () => {
    const url = dbUrl("concorrente.db");
    const a = createClient({ url });
    const b = createClient({ url });
    const [ra, rb] = await Promise.all([applyMigrations(a), applyMigrations(b)]);
    expect([...ra, ...rb]).toEqual(MIGRATIONS.map((m) => m.name));
    const count = (await a.execute(`SELECT COUNT(*) AS n FROM "_prisma_migrations"`)).rows[0].n;
    a.close();
    b.close();
    expect(Number(count)).toBe(MIGRATIONS.length);
  });

  it("riconosce le migrazioni già applicate da prisma migrate", async () => {
    const url = dbUrl("prisma.db");
    const client = createClient({ url });
    await applyMigrations(client, []); // crea solo la tabella delle migrazioni
    for (const s of splitStatements(MIGRATIONS[0].sql)) await client.execute(s);
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES ('x', ?, 1, ?, 1, 1)`,
      args: [MIGRATIONS[0].checksum, MIGRATIONS[0].name],
    });
    // Applica solo le migrazioni successive a quelle già registrate.
    expect(await applyMigrations(client)).toEqual(MIGRATIONS.slice(1).map((m) => m.name));
    client.close();
  });

  it("carica catalogo demo e case di esempio una volta sola", async () => {
    const url = dbUrl("seed.db");
    const client = createClient({ url });
    await applyMigrations(client);
    client.close();
    const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
    await seedDatabase(prisma);
    await seedDatabase(prisma);
    expect(await prisma.product.count({ where: { source: "demo" } })).toBe(DEMO_PRODUCTS.length);
    expect(await prisma.project.count({ where: { isExample: true } })).toBe(EXAMPLE_HOUSES.length);
    const sofa = await prisma.product.findUnique({ where: { id: DEMO_PRODUCTS[0].id } });
    expect(sofa?.price).toBe(DEMO_PRODUCTS[0].price);
    await prisma.$disconnect();
  });
});
