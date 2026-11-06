import "server-only";
import type { Product as ProductRow } from "@/generated/prisma/client";
import { ProductSchema, type Product, ShapeSchema } from "@/domain/schema";

/** Converte una riga del database nel tipo di dominio Product. */
export function rowToProduct(r: ProductRow): Product {
  let meta: Record<string, unknown> | undefined;
  if (r.meta) {
    try {
      meta = JSON.parse(r.meta);
    } catch {
      meta = undefined;
    }
  }
  const shape = ShapeSchema.safeParse(r.shape);
  return {
    id: r.id,
    source: (["demo", "import", "link", "manual"].includes(r.source) ? r.source : "manual") as Product["source"],
    retailer: r.retailer,
    code: r.code ?? undefined,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory ?? undefined,
    width: r.width,
    depth: r.depth,
    height: r.height,
    price: r.price,
    currency: r.currency,
    color: r.color ?? undefined,
    colorHex: r.colorHex ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    url: r.url ?? undefined,
    mount: (["floor", "wall", "ceiling"].includes(r.mount) ? r.mount : "floor") as Product["mount"],
    elevation: r.elevation ?? undefined,
    clearance: { front: r.clearanceFront, sides: r.clearanceSides },
    modelUrl: r.modelUrl ?? undefined,
    shape: shape.success ? shape.data : "box",
    meta,
    priceUpdatedAt: r.priceUpdatedAt.toISOString(),
  };
}

/** Dati per creare/aggiornare una riga a partire da un Product validato. */
export function productToRow(p: Product, extra: { ownerId?: string | null; importBatch?: string | null } = {}) {
  const v = ProductSchema.parse(p);
  return {
    id: v.id,
    source: v.source,
    retailer: v.retailer,
    code: v.code ?? null,
    name: v.name,
    category: v.category,
    subcategory: v.subcategory ?? null,
    width: v.width,
    depth: v.depth,
    height: v.height,
    price: v.price,
    currency: v.currency,
    color: v.color ?? null,
    colorHex: v.colorHex ?? null,
    imageUrl: v.imageUrl ?? null,
    url: v.url ?? null,
    mount: v.mount,
    elevation: v.elevation ?? null,
    clearanceFront: v.clearance.front,
    clearanceSides: v.clearance.sides,
    modelUrl: v.modelUrl ?? null,
    shape: v.shape ?? null,
    meta: v.meta ? JSON.stringify(v.meta) : null,
    priceUpdatedAt: new Date(v.priceUpdatedAt),
    ownerId: extra.ownerId ?? null,
    importBatch: extra.importBatch ?? null,
  };
}
