/**
 * Configuratore cucina: composizione automatica dei moduli su una parete
 * (lineare) o su due pareti adiacenti (ad angolo), riempimento delle misure,
 * generazione degli oggetti in pianta e distinta componenti con prezzi.
 */
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { uid } from "@/domain/factory";
import type { KitchenConfig, KitchenModule, KitchenRun, PlacedItem, Product, Room } from "@/domain/schema";
import { edges, edgeLength } from "@/lib/geometry/polygon";
import { rotationFacingAwayFrom } from "@/lib/geometry/placement";
import { add, mul } from "@/lib/geometry/vec";
import type { QuoteLineInput } from "@/lib/pricing/quote";
import {
  FILLER_PRICE,
  FRONT_BY_ID,
  FRONTS,
  HANDLE_BY_ID,
  HANDLES,
  KITCHEN_PRICE_DATE,
  PLINTH_PRICE_PER_METER,
  WORKTOP_BY_ID,
  WORKTOPS,
} from "./options";

export const BASE_DEPTH = 60;
export const WALL_DEPTH = 35;
export const WALL_HEIGHT = 72;
export const CORNER_WIDTH = 90;
const BASE_WIDTHS = [80, 60, 40, 30];
const WALL_WIDTHS = [80, 60, 40];

export interface KitchenChoices {
  layout: "linear" | "corner";
  /** Lato della stanza (indice) della composizione; per l'angolo è il primo lato, l'angolo è alla sua fine. */
  wallIndex: number;
  /** Inizio della composizione lungo il lato (solo lineare). */
  start: number;
  /** Lunghezza della composizione sul primo lato. */
  length: number;
  /** Lunghezza sul secondo lato (solo angolo), misurata dall'angolo interno. */
  lengthB: number;
  fridge: "tall" | "freestanding" | "none";
  oven: "under" | "tall" | "none";
  cooktop: "induction-60" | "induction-80" | "gas-60" | "none";
  dishwasher: boolean;
  sink: boolean;
  hood: "under-cabinet" | "wall-90" | "none";
  wallCabinets: boolean;
  frontId: string;
  handleId: string;
  worktopId: string;
}

export const DEFAULT_CHOICES: Omit<KitchenChoices, "wallIndex" | "start" | "length" | "lengthB"> = {
  layout: "linear",
  fridge: "tall",
  oven: "under",
  cooktop: "induction-60",
  dishwasher: true,
  sink: true,
  hood: "under-cabinet",
  wallCabinets: true,
  frontId: FRONTS[0].id,
  handleId: HANDLES[0].id,
  worktopId: WORKTOPS[0].id,
};

const PRODUCT = Object.fromEntries(DEMO_PRODUCTS.map((p) => [p.id, p]));
const prod = (slug: string): Product => {
  const p = PRODUCT[`demo-${slug}`];
  if (!p) throw new Error(`Prodotto cucina mancante: ${slug}`);
  return p;
};

/**
 * Riempie `space` cm con moduli di larghezza standard minimizzando il numero
 * di moduli (preferendo i 60) e restituisce il compensatore residuo.
 */
export function fillWidths(space: number, widths = BASE_WIDTHS): { widths: number[]; filler: number } {
  const units = Math.max(0, Math.floor(space / 10));
  const cost = (w: number) => (w === 60 ? 1 : w === 80 ? 1.05 : w === 40 ? 1.2 : 1.3);
  const best: { cost: number; from: number; w: number }[] = Array(units + 1).fill(null);
  best[0] = { cost: 0, from: -1, w: 0 };
  for (let s = 1; s <= units; s++) {
    for (const w of widths) {
      const k = w / 10;
      if (s - k < 0 || !best[s - k]) continue;
      const c = best[s - k].cost + cost(w);
      if (!best[s] || c < best[s].cost) best[s] = { cost: c, from: s - k, w };
    }
  }
  let s = units;
  while (s > 0 && !best[s]) s--;
  const out: number[] = [];
  for (let cur = s; cur > 0; cur = best[cur].from) out.push(best[cur].w);
  out.sort((a, b) => b - a);
  const filler = Math.round((space - s * 10) * 10) / 10;
  return { widths: out, filler };
}

const mod = (kind: string, width: number, variant?: string, applianceId?: string): KitchenModule => ({
  id: uid("k"),
  kind,
  width,
  ...(variant ? { variant } : {}),
  ...(applianceId ? { applianceId } : {}),
});

