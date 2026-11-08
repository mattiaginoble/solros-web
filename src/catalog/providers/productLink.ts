import "server-only";
import { CATALOG_SOURCES } from "../sources";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti aggiunti incollando il link della pagina prodotto di un rivenditore. */
export const ProductLinkProvider: CatalogProvider = {
  id: "link",
  ...CATALOG_SOURCES.link,
  list: (ctx) => listStored("link", ctx),
};
