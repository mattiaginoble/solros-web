import "server-only";
import { prisma } from "@/lib/server/db";
import { rowToProduct } from "@/lib/server/products";
import { DEMO_PRODUCTS } from "../demoData";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";

/** Prodotti generici con prezzi indicativi, sempre disponibili (caricati nel database all'avvio). */
export const DemoProvider: CatalogProvider = {
  id: "demo",
  ...CATALOG_SOURCES.demo,
  async list() {
    try {
      const rows = await prisma.product.findMany({ where: { source: "demo" } });
      return rows.length ? rows.map(rowToProduct) : DEMO_PRODUCTS;
    } catch {
      // Database non disponibile: si usa la copia in memoria.
      return DEMO_PRODUCTS;
    }
  },
};