function cooktopModule(c: KitchenChoices): KitchenModule | null {
  if (c.cooktop === "none") return null;
  const width = c.cooktop === "induction-80" ? 80 : 60;
  const appliance = c.cooktop === "gas-60" ? "demo-piano-gas" : c.cooktop === "induction-80" ? "demo-piano-induzione-80" : "demo-piano-induzione";
  return mod("base", width, c.oven === "under" ? "piano-forno" : "piano", appliance);
}

function talls(c: KitchenChoices): KitchenModule[] {
  const out: KitchenModule[] = [];
  if (c.fridge === "tall") out.push(mod("tall", 60, "frigo", "demo-frigo-incasso"));
  if (c.fridge === "freestanding") out.push(mod("appliance-slot", 60, "frigo-libero", "demo-frigo-libera"));
  if (c.oven === "tall") out.push(mod("tall", 60, "forno", "demo-forno-incasso"));
  return out;
}

/** Riempie lo spazio libero e restituisce i moduli in ordine, con il compensatore in fondo. */
function withFill(space: number, groups: KitchenModule[][], splitAt: number[]): KitchenModule[] {
  const { widths, filler } = fillWidths(space);
  const fills = widths.map((w, i) => mod("base", w, i === 0 && w === 60 ? "cassetti" : "ante"));
  // Distribuisce i moduli di riempimento tra i gruppi richiesti.
  const out: KitchenModule[] = [];
  let fi = 0;
  groups.forEach((g, gi) => {
    const take = splitAt[gi] ?? 0;
    for (let k = 0; k < take && fi < fills.length; k++) out.push(fills[fi++]);
    out.push(...g);
  });
  while (fi < fills.length) out.push(fills[fi++]);
  if (filler >= 1) out.push(mod("filler", filler));
  return out;
}

/** Pensili allineati ai moduli base (cappa sopra il piano cottura, scolapiatti sopra il lavello). */
function wallRow(base: KitchenModule[], c: KitchenChoices): KitchenModule[] {
  if (!c.wallCabinets && c.hood === "none") return [];
  return base.map((b) => {
    const isCooktop = b.variant === "piano" || b.variant === "piano-forno";
    if (isCooktop) {
      if (c.hood === "under-cabinet") return mod("wall", b.width, "cappa", "demo-cappa-60");
      if (c.hood === "wall-90") return mod("hood", b.width, "cappa-libera", "demo-cappa-90");
      return c.wallCabinets && WALL_WIDTHS.includes(b.width) ? mod("wall", b.width, "ante") : mod("gap", b.width);
    }
    if (!c.wallCabinets || b.kind === "corner" || b.kind === "tall" || b.variant === "frigo-libero") return mod("gap", b.width);
    if (b.variant === "lavello" && b.width === 80) return mod("wall", 80, "scolapiatti");
    if (WALL_WIDTHS.includes(b.width)) return mod("wall", b.width, "ante");
    return mod("gap", b.width);
  });
}

