"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductThumb } from "@/components/items/ProductThumb";
import { Button } from "@/components/ui/controls";
import { api, type ProjectSummary } from "@/lib/client/api";
import { cartListText, cartTotals, groupByRetailer, itemsFromHouse, type RetailerGroup } from "@/lib/cart/cart";
import { formatMoney, formatPriceDate } from "@/lib/pricing/quote";
import { updateCart, useCart, useCartHydrated } from "@/store/cart";

const totalsText = (totals: Record<string, number>) =>
  Object.entries(totals)
    .map(([c, v]) => formatMoney(v, c))
    .join(" + ") || formatMoney(0);

export function CartPage() {
  const hydrated = useCartHydrated();
  const stored = useCart((s) => s.items);
  const items = useMemo(() => (hydrated ? stored : []), [hydrated, stored]);
  const groups = useMemo(() => groupByRetailer(items), [items]);
  const [message, setMessage] = useState<string | null>(null);
  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 4000);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <Link href="/" className="text-[15px] font-semibold hover:text-prussian">
          ← Configuratore Casa
        </Link>
        <Link href="/catalogo" className="text-sm font-medium text-prussian hover:underline">
          Sfoglia la vetrina
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-[-0.02em]">Carrello</h1>
            <p className="mt-1 text-sm text-graphite-soft">
              I prodotti sono raggruppati per negozio: da ogni gruppo vai al sito del venditore per completare l’acquisto.
            </p>
          </div>
          <FromProject onAdded={(n, name) => notify(`Aggiunti ${n} prodotti da «${name}»`)} />
        </div>
        {message && (
          <p role="status" className="mt-4 rounded-[5px] border border-line-strong bg-panel px-3 py-2 text-sm">
            {message}
          </p>
        )}

        {hydrated && !items.length ? (
          <div className="mt-8 rounded-[6px] border border-dashed border-line-strong bg-panel px-6 py-10 text-center">
            <p className="text-[15px] font-medium">Il carrello è vuoto</p>
            <p className="mt-1 text-sm text-graphite-soft">Aggiungi prodotti dalla vetrina, dal preventivo di un progetto o con il menu qui sopra.</p>
            <Link href="/catalogo" className="mt-4 inline-block text-sm font-medium text-prussian underline">
              Apri la vetrina
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            {groups.map((g) => (
              <RetailerCard key={g.retailer} group={g} onCopied={() => notify(`Elenco di ${g.retailer} copiato`)} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm("Svuotare il carrello?")) void updateCart((s) => s.clear());
              }}
            >
              Svuota il carrello
            </Button>
            <p className="text-lg font-semibold tabular-nums">Totale: {totalsText(cartTotals(items))}</p>
          </div>
        )}
        <p className="mt-6 text-xs text-muted">
          Prezzi indicativi, con la data in cui sono stati letti: possono essere cambiati, verifica sempre sul sito del negozio prima
          dell’acquisto.
        </p>
      </main>
    </div>
  );
}

function RetailerCard({ group, onCopied }: { group: RetailerGroup; onCopied: () => void }) {
  const { checkout } = group;
  const pieces = group.items.reduce((n, it) => n + it.quantity, 0);
  return (
    <section aria-label={group.retailer} className="overflow-hidden rounded-[6px] border border-line-strong bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-sunk px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold">{group.retailer}</h2>
          <p className="text-xs text-muted">
            {pieces} {pieces === 1 ? "pezzo" : "pezzi"} · {totalsText(group.totals)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(cartListText(group, formatMoney)).catch(() => {});
              onCopied();
            }}
          >
            Copia elenco
          </Button>
          {checkout.kind === "cart" ? (
            <a
              href={checkout.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-[5px] border border-prussian bg-prussian px-3 text-sm font-medium text-white hover:bg-prussian-strong"
            >
              {checkout.label}
            </a>
          ) : checkout.urls.length ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                for (const url of checkout.urls) {
                  const w = window.open(url, "_blank");
                  if (w) w.opener = null;
                }
              }}
            >
              {checkout.urls.length === 1 ? "Vai al negozio" : `Apri i ${checkout.urls.length} prodotti nel negozio`}
            </Button>
          ) : (
            <span className="self-center text-xs text-muted">Nessun link al negozio</span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {group.items.map(({ product: p, quantity }) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <div className="paper-grid flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-white">
              <ProductThumb product={p} className="h-14 w-14" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-prussian hover:underline">
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </p>
              <p className="text-xs text-muted">
                {p.code ? `Art. ${p.code} · ` : ""}
                {Math.round(p.width)} × {Math.round(p.depth)} × {Math.round(p.height)} cm · prezzo al {formatPriceDate(p.priceUpdatedAt)}
              </p>
            </div>
            <QuantityField productId={p.id} quantity={quantity} />
            <div className="w-28 text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(p.price * quantity, p.currency)}</p>
              {quantity > 1 && <p className="text-xs text-muted tabular-nums">{formatMoney(p.price, p.currency)} cad.</p>}
            </div>
            <button
              type="button"
              aria-label={`Togli ${p.name} dal carrello`}
              className="h-8 w-8 rounded text-lg text-muted hover:bg-panel-sunk hover:text-danger"
              onClick={() => void updateCart((s) => s.remove(p.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuantityField({ productId, quantity }: { productId: string; quantity: number }) {
  const set = (q: number) => void updateCart((s) => s.setQuantity(productId, q));
  return (
    <div className="flex items-center rounded-[5px] border border-line-strong" role="group" aria-label="Quantità">
      <button type="button" aria-label="Uno in meno" className="h-8 w-8 hover:bg-panel-sunk" onClick={() => set(quantity - 1)}>
        −
      </button>
      <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
      <button type="button" aria-label="Uno in più" className="h-8 w-8 hover:bg-panel-sunk" onClick={() => set(quantity + 1)}>
        +
      </button>
    </div>
  );
}

/** Aggiunge al carrello tutti gli arredi di un progetto. */
function FromProject({ onAdded }: { onAdded: (count: number, name: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .listProjects()
      .then((r) => setProjects(r.projects.filter((p) => p.stats.items > 0)))
      .catch(() => {});
  }, []);
  if (!projects.length) return null;
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Arredi di un progetto</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 rounded-[5px] border border-line-strong bg-panel px-2 text-sm"
        >
          <option value="">Scegli…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stats.items} arredi)
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={!selected || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { project } = await api.getProject(selected);
            const added = itemsFromHouse(project.data);
            await updateCart((s) => s.addMany(added));
            onAdded(added.reduce((n, it) => n + it.quantity, 0), project.name);
          } finally {
            setBusy(false);
          }
        }}
      >
        Aggiungi
      </Button>
    </div>
  );
}
