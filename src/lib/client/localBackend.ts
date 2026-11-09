/**
 * Archivio nel browser per la versione statica (GitHub Pages): stesse
 * operazioni delle API del server, con progetti e prodotti salvati in
 * IndexedDB. Case di esempio e catalogo demo arrivano dal codice.
 */
import { searchProducts } from "@/catalog/filter";
import { CATALOG_SOURCES, SOURCE_ORDER } from "@/catalog/sources";
import type { CatalogQuery } from "@/catalog/types";
import { cloneHouseWithNewIds, createHouse, uid } from "@/domain/factory";
import { ProductSchema, safeParseHouse, type House, type Product, type ProductSource } from "@/domain/schema";
import { houseStats, housePreview } from "@/domain/summary";
import { ApiError, type Backend, type CatalogSearchParams, type ImportBatch, type ProjectFull, type ProjectSummary } from "./apiTypes";
import { idb, type StoreName } from "./idb";

interface StoredProject {
  id: string;
  name: string;
  data: House;
  createdAt: string;
  updatedAt: string;
}

interface StoredProduct {
  id: string;
  product: Product;
  importBatch?: string;
  updatedAt: string;
}

const MAX_IMPORT = 5000;
/** Sorgenti disponibili senza server (niente prodotti da link né catalogo dei negozi). */
const STATIC_SOURCES = SOURCE_ORDER.filter((s) => s !== "link" && s !== "store");

function unavailable(what: string): never {
  throw new ApiError(501, `${what} non è disponibile nella versione statica: avvia l'app con il server per usarla`);
}

/** Traduce gli errori di IndexedDB in messaggi per l'utente. */
async function storage<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new ApiError(507, "Spazio del browser esaurito: elimina progetti o cataloghi che non usi");
    }
    throw new ApiError(500, "Il browser non permette di salvare i dati (archivio locale non disponibile)");
  }
}

const all = <T>(store: StoreName) => storage(() => idb.all<T>(store));
const get = <T>(store: StoreName, id: string) => storage(() => idb.get<T>(store, id));
const putMany = (store: StoreName, values: unknown[]) => storage(() => idb.putMany(store, values));
const deleteMany = (store: StoreName, ids: string[]) => storage(() => idb.deleteMany(store, ids));

function validHouse(input: unknown): House {
  const parsed = safeParseHouse(input);
  if (!parsed.success) throw new ApiError(422, "Documento casa non valido");
  return parsed.data;
}

function summary(p: { id: string; name: string; data: House; createdAt: string; updatedAt: string }, isExample: boolean): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isExample,
    shared: false,
    stats: houseStats(p.data),
    preview: housePreview(p.data),
  };
}

const full = (p: StoredProject, isExample: boolean): ProjectFull => ({ ...summary(p, isExample), readOnly: isExample, shareToken: null, data: p.data });

/** Le case di esempio, costruite al primo uso (il modulo viene caricato solo se serve). */
let examplesCache: StoredProject[] | null = null;
async function examples(): Promise<StoredProject[]> {
  if (!examplesCache) {
    const { EXAMPLE_HOUSES } = await import("@/domain/examples");
    const date = new Date(0).toISOString();
    examplesCache = EXAMPLE_HOUSES.map((ex) => {
      const data = ex.build();
      return { id: ex.id, name: data.name, data, createdAt: date, updatedAt: date };
    });
  }
  return examplesCache;
}

async function demoProducts(): Promise<Product[]> {
  return (await import("@/catalog/demoData")).DEMO_PRODUCTS;
}

async function findProject(id: string): Promise<{ project: StoredProject; isExample: boolean }> {
  const own = await get<StoredProject>("projects", id);
  if (own) return { project: own, isExample: false };
  const ex = (await examples()).find((e) => e.id === id);
  if (ex) return { project: ex, isExample: true };
  throw new ApiError(404, "Progetto non trovato");
}

async function storeNewProject(house: House, name: string): Promise<StoredProject> {
  const now = new Date().toISOString();
  const project: StoredProject = { id: uid("p"), name, data: { ...house, name }, createdAt: now, updatedAt: now };
  await putMany("projects", [project]);
  return project;
}

function toQuery(p: CatalogSearchParams): CatalogQuery {
  return {
    text: p.q,
    retailers: p.retailer,
    category: p.category,
    subcategory: p.subcategory,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    maxWidth: p.maxWidth,
    maxDepth: p.maxDepth,
    maxHeight: p.maxHeight,
    color: p.color,
    sources: p.source?.length ? (p.source as ProductSource[]) : undefined,
    sort: p.sort as CatalogQuery["sort"],
    limit: p.limit,
    offset: p.offset,
  };
}

