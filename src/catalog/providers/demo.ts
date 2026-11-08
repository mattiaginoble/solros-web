import "server-only";
import { prisma } from "@/lib/server/db";
import { productToRow, rowToProduct } from "@/lib/server/products";
import { DEMO_PRODUCTS } from "../demoData";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";

let seeded = false;

/** Inserisce o aggiorna i prodotti demo nel database (idempotente). */
export async function seedDemoProducts() {
  for (const p of DEMO_PRODUCTS) {
    const row = productToRow(p);
    await prisma.product.upsert({ where: { id: p.id }, create: row, update: row });
  }
  seeded = true;
}

/** Prodotti generici con prezzi indicativi, sempre disponibili. */
export const DemoProvider: CatalogProvider = {
  id: "demo",
  ...CATALOG_SOURCES.demo,
  async list() {
    try {
      if (!seeded) {
        const count = await prisma.product.count({ where: { source: "demo" } });
        if (count < DEMO_PRODUCTS.length) await seedDemoProducts();
        seeded = true;
      }
      const rows = await prisma.product.findMany({ where: { source: "demo" } });
      return rows.map(rowToProduct);
    } catch {
      // Database non disponibile: si usa la copia in memoria.
      return DEMO_PRODUCTS;
    }
  },
};
