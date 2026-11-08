/**
 * Accesso ai dati dal client: API del server oppure, nella versione statica,
 * archivio nel browser. I componenti usano solo `api`.
 */
import type { House, Product } from "@/domain/schema";
import { ApiError, type Backend, type CatalogSearchParams, type CatalogSearchResponse, type ImportBatch, type ProjectFull, type ProjectSummary } from "./apiTypes";
import type { LinkMetadata } from "@/catalog/linkMetadata";
import { localBackend } from "./localBackend";
import { STATIC_MODE } from "./mode";

export * from "./apiTypes";

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Errore ${res.status}`, body.details);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const remoteBackend: Backend = {
  listProjects: () => request<{ projects: ProjectSummary[]; examples: ProjectSummary[] }>("/api/projects"),
  createProject: (body) => request<{ project: ProjectFull }>("/api/projects", json("POST", body)),
  getProject: (id) => request<{ project: ProjectFull }>(`/api/projects/${enc(id)}`),
  saveProject: (id: string, data: House, opts: { keepalive?: boolean } = {}) =>
    request<{ project: ProjectSummary }>(`/api/projects/${enc(id)}`, { ...json("PUT", { data, name: data.name }), keepalive: opts.keepalive }),
  deleteProject: (id) => request<void>(`/api/projects/${enc(id)}`, { method: "DELETE" }),
  duplicateProject: (id) => request<{ project: ProjectSummary }>(`/api/projects/${enc(id)}/duplicate`, { method: "POST" }),
  shareProject: (id) => request<{ token: string }>(`/api/projects/${enc(id)}/share`, { method: "POST" }),
  unshareProject: (id) => request<void>(`/api/projects/${enc(id)}/share`, { method: "DELETE" }),
  getShared: (token) => request<{ project: ProjectFull }>(`/api/share/${enc(token)}`),
  searchCatalog(params: CatalogSearchParams, signal?: AbortSignal) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
      else sp.set(k, String(v));
    }
    return request<CatalogSearchResponse>(`/api/catalog?${sp.toString()}`, { signal });
  },
  saveProduct: (product) => request<{ product: Product }>("/api/catalog/products", json("POST", { product })),
  deleteProduct: (id) => request<void>(`/api/catalog/products/${enc(id)}`, { method: "DELETE" }),
  readProductLink: (url) => request<{ metadata: LinkMetadata }>("/api/catalog/link", json("POST", { url })),
  listImportBatches: () => request<{ batches: ImportBatch[] }>("/api/catalog/import"),
  importProducts: (batch, products) => request<{ imported: number }>("/api/catalog/import", json("POST", { batch, products })),
  deleteImportBatch: (batch) => request<{ deleted: number }>(`/api/catalog/import?batch=${enc(batch)}`, { method: "DELETE" }),
};

export const api: Backend = STATIC_MODE ? localBackend : remoteBackend;

export function searchCatalog(params: CatalogSearchParams, signal?: AbortSignal) {
  return api.searchCatalog(params, signal);
}
