import "server-only";
import type { ProductSource } from "@/domain/schema";
import { prisma } from "@/lib/server/db";
import { rowToProduct } from "@/lib/server/products";
import type { CatalogContext } from "../types";

/** Prodotti salvati nel database per una sorgente: globali o dell'utente corrente. */
export async function listStored(source: ProductSource, ctx: CatalogContext) {
  const rows = await prisma.product.findMany({
    where: {
      source,
      OR: [{ ownerId: null }, ...(ctx.userId ? [{ ownerId: ctx.userId }] : [])],
    },
  });
  return rows.map(rowToProduct);
}
