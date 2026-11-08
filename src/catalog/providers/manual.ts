import "server-only";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti personalizzati inseriti a mano. */
export const ManualProvider: CatalogProvider = {
  id: "manual",
  ...CATALOG_SOURCES.manual,
  list: (ctx) => listStored("manual", ctx),
};