export function composeKitchen(room: Room, c: KitchenChoices): KitchenConfig {
  const required: KitchenModule[] = [];
  if (c.sink) required.push(mod("base", 80, "lavello", "demo-lavello-inox"));
  if (c.dishwasher) required.push(mod("appliance-slot", 60, "lavastoviglie", "demo-lavastoviglie"));
  const cook = cooktopModule(c);
  const tallMods = talls(c);
  const sum = (ms: KitchenModule[]) => ms.reduce((a, m) => a + m.width, 0);
  const n = room.polygon.length;
  const runs: KitchenRun[] = [];

  if (c.layout === "linear") {
    const wall = room.walls[c.wallIndex];
    const len = edgeLength(room.polygon, c.wallIndex);
    const length = Math.max(60, Math.min(c.length, len - c.start));
    const free = length - sum(tallMods) - sum(required) - (cook ? cook.width : 0);
    const groups = [required, cook ? [cook] : []];
    const half = Math.floor(fillWidths(Math.max(0, free)).widths.length / 2);
    const base = [...tallMods, ...withFill(Math.max(0, free), groups, [half, 1])];
    runs.push({ id: uid("run"), wallId: wall.id, start: c.start, length, base, wall: wallRow(base, c) });
  } else {
    const iA = c.wallIndex;
    const iB = (c.wallIndex + 1) % n;
    const lenA = edgeLength(room.polygon, iA);
    const lenB = edgeLength(room.polygon, iB);
    const lengthA = Math.max(CORNER_WIDTH + 60, Math.min(c.length, lenA));
    const lengthB = Math.max(60, Math.min(c.lengthB, lenB - CORNER_WIDTH));
    // Lato A: lavello e lavastoviglie, modulo ad angolo alla fine.
    const corner = mod("corner", CORNER_WIDTH, "angolo");
    const freeA = lengthA - sum(required) - CORNER_WIDTH;
    const baseA = [...withFill(Math.max(0, freeA), [required], [0]), corner];
    // Il compensatore deve restare lontano dall'angolo: si sposta all'inizio.
    const fA = baseA.findIndex((m) => m.kind === "filler");
    if (fA >= 0) baseA.unshift(...baseA.splice(fA, 1));
    // Lato B: piano cottura vicino all'angolo, colonne in fondo.
    const freeB = lengthB - sum(tallMods) - (cook ? cook.width : 0);
    const fillB = withFill(Math.max(0, freeB), [cook ? [cook] : []], [1]);
    const baseB = [...fillB, ...tallMods];
    runs.push({ id: uid("run"), wallId: room.walls[iA].id, start: lenA - lengthA, length: lengthA, base: baseA, wall: wallRow(baseA, c) });
    // Il lato B parte dopo il quadrato occupato dal modulo d'angolo.
    runs.push({ id: uid("run"), wallId: room.walls[iB].id, start: CORNER_WIDTH, length: lengthB, base: baseB, wall: wallRow(baseB, c) });
  }

  return {
    layout: c.layout,
    runs: runs.map((r) => avoidWindows(room, r, 145)),
    frontId: c.frontId,
    handleId: c.handleId,
    worktopId: c.worktopId,
    baseHeight: 90,
    wallElevation: 145,
    appliances: {
      fridge: c.fridge,
      oven: c.oven,
      cooktop: c.cooktop,
      dishwasher: c.dishwasher ? "yes" : "no",
      sink: c.sink ? "yes" : "no",
      hood: c.hood,
      wallCabinets: c.wallCabinets ? "yes" : "no",
      wallIndex: String(c.wallIndex),
      lengthB: String(c.lengthB),
    },
  };
}

/** Niente pensili davanti alle finestre: il modulo diventa uno spazio vuoto. */
function avoidWindows(room: Room, run: KitchenRun, wallElevation: number): KitchenRun {
  const windows = room.openings.filter((o) => o.wallId === run.wallId && o.kind === "window" && o.sill < wallElevation + WALL_HEIGHT);
  if (!windows.length) return run;
  let s = run.start;
  const wall = run.wall.map((m) => {
    const a = s;
    s += m.width;
    const overlaps = windows.some((o) => o.offset < a + m.width - 1 && o.offset + o.width > a + 1);
    return overlaps && (m.kind === "wall" || m.kind === "hood") ? { ...m, kind: "gap", variant: undefined, applianceId: undefined } : m;
  });
  return { ...run, wall };
}

/** Scelte correnti ricavate da una configurazione salvata (per riaprire il configuratore). */
export function choicesFromConfig(room: Room, k: KitchenConfig): KitchenChoices {
  const a = k.appliances;
  const first = k.runs[0];
  const wallIndex = Number(a.wallIndex ?? Math.max(0, room.walls.findIndex((w) => w.id === first?.wallId)));
  return {
    layout: k.layout,
    wallIndex,
    start: k.layout === "linear" ? (first?.start ?? 0) : 0,
    length: first?.length ?? 300,
    lengthB: Number(a.lengthB ?? k.runs[1]?.length ?? 200),
    fridge: (a.fridge as KitchenChoices["fridge"]) ?? "tall",
    oven: (a.oven as KitchenChoices["oven"]) ?? "under",
    cooktop: (a.cooktop as KitchenChoices["cooktop"]) ?? "induction-60",
    dishwasher: a.dishwasher !== "no",
    sink: a.sink !== "no",
    hood: (a.hood as KitchenChoices["hood"]) ?? "under-cabinet",
    wallCabinets: a.wallCabinets !== "no",
    frontId: k.frontId,
    handleId: k.handleId,
    worktopId: k.worktopId,
  };
}

