import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "configuratore-cron-"));
process.env.DATABASE_URL = `file:${join(dir, "cron.db")}`;
const { GET } = await import("@/app/api/cron/store-sync/route");
const { prisma } = await import("@/lib/server/db");

afterAll(async () => {
  delete process.env.CRON_SECRET;
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const call = (auth?: string) => GET(new Request("https://casa.example.com/api/cron/store-sync?stato=1", { headers: auth ? { authorization: auth } : {} }));

describe("aggiornamento pianificato del catalogo Negozi", () => {
  it("resta chiuso senza CRON_SECRET o con un'intestazione sbagliata", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer qualsiasi")).status).toBe(401);
    process.env.CRON_SECRET = "segreto-di-prova-1234567890";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer segreto-sbagliato-123456")).status).toBe(401);
  });

  it("con il segreto giusto risponde con lo stato, senza leggere pagine", async () => {
    process.env.CRON_SECRET = "segreto-di-prova-1234567890";
    const res = await call("Bearer segreto-di-prova-1234567890");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ products: 0, lastCheckedAt: null });
  });
});
