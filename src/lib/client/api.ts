import type { House, Product } from "@/domain/schema";
import type { CatalogFacets } from "@/catalog/types";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  isExample: boolean;
  shared: boolean;
  stats: { floors: number; rooms: number; items: number; areaM2: number };
  preview: { points: { x: number; y: number }[]; color: string }[];
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

export const api = {
  listProjects: () =>
    request<{ user: { id: string; name: string }; projects: ProjectSummary[]; examples: ProjectSummary[] }>(
      "/api/projects",
    ),
  createProject: (body: { name?: string; data?: House; fromExampleId?: string }) =>
    request<{ project: ProjectFull }>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (id: string) => request<{ project: ProjectFull }>(`/api/projects/${encodeURIComponent(id)}`),
  saveProject: (id: string, data: House, opts: { keepalive?: boolean } = {}) =>
    request<{ project: ProjectSummary }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ data, name: data.name }),
      keepalive: opts.keepalive,
    }),
  deleteProject: (id: string) => request<void>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  duplicateProject: (id: string) =>
    request<{ project: ProjectSummary }>(`/api/projects/${encodeURIComponent(id)}/duplicate`, { method: "POST" }),
  shareProject: (id: string) =>
    request<{ token: string }>(`/api/projects/${encodeURIComponent(id)}/share`, { method: "POST" }),
  unshareProject: (id: string) =>
    request<void>(`/api/projects/${encodeURIComponent(id)}/share`, { method: "DELETE" }),
  getShared: (token: string) => request<{ project: ProjectFull }>(`/api/share/${encodeURIComponent(token)}`),
};

// Catalogo ---------------------------------------------------------------

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

export function searchCatalog(params: CatalogSearchParams, signal?: AbortSignal) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  return request<CatalogSearchResponse>(`/api/catalog?${sp.toString()}`, { signal });
}
