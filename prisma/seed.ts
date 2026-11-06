/**
 * Seed del database: catalogo demo e case di esempio.
 * Eseguito da `npm run db:seed` (e da `npm run setup`).
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { DEMO_PRODUCTS } from "../src/catalog/demoData";
import { EXAMPLE_HOUSES } from "../src/domain/examples";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  for (const p of DEMO_PRODUCTS) {
    const row = {
      id: p.id,
      source: p.source,
      retailer: p.retailer,
      code: p.code ?? null,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory ?? null,
      width: p.width,
      depth: p.depth,
      height: p.height,
      price: p.price,
      currency: p.currency,
      color: p.color ?? null,
      colorHex: p.colorHex ?? null,
      imageUrl: p.imageUrl ?? null,
      url: p.url ?? null,
      mount: p.mount,
      elevation: p.elevation ?? null,
      clearanceFront: p.clearance.front,
      clearanceSides: p.clearance.sides,
      modelUrl: p.modelUrl ?? null,
      shape: p.shape ?? null,
      meta: p.meta ? JSON.stringify(p.meta) : null,
      priceUpdatedAt: new Date(p.priceUpdatedAt),
    };
    await prisma.product.upsert({ where: { id: p.id }, create: row, update: row });
  }
  console.log(`Catalogo demo: ${DEMO_PRODUCTS.length} prodotti`);

  for (const ex of EXAMPLE_HOUSES) {
    const house = ex.build();
    await prisma.project.upsert({
      where: { id: ex.id },
      create: { id: ex.id, name: house.name, data: JSON.stringify(house), isExample: true },
      update: { name: house.name, data: JSON.stringify(house), isExample: true },
    });
  }
  console.log(`Case di esempio: ${EXAMPLE_HOUSES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