function moduleProduct(m: KitchenModule): Product | null {
  if (m.kind === "corner") return prod("base-angolo");
  if (m.kind === "tall") return prod(m.variant === "forno" ? "colonna-forno" : m.variant === "frigo" ? "colonna-frigo" : "colonna-dispensa");
  if (m.kind === "base") {
    if (m.variant === "lavello") return prod("base-lavello-80");
    if (m.variant === "cassetti" && m.width === 60) return prod("base-60-cassetti");
    return PRODUCT[`demo-base-${m.width}`] ?? null;
  }
  if (m.kind === "wall") {
    if (m.variant === "scolapiatti") return prod("pensile-scolapiatti");
    return PRODUCT[`demo-pensile-${m.width}`] ?? null;
  }
  return null;
}

function fillerProduct(width: number, height: number, depth: number, wall: boolean): Product {
  return {
    id: `kitchen-filler-${wall ? "wall" : "base"}`,
    source: "demo",
    retailer: "Demo Arredo",
    code: "DM-FILL",
    name: wall ? "Compensatore pensile" : "Compensatore base",
    category: "Cucina",
    subcategory: "Accessori",
    width,
    depth,
    height,
    price: FILLER_PRICE,
    currency: "EUR",
    mount: wall ? "wall" : "floor",
    clearance: { front: 0, sides: 0 },
    shape: "cabinet",
    priceUpdatedAt: KITCHEN_PRICE_DATE,
  };
}

function worktopProduct(worktopId: string, length: number): Product {
  const w = WORKTOP_BY_ID[worktopId] ?? WORKTOPS[0];
  const meters = Math.ceil(length / 10) / 10;
  return {
    id: `kitchen-top-${w.id}-${Math.round(length)}`,
    source: "demo",
    retailer: "Demo Arredo",
    code: "DM-TOP",
    name: `Top ${w.label.toLowerCase()} ${meters.toLocaleString("it-IT")} m`,
    category: "Cucina",
    subcategory: "Top",
    width: length,
    depth: 62,
    height: w.thickness,
    price: Math.round(meters * w.pricePerMeter),
    currency: "EUR",
    color: w.label,
    colorHex: w.color,
    mount: "floor",
    clearance: { front: 0, sides: 0 },
    shape: "worktop",
    priceUpdatedAt: KITCHEN_PRICE_DATE,
  };
}

const withFront = (p: Product, color: string): Product => ({ ...p, colorHex: color, clearance: { ...p.clearance } });

/** Oggetti in pianta (coordinate locali della stanza) generati dalla configurazione. */
export function kitchenItems(room: Room, k: KitchenConfig): PlacedItem[] {
  const front = FRONT_BY_ID[k.frontId] ?? FRONTS[0];
  const es = edges(room.polygon);
  const items: PlacedItem[] = [];
  for (const run of k.runs) {
    const idx = room.walls.findIndex((w) => w.id === run.wallId);
    const e = es[idx];
    if (!e) continue;
    const inward = mul(e.normal, -1);
    const rotation = rotationFacingAwayFrom(e.normal);
    const at = (s: number, depth: number) => add(add(e.a, mul(e.dir, s)), mul(inward, depth / 2));
    const push = (product: Product, s: number, depth: number, elevation: number, role: string, slot: number) => {
      const c = at(s, depth);
      items.push({
        id: uid("i"),
        product,
        x: Math.round(c.x * 10) / 10,
        y: Math.round(c.y * 10) / 10,
        rotation,
        elevation,
        quantity: 1,
        kitchen: { runId: run.id, slot, role },
      });
    };
    // Moduli base, colonne ed elettrodomestici.
    let s = run.start;
    let topFrom: number | null = null;
    const tops: [number, number][] = [];
    run.base.forEach((m, i) => {
      const mid = s + m.width / 2;
      const isTop = m.kind === "base" || m.kind === "corner" || m.kind === "filler" || m.variant === "lavastoviglie";
      if (isTop && topFrom === null) topFrom = s;
      if (!isTop && topFrom !== null) {
        tops.push([topFrom, s]);
        topFrom = null;
      }
      if (m.kind === "filler") push(withFront(fillerProduct(m.width, 88, BASE_DEPTH, false), front.color), mid, BASE_DEPTH, 0, "filler", i);
      const p = moduleProduct(m);
      if (p) push(withFront(p, front.color), mid, p.depth, 0, m.kind, i);
      if (m.applianceId) {
        const a = PRODUCT[m.applianceId];
        if (a) {
          const panel = m.variant === "lavastoviglie" || m.variant === "frigo";
          const elev =
            m.variant === "frigo" ? 15 : m.variant === "forno" ? 95 : m.variant === "lavastoviglie" || m.variant === "frigo-libero" ? 0 : m.variant === "lavello" ? 72 : k.baseHeight - 2;
          push(panel ? withFront(a, front.color) : a, mid, a.depth, elev, "appliance", i);
        }
      }
      if (m.variant === "piano-forno") push(prod("forno-incasso"), mid, 57, 20, "appliance", i);
      s += m.width;
    });
    if (topFrom !== null) tops.push([topFrom, s]);
    for (const [a, b] of tops) push(worktopProduct(k.worktopId, b - a), (a + b) / 2, 62, k.baseHeight - (WORKTOP_BY_ID[k.worktopId]?.thickness ?? 4), "worktop", -1);
    // Pensili e cappe.
    s = run.start;
    run.wall.forEach((m, i) => {
      const mid = s + m.width / 2;
      if (m.kind === "wall") {
        const p = moduleProduct(m);
        if (p) push(withFront(p, front.color), mid, WALL_DEPTH, k.wallElevation, "wall", i);
        if (m.variant === "cappa" && m.applianceId) push(PRODUCT[m.applianceId], mid, 30, k.wallElevation - 15, "appliance", i);
      } else if (m.kind === "hood" && m.applianceId) {
        push(PRODUCT[m.applianceId], mid, 50, k.wallElevation + 5, "appliance", i);
      }
      s += m.width;
    });
  }
  return items;
}

