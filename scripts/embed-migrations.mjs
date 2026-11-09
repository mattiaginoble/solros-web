// Incorpora le migrazioni Prisma in un modulo TypeScript (src/generated/migrations.ts),
// così il server può applicarle da solo all'avvio anche dove non può leggere
// la cartella prisma/ (per esempio le funzioni serverless di Vercel).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "prisma/migrations";
const migrations = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .map((name) => {
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    return { name, checksum: createHash("sha256").update(sql).digest("hex"), sql };
  });

mkdirSync("src/generated", { recursive: true });
writeFileSync(
  "src/generated/migrations.ts",
  `// File generato da scripts/embed-migrations.mjs: non modificarlo a mano.\n` +
    `export const MIGRATIONS: { name: string; checksum: string; sql: string }[] = ${JSON.stringify(migrations, null, 2)};\n`,
);
console.log(`Migrazioni incorporate: ${migrations.length}`);
