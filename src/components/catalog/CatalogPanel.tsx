"use client";
import { useEffect, useMemo, useState } from "react";
import { PRODUCT_DND_TYPE } from "@/components/editor2d/dnd";
import { ProductThumb } from "@/components/items/ProductThumb";
import { IconButton } from "@/components/ui/controls";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import type { Product } from "@/domain/schema";
import { api, searchCatalog, type CatalogSearchResponse } from "@/lib/client/api";
import { formatMoney, formatPriceDate } from "@/lib/pricing/quote";
import { addProduct } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { useCatalogVersion } from "./catalogVersion";

const SOURCE_LABEL: Record<string, string> = {
  demo: "Dati demo",
  import: "Importato",
  link: "Da link",
  manual: "Personalizzato",
};

const COLOR_SWATCH: Record<string, string> = {
  Bianco: "#f4f4f1",
  Nero: "#2a2a2a",
  Grigio: "#9a9c9e",
  Legno: "#b88a5a",
  Beige: "#d9ccb3",
  Metallo: "linear-gradient(135deg,#d4d7da,#8d9196)",
  Blu: "#3f5a8a",
  Verde: "#6f8a62",
  "Rosso e rosa": "#c46b62",
  Giallo: "#d9b44a",
  Altro: "repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px)",
};

interface Filters {
  q: string;
  category: string;
  subcategory: string;
  retailer: string[];
  priceMin: string;
  priceMax: string;
  maxWidth: string;
  maxDepth: string;
  maxHeight: string;
  color: string;
  source: string[];
  sort: string;
}

