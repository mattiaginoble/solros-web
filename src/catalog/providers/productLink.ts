import "server-only";
import type { CatalogProvider } from "../types";
import { listStored } from "./stored";

/** Prodotti aggiunti incollando il link della pagina prodotto di un rivenditore. */
export const ProductLinkProvider: CatalogProvider = {
  id: "link",
  label: "Da link prodotto",
  description: "Prodotti precompilati dai metadati pubblici (JSON-LD, Open Graph) della pagina.",
  list: (ctx) => listStored("link", ctx),
};
