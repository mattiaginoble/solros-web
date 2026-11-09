import "server-only";
import { prisma } from "@/lib/server/db";
import { rowToProduct } from "@/lib/server/products";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";

/** Prodotti reali dei negozi, riletti ogni giorno dalle pagine prodotto (vedi storeSync). */
export const StoreProvider: CatalogProvider = {
  id: "store",
  ...CATALOG_SOURCES.store,
  async list() {
    try {
      const rows = await prisma.product.findMany({ where: { source: "store", ownerId: null } });
      return rows.map(rowToProduct);
    } catch {
      return [];
    }
  },
};