const EMPTY: Filters = {
  q: "",
  category: "",
  subcategory: "",
  retailer: [],
  priceMin: "",
  priceMax: "",
  maxWidth: "",
  maxDepth: "",
  maxHeight: "",
  color: "",
  source: [],
  sort: "relevance",
};

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CatalogPanel() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState<CatalogSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const openDialog = useEditor((s) => s.openDialog);
  const version = useCatalogVersion((s) => s.version);
  const debounced = useDebounced(filters, 220);

  useEffect(() => {
    const ctrl = new AbortController();
    searchCatalog(
      {
        q: debounced.q,
        category: debounced.category,
        subcategory: debounced.subcategory,
        retailer: debounced.retailer,
        priceMin: num(debounced.priceMin),
        priceMax: num(debounced.priceMax),
        maxWidth: num(debounced.maxWidth),
        maxDepth: num(debounced.maxDepth),
        maxHeight: num(debounced.maxHeight),
        color: debounced.color,
        source: debounced.source,
        sort: debounced.sort,
        limit: 120,
      },
      ctrl.signal,
    )
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError("Catalogo non disponibile. Riprova tra poco.");
      });
    return () => ctrl.abort();
  }, [debounced, version]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeCount =
    filters.retailer.length +
    filters.source.length +
    (filters.color ? 1 : 0) +
    [filters.priceMin, filters.priceMax, filters.maxWidth, filters.maxDepth, filters.maxHeight].filter((x) => x.trim()).length;
  const subcats = useMemo(
    () => data?.facets.categories.find((c) => c.value === filters.category)?.subcategories ?? [],
    [data, filters.category],
  );
  const latestDate = data?.items.reduce<string | null>((acc, p) => (!acc || p.priceUpdatedAt > acc ? p.priceUpdatedAt : acc), null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <label className="flex h-9 items-center gap-2 rounded-[5px] border border-line-strong bg-panel px-2.5 focus-within:border-prussian">
          <IconSearch size={16} className="text-muted" />
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Cerca: divano, letto 160, lavabo…"
            aria-label="Cerca nel catalogo"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={() => openDialog("catalog-add")}
              title="Aggiungi prodotti da link, file CSV/JSON o a mano"
              className="h-8 shrink-0 rounded-[5px] border border-prussian bg-prussian px-2.5 text-[13px] font-medium text-white hover:bg-prussian-strong"
            >
              + Aggiungi
            </button>
          )}
          <select
            aria-label="Categoria"
            value={filters.category}
            onChange={(e) => set({ category: e.target.value, subcategory: "" })}
            className="h-8 min-w-0 flex-1 rounded-[5px] border border-line-strong bg-panel px-1.5 text-[13px]"
          >
            <option value="">Tutte le categorie</option>
            {data?.facets.categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`h-8 shrink-0 rounded-[5px] border px-2.5 text-[13px] font-medium ${
              showFilters || activeCount ? "border-prussian text-prussian" : "border-line-strong text-graphite-soft"
            }`}
          >
            Filtri{activeCount ? ` (${activeCount})` : ""}
          </button>
        </div>
        {subcats.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {subcats.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => set({ subcategory: filters.subcategory === s.value ? "" : s.value })}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  filters.subcategory === s.value ? "border-prussian bg-prussian-tint text-prussian" : "border-line-strong text-graphite-soft hover:border-graphite-soft"
                }`}
              >
                {s.value}
              </button>
            ))}
          </div>
        )}
        {showFilters && data && (
          <div className="flex flex-col gap-3 rounded-[6px] border border-line bg-panel-sunk p-2.5 text-[13px]">
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Rivenditore</legend>
              <div className="flex flex-col gap-0.5">
                {data.facets.retailers.map((r) => (
                  <label key={r.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.retailer.includes(r.value)}
                      onChange={(e) =>
                        set({ retailer: e.target.checked ? [...filters.retailer, r.value] : filters.retailer.filter((x) => x !== r.value) })
                      }
                    />
                    <span className="flex-1">{r.value}</span>
                    <span className="text-xs text-muted">{r.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Prezzo (€)</legend>
              <div className="flex items-center gap-2">
                <input aria-label="Prezzo minimo" inputMode="decimal" placeholder="da" value={filters.priceMin} onChange={(e) => set({ priceMin: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className="h-8 w-full rounded border border-line-strong bg-panel px-2" />
                <input aria-label="Prezzo massimo" inputMode="decimal" placeholder="a" value={filters.priceMax} onChange={(e) => set({ priceMax: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className="h-8 w-full rounded border border-line-strong bg-panel px-2" />
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Ingombro massimo (cm)</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["maxWidth", "Largh."],
                    ["maxDepth", "Prof."],
                    ["maxHeight", "Alt."],
                  ] as const
                ).map(([k, l]) => (
                  <input
                    key={k}
                    aria-label={`${l} massima`}
                    inputMode="decimal"
                    placeholder={l}
                    value={filters[k]}
                    onChange={(e) => set({ [k]: e.target.value } as Partial<Filters>)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8 w-full rounded border border-line-strong bg-panel px-2"
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Colore</legend>
              <div className="flex flex-wrap gap-1.5">
                {data.facets.colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={`${c.value} (${c.count})`}
                    aria-label={`Colore ${c.value}`}
                    aria-pressed={filters.color === c.value}
                    onClick={() => set({ color: filters.color === c.value ? "" : c.value })}
                    className={`h-6 w-6 rounded-full border ${filters.color === c.value ? "border-prussian ring-2 ring-prussian/40" : "border-line-strong"}`}
                    style={{ background: COLOR_SWATCH[c.value] ?? "#ddd" }}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Sorgente</legend>
              <div className="flex flex-wrap gap-1">
                {data.facets.sources.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={filters.source.includes(s.value)}
                      onChange={(e) => set({ source: e.target.checked ? [...filters.source, s.value] : filters.source.filter((x) => x !== s.value) })}
                    />
                    {SOURCE_LABEL[s.value] ?? s.value} <span className="text-xs text-muted">{s.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center justify-between gap-2">
              <select
                aria-label="Ordina"
                value={filters.sort}
                onChange={(e) => set({ sort: e.target.value })}
                className="h-8 rounded border border-line-strong bg-panel px-1.5"
              >
                <option value="relevance">Più pertinenti</option>
                <option value="price-asc">Prezzo crescente</option>
                <option value="price-desc">Prezzo decrescente</option>
                <option value="name">Nome</option>
              </select>
              <button type="button" className="text-xs font-medium text-prussian underline" onClick={() => setFilters({ ...EMPTY, q: filters.q, category: filters.category })}>
                Azzera filtri
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="border-b border-line bg-warning-tint/50 px-3 py-1.5 text-[11.5px] leading-snug text-graphite-soft">
        Prezzi indicativi{latestDate ? ` aggiornati al ${formatPriceDate(latestDate)}` : ""}: possono essere cambiati, verifica sul
        sito del rivenditore prima dell’acquisto.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="p-3 text-sm text-danger">{error}</p>}
        {data && data.total === 0 && <p className="p-4 text-sm text-muted">Nessun prodotto corrisponde alla ricerca. Prova a togliere qualche filtro.</p>}
        <ul className="flex flex-col">
          {data?.items.map((p) => (
            <CatalogRow
              key={p.id}
              product={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              disabled={readOnly}
            />
          ))}
        </ul>
        {data && data.total > data.items.length && (
          <p className="p-3 text-center text-xs text-muted">
            Mostrati {data.items.length} di {data.total}: affina la ricerca per vedere gli altri.
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogRow({ product: p, expanded, onToggle, disabled }: { product: Product; expanded: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <li
      className="border-b border-line"
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(PRODUCT_DND_TYPE, JSON.stringify(p));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="paper-grid flex h-14 w-14 shrink-0 items-center justify-center rounded-[4px] border border-line"
          title="Dettagli"
        >
          <ProductThumb product={p} className="h-11 w-11" />
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="block text-[13px] font-medium leading-tight">{p.name}</span>
          <span className="mt-0.5 block text-[11.5px] text-muted">
            {p.retailer}
            {p.source === "demo" && <span className="ml-1.5 rounded border border-line-strong px-1 text-[10px]">dati demo</span>}
          </span>
          <span className="block text-[11.5px] tabular-nums text-graphite-soft">
            {p.width} × {p.depth} × {p.height} cm
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[13px] font-semibold tabular-nums">{formatMoney(p.price, p.currency)}</span>
          <span className="text-[10.5px] text-muted">al {formatPriceDate(p.priceUpdatedAt)}</span>
          <IconButton label={`Aggiungi ${p.name}`} disabled={disabled} onClick={() => addProduct(p)} className="!h-7 !w-7 border-line-strong">
            <IconPlus size={16} />
          </IconButton>
        </div>
      </div>
      {expanded && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 bg-panel-sunk px-3 py-2 text-[12px]">
          <dt className="text-muted">Categoria</dt>
          <dd>
            {p.category}
            {p.subcategory ? `, ${p.subcategory}` : ""}
          </dd>
          {p.code && (
            <>
              <dt className="text-muted">Codice</dt>
              <dd>{p.code}</dd>
            </>
          )}
          {p.color && (
            <>
              <dt className="text-muted">Colore</dt>
              <dd>{p.color}</dd>
            </>
          )}
          <dt className="text-muted">Montaggio</dt>
          <dd>{p.mount === "wall" ? `A parete${p.elevation ? `, a ${p.elevation} cm da terra` : ""}` : p.mount === "ceiling" ? "A soffitto" : "A pavimento"}</dd>
          {(p.clearance.front > 0 || p.clearance.sides > 0) && (
            <>
              <dt className="text-muted">Spazio di rispetto</dt>
              <dd>
                {p.clearance.front > 0 ? `${p.clearance.front} cm davanti` : ""}
                {p.clearance.front > 0 && p.clearance.sides > 0 ? ", " : ""}
                {p.clearance.sides > 0 ? `${p.clearance.sides} cm ai lati` : ""}
              </dd>
            </>
          )}
          {p.url && (
            <>
              <dt className="text-muted">Pagina</dt>
              <dd>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-prussian underline">
                  Apri sul sito del rivenditore
                </a>
              </dd>
            </>
          )}
          <dd className="col-span-2 mt-1 flex items-center justify-between text-[11px] text-muted">
            <span>Trascina il prodotto sulla pianta oppure usa +.</span>
            {p.source !== "demo" && !disabled && (
              <button
                type="button"
                className="font-medium text-danger underline"
                onClick={async () => {
                  if (!confirm(`Eliminare «${p.name}» dal catalogo? Gli oggetti già posizionati restano nel progetto.`)) return;
                  try {
                    await api.deleteProduct(p.id);
                    useCatalogVersion.getState().bump();
                  } catch (e) {
                    useEditor.getState().notify(e instanceof Error ? e.message : "Eliminazione non riuscita", "warning");
                  }
                }}
              >
                Elimina dal catalogo
              </button>
            )}
          </dd>
        </dl>
      )}
    </li>
  );
}
