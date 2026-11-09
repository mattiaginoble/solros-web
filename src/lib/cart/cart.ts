/**
 * Carrello: prodotti scelti da comprare, raggruppati per negozio. Per ogni
 * negozio si calcola come completare l'acquisto: un link che riempie il
 * carrello del negozio quando è possibile, altrimenti le pagine dei prodotti.
 */
import type { House, Product } from "@/domain/schema";

export interface CartItem {
  product: Product;
  quantity: number;
}

export type Checkout =
  | { kind: "cart"; url: string; label: string }
  | { kind: "pages"; urls: string[] };

export interface RetailerGroup {
  retailer: string;
  items: CartItem[];
  totals: Record<string, number>;
  checkout: Checkout;
}

const cents = (n: number) => Math.round(n * 100);

/** Totali per valuta. */
export function cartTotals(items: CartItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[it.product.currency] = (out[it.product.currency] ?? 0) + cents(it.product.price) * it.quantity;
  for (const c of Object.keys(out)) out[c] /= 100;
  return out;
}

/** Aggiunge prodotti al carrello sommando le quantità degli stessi prodotti. */
export function addItems(items: CartItem[], added: CartItem[]): CartItem[] {
  const out = items.map((it) => ({ ...it }));
  for (const a of added) {
    if (a.quantity <= 0) continue;
    const existing = out.find((it) => it.product.id === a.product.id);
    if (existing) existing.quantity += a.quantity;
    else out.push({ product: a.product, quantity: a.quantity });
  }
  return out;
}

/** Arredi di una casa (tutti i piani), con le quantità. */
export function itemsFromHouse(house: House): CartItem[] {
  const all: CartItem[] = [];
  for (const f of house.floors) for (const r of f.rooms) for (const it of r.items) all.push({ product: it.product, quantity: it.quantity });
  return addItems([], all);
}

function parseUrl(v?: string): URL | null {
  try {
    return v ? new URL(v) : null;
  } catch {
    return null;
  }
}

const ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

/** Link che aggiunge i prodotti al carrello Amazon, se sono tutti dello stesso sito Amazon. */
export function amazonCartUrl(items: CartItem[]): string | null {
  let host: string | null = null;
  let tag: string | null = null;
  const params = new URLSearchParams();
  for (const [i, it] of items.entries()) {
    const u = parseUrl(it.product.url);
    if (!u || !/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return null;
    const asin = ASIN.exec(u.pathname)?.[1] ?? (/^[A-Z0-9]{10}$/.test(it.product.code ?? "") ? it.product.code! : null);
    if (!asin) return null;
    if (host && host !== u.hostname) return null;
    host = u.hostname;
    tag ??= u.searchParams.get("tag");
    params.set(`ASIN.${i + 1}`, asin.toUpperCase());
    params.set(`Quantity.${i + 1}`, String(it.quantity));
  }
  if (!host) return null;
  if (tag) params.set("AssociateTag", tag);
  return `https://${host}/gp/aws/cart/add.html?${params.toString()}`;
}

/** Link al carrello di un negozio Shopify, dagli identificativi dei feed ("shopify_IT_<prodotto>_<variante>"). */
export function shopifyCartUrl(items: CartItem[]): string | null {
  let origin: string | null = null;
  const parts: string[] = [];
  for (const it of items) {
    const variant = /^shopify_[a-z]{2}_\d+_(\d+)$/i.exec(it.product.code ?? "")?.[1];
    const u = parseUrl(it.product.url);
    if (!variant || !u || (origin && origin !== u.origin)) return null;
    origin = u.origin;
    parts.push(`${variant}:${it.quantity}`);
  }
  return origin ? `${origin}/cart/${parts.join(",")}` : null;
}

/** Come completare l'acquisto dei prodotti di un negozio. */
export function checkoutFor(items: CartItem[]): Checkout {
  const amazon = amazonCartUrl(items);
  if (amazon) return { kind: "cart", url: amazon, label: "Aggiungi al carrello Amazon" };
  const shopify = shopifyCartUrl(items);
  if (shopify) return { kind: "cart", url: shopify, label: "Vai al carrello del negozio" };
  const urls = Array.from(new Set(items.map((it) => it.product.url).filter((u): u is string => !!parseUrl(u))));
  return { kind: "pages", urls };
}

/** Prodotti raggruppati per negozio, in ordine alfabetico. */
export function groupByRetailer(items: CartItem[]): RetailerGroup[] {
  const map = new Map<string, CartItem[]>();
  for (const it of items) map.set(it.product.retailer, [...(map.get(it.product.retailer) ?? []), it]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "it"))
    .map(([retailer, list]) => ({ retailer, items: list, totals: cartTotals(list), checkout: checkoutFor(list) }));
}

/** Elenco da copiare (per esempio da cercare per codice articolo nel sito del negozio). */
export function cartListText(group: RetailerGroup, money: (n: number, c: string) => string): string {
  const lines = group.items.map((it) => {
    const code = it.product.code ? ` (art. ${it.product.code})` : "";
    return `${it.quantity} × ${it.product.name}${code} — ${money(it.product.price * it.quantity, it.product.currency)}`;
  });
  const total = Object.entries(group.totals).map(([c, v]) => money(v, c)).join(" + ");
  return [`${group.retailer}:`, ...lines, `Totale: ${total}`].join("\n");
}
