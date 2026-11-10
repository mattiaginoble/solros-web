"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductThumb } from "@/components/items/ProductThumb";
import { Button } from "@/components/ui/controls";
import type { Product } from "@/domain/schema";
import { searchCatalog, type CatalogSearchResponse } from "@/lib/client/api";
import { formatMoney, formatPriceDate } from "@/lib/pricing/quote";
import { updateCart, useCartCount } from "@/store/cart";

const PAGE = 48;

interface Filters {
  q: string;
  retailer: string[];
  category: string;
  priceMax: string;
  sort: string;
}

const EMPTY: Filters = { q: "", retailer: [], category: "", priceMax: "", sort: "relevance" };

/** Vetrina: tutto il catalogo (demo, cataloghi importati, prodotti salvati) a griglia con le foto. */
export function ShopPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [query, setQuery] = useState<Filters>(EMPTY);
  // Pagine successive accodate: l'API restituisce al massimo 200 prodotti per richiesta.
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<CatalogSearchResponse | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const cartCount = useCartCount();

  // Ricerca testuale con un piccolo ritardo; gli altri filtri subito.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(filters), filters.q === query.q ? 0 : 300);
    return () => window.clearTimeout(t);
  }, [filters, query.q]);

  useEffect(() => {
    const ctrl = new AbortController();
    searchCatalog(
      {
        q: query.q || undefined,
        retailer: query.retailer,
        category: query.category || undefined,
        priceMax: query.priceMax ? Number(query.priceMax) : undefined,
        sort: query.sort,
        limit: PAGE,
        offset,
      },
      ctrl.signal,
    )
      .then((r) => {
        setData(r);
        setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
        setError(null);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Catalogo non disponibile");
      });
    return () => ctrl.abort();
  }, [query, offset]);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  };
  const retailers = data?.facets.retailers ?? [];
  const categories = data?.facets.categories ?? [];
  const hasMore = !!data && data.total > items.length;
  const addToCart = (p: Product) =>
    void updateCart((s) => s.add(p)).then(() => {
      setAdded(p.name);
      window.setTimeout(() => setAdded((a) => (a === p.name ? null : a)), 2500);
    });

  const activeFilters = useMemo(() => filters.retailer.length + (filters.category ? 1 : 0) + (filters.priceMax ? 1 : 0), [filters]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="whitespace-nowrap text-[15px] font-semibold hover:text-prussian">
            ← <span className="hidden sm:inline">Configuratore </span>Casa
          </Link>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <Link href="/configuratori" className="text-sm font-medium hover:text-prussian" aria-label="Configuratori IKEA">
              Configuratori<span className="hidden sm:inline"> IKEA</span>
            </Link>
            <Link
              href="/carrello"
              className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-line-strong bg-panel px-3 text-sm font-medium hover:border-prussian"
            >
              Carrello
              <span className="min-w-6 rounded-full bg-prussian px-1.5 text-center text-xs text-white tabular-nums">{cartCount}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-[-0.02em]">Vetrina</h1>
        <p className="mt-1 max-w-2xl text-sm text-graphite-soft">
          Tutti i prodotti del catalogo: prodotti IKEA e JYSK aggiornati ogni giorno, demo, cataloghi e feed importati, prodotti salvati da
          link. Aggiungili al carrello per comprarli nei negozi, o usali nei progetti dal pannello Catalogo dell’editor.
        </p>

        <div className="mt-5 flex flex-col gap-3 rounded-[6px] border border-line-strong bg-panel p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-xs text-muted">Cerca</span>
              <input
                type="search"
                value={filters.q}
                onChange={(e) => set({ q: e.target.value })}
                placeholder="divano, letto 160, lampada…"
                aria-label="Cerca nella vetrina"
                className="h-9 rounded-[5px] border border-line-strong bg-panel px-2.5 text-sm outline-none focus:border-prussian"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Categoria</span>
              <select value={filters.category} onChange={(e) => set({ category: e.target.value })} className="h-9 rounded-[5px] border border-line-strong bg-panel px-2 text-sm">
                <option value="">Tutte</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} ({c.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Prezzo massimo (€)</span>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={filters.priceMax}
                onChange={(e) => set({ priceMax: e.target.value })}
                className="h-9 w-32 rounded-[5px] border border-line-strong bg-panel px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Ordina</span>
              <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className="h-9 rounded-[5px] border border-line-strong bg-panel px-2 text-sm">
                <option value="relevance">Più pertinenti</option>
                <option value="price-asc">Prezzo crescente</option>
                <option value="price-desc">Prezzo decrescente</option>
                <option value="name">Nome</option>
              </select>
            </label>
            {activeFilters > 0 && (
              <Button size="sm" onClick={() => set({ retailer: [], category: "", priceMax: "" })}>
                Azzera filtri
              </Button>
            )}
          </div>
          {retailers.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Negozi">
              {retailers.map((r) => {
                const on = filters.retailer.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ retailer: on ? filters.retailer.filter((x) => x !== r.value) : [...filters.retailer, r.value] })}
                    className={`h-8 rounded-full border px-3 text-[13px] ${on ? "border-prussian bg-prussian text-white" : "border-line-strong bg-panel hover:border-prussian"}`}
                  >
                    {r.value} <span className={on ? "text-white/80" : "text-muted"}>{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-graphite-soft" aria-live="polite">
          {error ? <span className="text-danger">{error}</span> : data ? `${data.total} prodotti` : "Caricamento…"}
          {added && <span className="ml-3 font-medium text-prussian">«{added}» aggiunto al carrello</span>}
        </p>

        <ul className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-[6px] border border-line-strong bg-panel">
              <div className="paper-grid flex aspect-[4/3] items-center justify-center border-b border-line bg-white p-4">
                <ProductThumb product={p} className="h-full w-full" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  {p.retailer}
                  {p.source === "demo" && <span className="rounded border border-line-strong px-1 text-[10px]">dati demo</span>}
                </p>
                <h2 className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</h2>
                <p className="text-xs text-muted">
                  {Math.round(p.width)} × {Math.round(p.depth)} × {Math.round(p.height)} cm
                </p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div>
                    <p className="text-[15px] font-semibold tabular-nums">{formatMoney(p.price, p.currency)}</p>
                    <p className="text-[10.5px] text-muted">al {formatPriceDate(p.priceUpdatedAt)}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="primary" className="flex-1" onClick={() => addToCart(p)} aria-label={`Aggiungi ${p.name} al carrello`}>
                    Al carrello
                  </Button>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-[5px] border border-line-strong px-2.5 text-sm hover:border-prussian"
                      aria-label={`Apri ${p.name} nel negozio`}
                    >
                      Negozio
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {hasMore && (
          <div className="mt-6 text-center">
            <Button onClick={() => setOffset(items.length)}>Carica altri prodotti</Button>
          </div>
        )}
        <p className="mt-8 text-xs text-muted">
          Prezzi indicativi con la data di aggiornamento: possono essere cambiati, verifica sul sito del negozio prima dell’acquisto.
        </p>
      </main>
    </div>
  );
}
