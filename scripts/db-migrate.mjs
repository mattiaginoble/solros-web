// Nuova migrazione: prisma migrate dev (con gli argomenti passati, es. --name), client e migrazioni incorporate.
import { execFileSync } from "node:child_process";

const run = (args) => execFileSync("npx", args, { stdio: "inherit" });
run(["prisma", "migrate", "dev", ...process.argv.slice(2)]);
run(["prisma", "generate"]);
execFileSync(process.execPath, ["scripts/embed-migrations.mjs"], { stdio: "inherit" });
