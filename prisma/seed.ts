/**
 * Seed del database: migrazioni mancanti, catalogo demo e case di esempio.
 * Eseguito da `npm run db:seed` (e da `npm run setup`); l'app fa lo stesso da
 * sola al primo avvio, quindi su Vercel non serve lanciarlo.
 */
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseConfig, ensureDatabase } from "../src/lib/server/dbSetup";

const prisma = new PrismaClient({ adapter: new PrismaLibSql(databaseConfig()) });

ensureDatabase(prisma)
  .then(async () => {
    const [products, examples] = await Promise.all([
      prisma.product.count({ where: { source: "demo" } }),
      prisma.project.count({ where: { isExample: true } }),
    ]);
    console.log(`Catalogo demo: ${products} prodotti, case di esempio: ${examples}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
