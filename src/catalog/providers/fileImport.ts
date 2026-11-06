import "server-only";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti importati da file CSV/JSON (cataloghi, feed dei rivenditori). */
export const FileImportProvider: CatalogProvider = {
  id: "import",
  label: "Import da file",
  description: "Cataloghi e feed importati da CSV o JSON con mappatura delle colonne.",
  list: (ctx) => listStored("import", ctx),
};
