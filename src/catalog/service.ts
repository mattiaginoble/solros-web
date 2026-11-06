import "server-only";
import { searchProducts } from "./filter";
import { DemoProvider } from "./providers/demo";
import { FileImportProvider } from "./providers/fileImport";
import { ManualProvider } from "./providers/manual";
import { ProductLinkProvider } from "./providers/productLink";
import type { CatalogContext, CatalogProvider, CatalogQuery } from "./types";

/**
 * Registro dei provider attivi. Per aggiungere una nuova sorgente basta
 * implementare CatalogProvider e inserirla qui (vedi README).
 */
export const CATALOG_PROVIDERS: CatalogProvider[] = [DemoProvider, FileImportProvider, ProductLinkProvider, ManualProvider];

export async function listAllProducts(ctx: CatalogContext, providers = CATALOG_PROVIDERS) {
  const lists = await Promise.all(providers.map((p) => p.list(ctx).catch(() => [])));
  return lists.flat();
}

export async function searchCatalog(query: CatalogQuery, ctx: CatalogContext) {
  const providers = query.sources?.length ? CATALOG_PROVIDERS.filter((p) => query.sources!.includes(p.id)) : CATALOG_PROVIDERS;
  // Le faccette delle sorgenti considerano tutte le sorgenti.
  const all = await listAllProducts(ctx);
  const result = searchProducts(all, query);
  return {
    ...result,
    providers: CATALOG_PROVIDERS.map((p) => ({ id: p.id, label: p.label, description: p.description, active: providers.includes(p) })),
  };
}

export async function getProduct(id: string, ctx: CatalogContext) {
  const all = await listAllProducts(ctx);
  return all.find((p) => p.id === id) ?? null;
}