/** Righe di prezzo della cucina non legate a un oggetto: sovrapprezzo frontali, maniglie, zoccolo. */
export function kitchenExtras(room: Room): QuoteLineInput[] {
  const k = room.kitchen;
  if (!k) return [];
  const front = FRONT_BY_ID[k.frontId] ?? FRONTS[0];
  const handle = HANDLE_BY_ID[k.handleId] ?? HANDLES[0];
  let frontWidth = 0;
  let handles = 0;
  let baseMeters = 0;
  for (const run of k.runs) {
    for (const m of run.base) {
      if (m.kind === "base" || m.kind === "corner" || m.kind === "tall" || m.variant === "lavastoviglie") frontWidth += m.width;
      if (m.kind === "base") handles += m.variant === "cassetti" ? 3 : m.width >= 80 ? 2 : 1;
      if (m.kind === "corner") handles += 1;
      if (m.kind === "tall") handles += 2;
      if (m.variant === "lavastoviglie") handles += 1;
      if (m.kind !== "tall" && m.variant !== "frigo-libero") baseMeters += m.width / 100;
    }
    for (const m of run.wall) if (m.kind === "wall") {
      frontWidth += m.width;
      handles += 1;
    }
  }
  const lines: QuoteLineInput[] = [];
  const base = { retailer: "Demo Arredo", currency: "EUR", priceUpdatedAt: KITCHEN_PRICE_DATE, isDemo: true, category: "Cucina" };
  if (front.pricePerCm > 0)
    lines.push({ ...base, productId: `kitchen-front-${front.id}`, name: `Frontali ${front.label.toLowerCase()} (sovrapprezzo)`, unitPrice: Math.round(frontWidth * front.pricePerCm), quantity: 1 });
  if (handle.perMeter)
    lines.push({ ...base, productId: `kitchen-handle-${handle.id}`, name: handle.label, unitPrice: handle.price, quantity: Math.max(1, Math.ceil(baseMeters)) });
  else if (handles > 0)
    lines.push({ ...base, productId: `kitchen-handle-${handle.id}`, name: `Maniglia ${handle.label.toLowerCase()}`, unitPrice: handle.price, quantity: handles });
  if (baseMeters > 0)
    lines.push({ ...base, productId: "kitchen-plinth", name: "Zoccolo", unitPrice: PLINTH_PRICE_PER_METER, quantity: Math.max(1, Math.ceil(baseMeters)) });
  return lines;
}

/** Sostituisce gli oggetti della cucina nella stanza con quelli della nuova configurazione. */
export function applyKitchen(room: Room, k: KitchenConfig | null): Room {
  const others = room.items.filter((i) => !i.kitchen);
  if (!k) return { ...room, kitchen: undefined, items: others };
  return { ...room, kitchen: k, items: [...others, ...kitchenItems(room, k)] };
}

/** Somma delle larghezze dei moduli di una fila. */
export const runWidth = (mods: KitchenModule[]) => mods.reduce((a, m) => a + m.width, 0);
