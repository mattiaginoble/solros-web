import "server-only";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseConfig, ensureDatabase } from "./dbSetup";

/**
 * Client Prisma su libSQL (file locale o Turso). La prima query di ogni
 * processo attende la preparazione del database (migrazioni e dati iniziali);
 * se fallisce, viene ritentata alla richiesta successiva.
 */
function createPrisma() {
  const base = new PrismaClient({ adapter: new PrismaLibSql(databaseConfig()) });
  let ready: Promise<void> | null = null;
  const whenReady = () =>
    (ready ??= ensureDatabase(base).catch((err) => {
      ready = null;
      throw err;
    }));
  return base.$extends({
    name: "preparazione-database",
    query: {
      async $allOperations({ args, query }) {
        await whenReady();
        return query(args);
      },
    },
  });
}

type Db = ReturnType<typeof createPrisma>;
const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
