import "server-only";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti importati da file CSV/JSON (cataloghi, feed dei rivenditori). */
export const FileImportProvider: CatalogProvider = {
  id: "import",
  ...CATALOG_SOURCES.import,
  list: (ctx) => listStored("import", ctx),
};
