/**
 * Calcolo del preventivo: righe aggregate per prodotto, totali per stanza,
 * per casa e per rivenditore. Le somme sono fatte in centesimi per evitare
 * errori di arrotondamento; valute diverse restano separate.
 */
import type { House, PlacedItem, Product, Room } from "@/domain/schema";

export interface QuoteLineInput {
  productId: string;
  name: string;
  retailer: string;
  code?: string;
  url?: string;
  category?: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  priceUpdatedAt?: string;
  isDemo?: boolean;
}

export interface QuoteLine extends QuoteLineInput {
  key: string;
  total: number;
  /** Stanze in cui compare il prodotto. */
  rooms: string[];
}

export type Totals = Record<string, number>;

export interface RoomQuote {
  roomId: string;
  roomName: string;
  floorName: string;
  lines: QuoteLine[];
  totals: Totals;
}

export interface RetailerQuote {
  retailer: string;
  lines: QuoteLine[];
  totals: Totals;
}

export interface Quote {
  lines: QuoteLine[];
  byRoom: RoomQuote[];
  byRetailer: RetailerQuote[];
  totals: Totals;
  itemCount: number;
  /** Data del prezzo più vecchio presente nel preventivo. */
  oldestPriceDate: string | null;
  hasDemo: boolean;
}

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export function lineFromItem(item: PlacedItem): QuoteLineInput {
  return lineFromProduct(item.product, item.quantity ?? 1);
}

export function lineFromProduct(p: Product, quantity = 1): QuoteLineInput {
  return {
    productId: p.id,
    name: p.name,
    retailer: p.retailer,
    code: p.code,
    url: p.url,
    category: p.category,
    unitPrice: p.price,
    currency: p.currency,
    quantity,
    priceUpdatedAt: p.priceUpdatedAt,
    isDemo: p.source === "demo",
  };
}

/** Aggrega righe con lo stesso prodotto e lo stesso prezzo unitario. */
export function aggregateLines(inputs: (QuoteLineInput & { room?: string })[]): QuoteLine[] {
  const map = new Map<string, QuoteLine & { cents: number }>();
  for (const l of inputs) {
    if (l.quantity <= 0) continue;
    const key = `${l.productId}|${toCents(l.unitPrice)}|${l.currency}`;
    const cur = map.get(key);
    const cents = toCents(l.unitPrice) * l.quantity;
    if (cur) {
      cur.quantity += l.quantity;
      cur.cents += cents;
      if (l.room && !cur.rooms.includes(l.room)) cur.rooms.push(l.room);
    } else {
      const { room, ...rest } = l;
      map.set(key, { ...rest, key, total: 0, cents, rooms: room ? [room] : [] });
    }
  }
  return [...map.values()].map(({ cents, ...l }) => ({ ...l, total: fromCents(cents) }));
}

export function sumTotals(lines: QuoteLine[]): Totals {
  const cents: Record<string, number> = {};
  for (const l of lines) cents[l.currency] = (cents[l.currency] ?? 0) + toCents(l.total);
  return Object.fromEntries(Object.entries(cents).map(([c, v]) => [c, fromCents(v)]));
}

/** Righe aggiuntive di una stanza non legate a oggetti posizionati (es. top cucina). */
export type ExtraLines = (room: Room) => QuoteLineInput[];

export function roomLineInputs(room: Room, extras?: ExtraLines): QuoteLineInput[] {
  return [...room.items.map(lineFromItem), ...(extras ? extras(room) : [])];
}

export function quoteForRoom(room: Room, floorName = "", extras?: ExtraLines): RoomQuote {
  const lines = aggregateLines(roomLineInputs(room, extras));
  return { roomId: room.id, roomName: room.name, floorName, lines, totals: sumTotals(lines) };
}

export function quoteForHouse(house: House, opts: { floorId?: string; extras?: ExtraLines } = {}): Quote {
  const floors = opts.floorId ? house.floors.filter((f) => f.id === opts.floorId) : house.floors;
  const byRoom: RoomQuote[] = [];
  const all: (QuoteLineInput & { room?: string })[] = [];
  for (const f of floors) {
    for (const r of f.rooms) {
      const inputs = roomLineInputs(r, opts.extras);
      const label = floors.length > 1 || house.floors.length > 1 ? `${r.name} (${f.name})` : r.name;
      all.push(...inputs.map((l) => ({ ...l, room: label })));
      const lines = aggregateLines(inputs);
      if (lines.length) byRoom.push({ roomId: r.id, roomName: r.name, floorName: f.name, lines, totals: sumTotals(lines) });
    }
  }
  const lines = aggregateLines(all).sort(
    (a, b) => a.retailer.localeCompare(b.retailer, "it") || a.name.localeCompare(b.name, "it"),
  );
  const retailers = Array.from(new Set(lines.map((l) => l.retailer))).sort((a, b) => a.localeCompare(b, "it"));
  const byRetailer = retailers.map((retailer) => {
    const rl = lines.filter((l) => l.retailer === retailer);
    return { retailer, lines: rl, totals: sumTotals(rl) };
  });
  const dates = lines.map((l) => l.priceUpdatedAt).filter((d): d is string => !!d).sort();
  return {
    lines,
    byRoom,
    byRetailer,
    totals: sumTotals(lines),
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
    oldestPriceDate: dates[0] ?? null,
    hasDemo: lines.some((l) => l.isDemo),
  };
}

export function formatMoney(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency, minimumFractionDigits: 2, useGrouping: "always" }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Formatta i totali (una o più valute) in una stringa. */
export function formatTotals(totals: Totals, fallbackCurrency = "EUR") {
  const entries = Object.entries(totals);
  if (entries.length === 0) return formatMoney(0, fallbackCurrency);
  return entries.map(([c, v]) => formatMoney(v, c)).join(" + ");
}

export function formatPriceDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
