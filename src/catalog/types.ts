import type { MountType, Product, ProductSource } from "@/domain/schema";

/** Parametri di ricerca del catalogo (tutti facoltativi). */
export interface CatalogQuery {
  text?: string;
  retailers?: string[];
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  /** Ingombri massimi in cm. */
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
  /** Famiglia di colore (vedi colorFamily). */
  color?: string;
  sources?: ProductSource[];
  mount?: MountType;
  sort?: "relevance" | "price-asc" | "price-desc" | "name";
  limit?: number;
  offset?: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface CatalogFacets {
  retailers: FacetValue[];
  categories: (FacetValue & { subcategories: FacetValue[] })[];
  colors: FacetValue[];
  sources: FacetValue[];
  price: { min: number; max: number };
}

export interface CatalogResult {
  items: Product[];
  total: number;
  facets: CatalogFacets;
}

export interface CatalogContext {
  /** Utente corrente: i prodotti importati o personali sono visibili solo al proprietario. */
  userId: string | null;
}

/**
 * Sorgente di prodotti intercambiabile. Ogni provider restituisce l'elenco dei
 * propri prodotti; ricerca, filtri e faccette sono applicati in modo uniforme
 * dal servizio di catalogo. I provider che importano dati espongono metodi
 * aggiuntivi (vedi FileImportProvider e ProductLinkProvider).
 */
export interface CatalogProvider {
  id: ProductSource;
  label: string;
  description: string;
  list(ctx: CatalogContext): Promise<Product[]>;
}
