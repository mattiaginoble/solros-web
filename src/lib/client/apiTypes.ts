/** Tipi condivisi tra il client che usa le API del server e l'archivio nel browser. */
import type { CatalogFacets } from "@/catalog/types";
import type { LinkMetadata } from "@/catalog/linkMetadata";
import type { HousePreview, HouseStats } from "@/domain/summary";
import type { House, Product } from "@/domain/schema";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  isExample: boolean;
  shared: boolean;
  stats: HouseStats;
  preview: HousePreview;
}

export interface ProjectFull extends ProjectSummary {
  readOnly: boolean;
  shareToken?: string | null;
  data: House;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  subcategory?: string;
  retailer?: string[];
  priceMin?: number;
  priceMax?: number;
  maxWidth?: number;
  maxDepth?: number;
  maxHeight?: number;
  color?: string;
  source?: string[];
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogSearchResponse {
  items: Product[];
  total: number;
  facets: CatalogFacets;
  providers: { id: string; label: string; description: string; active: boolean }[];
}

export interface ImportBatch {
  batch: string;
  count: number;
  updatedAt?: string;
}

/** Operazioni sui dati: implementate dalle API del server o dall'archivio nel browser. */
export interface Backend {
  listProjects(): Promise<{ projects: ProjectSummary[]; examples: ProjectSummary[] }>;
  createProject(body: { name?: string; data?: House; fromExampleId?: string }): Promise<{ project: ProjectFull }>;
  getProject(id: string): Promise<{ project: ProjectFull }>;
  saveProject(id: string, data: House, opts?: { keepalive?: boolean }): Promise<unknown>;
  deleteProject(id: string): Promise<void>;
  duplicateProject(id: string): Promise<{ project: ProjectSummary }>;
  shareProject(id: string): Promise<{ token: string }>;
  unshareProject(id: string): Promise<void>;
  getShared(token: string): Promise<{ project: ProjectFull }>;
  searchCatalog(params: CatalogSearchParams, signal?: AbortSignal): Promise<CatalogSearchResponse>;
  saveProduct(product: Record<string, unknown>): Promise<{ product: Product }>;
  deleteProduct(id: string): Promise<void>;
  readProductLink(url: string): Promise<{ metadata: LinkMetadata }>;
  listImportBatches(): Promise<{ batches: ImportBatch[] }>;
  importProducts(batch: string, products: Product[]): Promise<{ imported: number }>;
  deleteImportBatch(batch: string): Promise<{ deleted: number }>;
}
