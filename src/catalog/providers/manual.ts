import "server-only";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti personalizzati inseriti a mano. */
export const ManualProvider: CatalogProvider = {
  id: "manual",
  label: "Prodotti personalizzati",
  description: "Prodotti inseriti manualmente con misure e prezzo.",
  list: (ctx) => listStored("manual", ctx),
};