export const localBackend: Backend = {
  async listProjects() {
    const own = await all<StoredProject>("projects");
    own.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { projects: own.map((p) => summary(p, false)), examples: (await examples()).map((p) => summary(p, true)) };
  },

  async createProject(body) {
    let house: House;
    if (body.fromExampleId) {
      const ex = (await examples()).find((e) => e.id === body.fromExampleId);
      if (!ex) throw new ApiError(404, "Esempio non trovato");
      house = cloneHouseWithNewIds(ex.data);
    } else if (body.data) {
      house = validHouse(body.data);
    } else {
      house = createHouse(body.name?.trim() || "Nuova casa");
    }
    const name = (body.name?.trim() || house.name).slice(0, 120);
    return { project: full(await storeNewProject(house, name), false) };
  },

  async getProject(id) {
    const { project, isExample } = await findProject(id);
    return { project: full(project, isExample) };
  },

  async saveProject(id, data) {
    const own = await get<StoredProject>("projects", id);
    if (!own) throw new ApiError(403, "Progetto non modificabile");
    const house = validHouse(data);
    const name = (house.name || "Senza nome").slice(0, 120);
    const updated: StoredProject = { ...own, name, data: { ...house, name }, updatedAt: new Date().toISOString() };
    await putMany("projects", [updated]);
    return { project: summary(updated, false) };
  },

  async deleteProject(id) {
    if (!(await get<StoredProject>("projects", id))) throw new ApiError(403, "Progetto non modificabile");
    await deleteMany("projects", [id]);
  },

  async duplicateProject(id) {
    const { project, isExample } = await findProject(id);
    const name = isExample ? project.name : `${project.name} (copia)`;
    return { project: summary(await storeNewProject(cloneHouseWithNewIds(project.data), name), false) };
  },

  shareProject: async () => unavailable("La condivisione"),
  unshareProject: async () => unavailable("La condivisione"),
  getShared: async () => unavailable("La condivisione"),

  async searchCatalog(params) {
    const query = toQuery(params);
    const local = (await all<StoredProduct>("products")).map((r) => r.product);
    const result = searchProducts([...(await demoProducts()), ...local], query);
    return {
      ...result,
      providers: STATIC_SOURCES.map((id) => ({ id, ...CATALOG_SOURCES[id], active: !query.sources || query.sources.includes(id) })),
    };
  },

  async saveProduct(product) {
    const parsed = ProductSchema.safeParse({ ...product, id: uid("manual"), source: "manual", priceUpdatedAt: new Date().toISOString() });
    if (!parsed.success) throw new ApiError(422, "Dati del prodotto non validi");
    await putMany("products", [{ id: parsed.data.id, product: parsed.data, updatedAt: new Date().toISOString() } satisfies StoredProduct]);
    return { product: parsed.data };
  },

  async deleteProduct(id) {
    if (!(await get<StoredProduct>("products", id))) throw new ApiError(403, "Puoi eliminare solo i tuoi prodotti");
    await deleteMany("products", [id]);
  },

  readProductLink: async () => unavailable("La lettura dei prodotti da link"),
  fetchFeed: async () => unavailable("Il download dei feed"),
  saveFeed: async () => unavailable("L'aggiornamento automatico dei feed"),
  refreshFeed: async () => unavailable("L'aggiornamento automatico dei feed"),

  async listImportBatches() {
    const groups = new Map<string, ImportBatch>();
    for (const r of await all<StoredProduct>("products")) {
      if (!r.importBatch || r.product.source !== "import") continue;
      const g = groups.get(r.importBatch) ?? { batch: r.importBatch, count: 0, updatedAt: r.updatedAt };
      g.count++;
      if (r.updatedAt > (g.updatedAt ?? "")) g.updatedAt = r.updatedAt;
      groups.set(r.importBatch, g);
    }
    return { batches: [...groups.values()] };
  },

  async importProducts(batch, products) {
    const name = batch.trim().slice(0, 120);
    if (!name || !products.length || products.length > MAX_IMPORT) throw new ApiError(422, "File di catalogo non valido");
    const now = new Date().toISOString();
    const rows: StoredProduct[] = [];
    for (const p of products) {
      const parsed = ProductSchema.safeParse({ ...p, source: "import" });
      if (!parsed.success) throw new ApiError(422, `Dati non validi per «${p.name}»`);
      rows.push({ id: parsed.data.id, product: parsed.data, importBatch: name, updatedAt: now });
    }
    await putMany("products", rows);
    return { imported: rows.length };
  },

  async deleteImportBatch(batch) {
    const ids = (await all<StoredProduct>("products")).filter((r) => r.importBatch === batch && r.product.source === "import").map((r) => r.id);
    await deleteMany("products", ids);
    return { deleted: ids.length };
  },
};
