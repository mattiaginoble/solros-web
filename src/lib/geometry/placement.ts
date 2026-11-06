/**
 * Posizionamento degli oggetti nelle stanze: snap alle pareti, al centro stanza
 * e agli altri oggetti, analisi di collisioni, porte bloccate e ingombri.
 * Tutto in coordinate locali della stanza.
 */
import type { Opening, PlacedItem, Room } from "@/domain/schema";
import { type OBB, convexOverlap, obbCorners, obbInsidePolygon, obbOverlap, verticalOverlap } from "./collision";
import { bbox, centroid, edges } from "./polygon";
import { type Vec2, add, angleDeg, dot, mul, normalizeAngle, rotate, sub } from "./vec";

export function itemOBB(item: Pick<PlacedItem, "x" | "y" | "rotation" | "product">): OBB {
  return { center: { x: item.x, y: item.y }, width: item.product.width, depth: item.product.depth, rotation: item.rotation };
}

/** Intervallo verticale occupato dall'oggetto (cm da terra). */
export function itemVerticalRange(item: PlacedItem, ceilingHeight: number): [number, number] {
  if (item.product.mount === "ceiling") return [ceilingHeight - item.product.height, ceilingHeight];
  return [item.elevation, item.elevation + item.product.height];
}

/** Zona di rispetto frontale (apertura ante, spazio di passaggio) come OBB, se definita. */
export function clearanceOBB(item: PlacedItem): OBB | null {
  const { front, sides } = item.product.clearance;
  if (front <= 0 && sides <= 0) return null;
  const { width, depth } = item.product;
  const uy = rotate({ x: 0, y: 1 }, item.rotation);
  const d = Math.max(front, 0);
  const center = add({ x: item.x, y: item.y }, mul(uy, depth / 2 + d / 2));
  return { center, width: width + sides * 2, depth: Math.max(d, 1), rotation: item.rotation };
}

/** Rotazione che porta il retro dell'oggetto verso un muro con normale esterna `n`. */
export function rotationFacingAwayFrom(n: Vec2): number {
  return normalizeAngle(Math.round(angleDeg(n) + 90));
}

/** Mezza estensione dell'oggetto lungo una direzione. */
function halfExtent(item: Pick<PlacedItem, "rotation" | "product">, dir: Vec2) {
  const ux = rotate({ x: 1, y: 0 }, item.rotation);
  const uy = rotate({ x: 0, y: 1 }, item.rotation);
  return (Math.abs(dot(ux, dir)) * item.product.width) / 2 + (Math.abs(dot(uy, dir)) * item.product.depth) / 2;
}

export interface SnapGuide {
  from: Vec2;
  to: Vec2;
  kind: "wall" | "center" | "align";
}

export interface ItemSnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
  /** Muro a cui l'oggetto è appoggiato (se c'è). */
  wallIndex: number | null;
}

/**
 * Snap di un oggetto durante il trascinamento: appoggio ai muri (anche in
 * angolo), allineamento al centro stanza e ad altri oggetti.
 */
export function snapItem(
  room: Room,
  item: PlacedItem,
  pos: Vec2,
  others: PlacedItem[],
  tolerance = 15,
): ItemSnapResult {
  let p = { ...pos };
  const guides: SnapGuide[] = [];
  let wallIndex: number | null = null;
  const es = edges(room.polygon);

  // 1) Muri: il lato dell'oggetto rivolto al muro si appoggia alla faccia interna.
  const snappedNormals: Vec2[] = [];
  const candidates = es
    .map((e) => {
      const inward = mul(e.normal, -1);
      const ext = halfExtent(item, e.normal);
      const dist = dot(sub(p, e.a), inward) - ext; // distanza tra bordo oggetto e muro
      const s = dot(sub(p, e.a), e.dir);
      const along = halfExtent(item, e.dir);
      const withinSpan = s > -along + 1 && s < e.length + along - 1;
      return { e, dist, ext, withinSpan };
    })
    .filter((c) => c.withinSpan && Math.abs(c.dist) <= tolerance)
    .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
  for (const c of candidates) {
    if (snappedNormals.some((n) => Math.abs(dot(n, c.e.normal)) > 0.99)) continue;
    // Si sposta solo lungo la normale del muro.
    p = add(p, mul(c.e.normal, c.dist));
    snappedNormals.push(c.e.normal);
    if (wallIndex === null) wallIndex = c.e.index;
    guides.push({ from: c.e.a, to: c.e.b, kind: "wall" });
    if (snappedNormals.length === 2) break;
  }

  // 2) Centro stanza (assi locali).
  const c = centroid(room.polygon);
  const b = bbox(room.polygon);
  if (!snappedNormals.some((n) => Math.abs(n.x) > 0.99) && Math.abs(p.x - c.x) <= tolerance / 2) {
    p.x = c.x;
    guides.push({ from: { x: c.x, y: b.minY }, to: { x: c.x, y: b.maxY }, kind: "center" });
  }
  if (!snappedNormals.some((n) => Math.abs(n.y) > 0.99) && Math.abs(p.y - c.y) <= tolerance / 2) {
    p.y = c.y;
    guides.push({ from: { x: b.minX, y: c.y }, to: { x: b.maxX, y: c.y }, kind: "center" });
  }

  // 3) Allineamento con altri oggetti (centri e bordi di oggetti non ruotati in modo obliquo).
  const me = { ...item, x: p.x, y: p.y };
  const myBox = bbox(obbCorners(itemOBB(me)));
  let alignedX = snappedNormals.some((n) => Math.abs(n.x) > 0.99) || guides.some((g) => g.kind === "center" && g.from.x === g.to.x);
  let alignedY = snappedNormals.some((n) => Math.abs(n.y) > 0.99) || guides.some((g) => g.kind === "center" && g.from.y === g.to.y);
  for (const o of others) {
    if (alignedX && alignedY) break;
    const ob = bbox(obbCorners(itemOBB(o)));
    if (!alignedX) {
      const pairs: [number, number][] = [
        [(myBox.minX + myBox.maxX) / 2, (ob.minX + ob.maxX) / 2],
        [myBox.minX, ob.minX],
        [myBox.maxX, ob.maxX],
        [myBox.minX, ob.maxX],
        [myBox.maxX, ob.minX],
      ];
      for (const [mine, theirs] of pairs) {
        if (Math.abs(mine - theirs) <= tolerance / 3) {
          p.x += theirs - mine;
          guides.push({ from: { x: theirs, y: Math.min(myBox.minY, ob.minY) }, to: { x: theirs, y: Math.max(myBox.maxY, ob.maxY) }, kind: "align" });
          alignedX = true;
          break;
        }
      }
    }
    if (!alignedY) {
      const pairs: [number, number][] = [
        [(myBox.minY + myBox.maxY) / 2, (ob.minY + ob.maxY) / 2],
        [myBox.minY, ob.minY],
        [myBox.maxY, ob.maxY],
        [myBox.minY, ob.maxY],
        [myBox.maxY, ob.minY],
      ];
      for (const [mine, theirs] of pairs) {
        if (Math.abs(mine - theirs) <= tolerance / 3) {
          p.y += theirs - mine;
          guides.push({ from: { x: Math.min(myBox.minX, ob.minX), y: theirs }, to: { x: Math.max(myBox.maxX, ob.maxX), y: theirs }, kind: "align" });
          alignedY = true;
          break;
        }
      }
    }
  }

  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, guides, wallIndex };
}

/**
 * Posizione iniziale quando un oggetto viene rilasciato: se è vicino a un muro
 * (entro `reach` cm) viene ruotato con il retro verso il muro e appoggiato.
 */
export function placeNearWall(room: Room, item: PlacedItem, pos: Vec2, reach = 60): Pick<PlacedItem, "x" | "y" | "rotation"> {
  let best: { e: ReturnType<typeof edges>[number]; dist: number } | null = null;
  for (const e of edges(room.polygon)) {
    const s = dot(sub(pos, e.a), e.dir);
    if (s < 0 || s > e.length) continue;
    const dist = dot(sub(pos, e.a), mul(e.normal, -1));
    if (dist < 0 || dist > reach + item.product.depth / 2) continue;
    if (!best || dist < best.dist) best = { e, dist };
  }
  if (!best) return { x: pos.x, y: pos.y, rotation: item.rotation };
  const rotation = rotationFacingAwayFrom(best.e.normal);
  const inward = mul(best.e.normal, -1);
  const s = Math.max(item.product.width / 2, Math.min(best.e.length - item.product.width / 2, dot(sub(pos, best.e.a), best.e.dir)));
  const p = add(add(best.e.a, mul(best.e.dir, s)), mul(inward, item.product.depth / 2));
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, rotation };
}

export interface DoorZone {
  opening: Opening;
  /** Area spazzata dall'anta o area di passaggio, in coordinate locali. */
  zone: Vec2[];
}

/**
 * Aree che devono restare libere davanti alle aperture della stanza:
 * il quadrato spazzato dall'anta per le porte che aprono verso l'interno,
 * una fascia di passaggio per porte che aprono verso l'esterno e passaggi.
 */
export function doorZones(room: Room): DoorZone[] {
  const es = edges(room.polygon);
  const out: DoorZone[] = [];
  for (const o of room.openings) {
    if (o.kind === "window") continue;
    const idx = room.walls.findIndex((w) => w.id === o.wallId);
    const e = es[idx];
    if (!e) continue;
    const inward = mul(e.normal, -1);
    const a = add(e.a, mul(e.dir, o.offset));
    const b = add(e.a, mul(e.dir, o.offset + o.width));
    const depth = o.kind === "door" && o.swing === "in" ? o.width : 50;
    out.push({ opening: o, zone: [a, b, add(b, mul(inward, depth)), add(a, mul(inward, depth))] });
  }
  return out;
}

export type ItemIssue =
  | { kind: "outside" }
  | { kind: "collision"; itemId: string; name: string }
  | { kind: "blocks-door"; openingId: string; openingKind: Opening["kind"] }
  | { kind: "clearance"; itemId?: string; name?: string }
  | { kind: "too-tall" };

const IGNORE_COLLISIONS = new Set(["rug"]);
/** Coppie di forme che possono sovrapporsi (le sedie si infilano sotto tavoli e scrivanie). */
const ALLOWED_OVERLAPS = new Set(["chair|table", "table|chair", "chair|desk", "desk|chair"]);
/** Forme con ante, cassetti o sportelli: per queste l'ingombro frontale deve restare libero. */
const OPENING_CLEARANCE_SHAPES = new Set([
  "wardrobe",
  "cabinet",
  "tv-unit",
  "nightstand",
  "fridge",
  "oven",
  "dishwasher",
  "washer",
  "appliance",
  "sink",
  "washbasin",
]);

/** Problemi di posizionamento di ogni oggetto della stanza. */
export function analyzeRoomItems(room: Room): Map<string, ItemIssue[]> {
  const result = new Map<string, ItemIssue[]>();
  const zones = doorZones(room);
  const obbs = room.items.map((it) => itemOBB(it));
  const ranges = room.items.map((it) => itemVerticalRange(it, room.ceilingHeight));
  room.items.forEach((it, i) => {
    const issues: ItemIssue[] = [];
    const shape = it.product.shape ?? "box";
    if (!obbInsidePolygon(obbs[i], room.polygon)) issues.push({ kind: "outside" });
    if (shape !== "stairs" && ranges[i][1] > room.ceilingHeight + 0.5) issues.push({ kind: "too-tall" });
    if (!IGNORE_COLLISIONS.has(shape)) {
      room.items.forEach((other, j) => {
        if (i === j || IGNORE_COLLISIONS.has(other.product.shape ?? "box")) return;
        if (!verticalOverlap(ranges[i], ranges[j])) return;
        if (ALLOWED_OVERLAPS.has(`${shape}|${other.product.shape ?? "box"}`)) return;
        if (obbOverlap(obbs[i], obbs[j])) issues.push({ kind: "collision", itemId: other.id, name: other.product.name });
      });
      // Le porte bloccano gli oggetti a terra fino a 200 cm di altezza.
      if (it.product.mount !== "ceiling" && ranges[i][0] < 200) {
        const corners = obbCorners(obbs[i]);
        for (const z of zones) {
          if (convexOverlap(corners, z.zone, 0.5))
            issues.push({ kind: "blocks-door", openingId: z.opening.id, openingKind: z.opening.kind });
        }
      }
      const cl = OPENING_CLEARANCE_SHAPES.has(shape) ? clearanceOBB(it) : null;
      if (cl && it.product.clearance.front > 0) {
        const clCorners = obbCorners(cl);
        let blocked = false;
        room.items.forEach((other, j) => {
          if (blocked || i === j || IGNORE_COLLISIONS.has(other.product.shape ?? "box")) return;
          if (ALLOWED_OVERLAPS.has(`chair|${other.product.shape ?? "box"}`) && other.product.shape === "chair") return;
          if (other.product.mount !== "floor" || ranges[j][0] > 100) return;
          if (convexOverlap(clCorners, obbCorners(obbs[j]), 0.5)) {
            blocked = true;
            issues.push({ kind: "clearance", itemId: other.id, name: other.product.name });
          }
        });
        if (!blocked && !obbInsidePolygon(cl, room.polygon, 1)) issues.push({ kind: "clearance" });
      }
    }
    result.set(it.id, issues);
  });
  return result;
}

export function describeIssue(issue: ItemIssue): string {
  switch (issue.kind) {
    case "outside":
      return "Esce dalla stanza o attraversa un muro";
    case "collision":
      return `Si sovrappone a: ${issue.name}`;
    case "blocks-door":
      return issue.openingKind === "door" ? "Blocca l’apertura di una porta" : "Ostruisce un passaggio";
    case "clearance":
      return issue.name ? `Spazio di apertura occupato da: ${issue.name}` : "Spazio di apertura insufficiente verso il muro";
    case "too-tall":
      return "Più alto del soffitto";
  }
}

/** Vero se l'oggetto non può entrare nella stanza in nessuna rotazione a 90°. */
export function doesNotFit(room: Room, width: number, depth: number): boolean {
  const b = bbox(room.polygon);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return !((width <= w && depth <= h) || (depth <= w && width <= h));
}

/**
 * Cerca una posizione libera per un nuovo oggetto: prima lungo le pareti (con il
 * retro al muro), poi su una griglia interna. Restituisce null se non trova spazio.
 */
export function findFreeSpot(room: Room, item: PlacedItem, step = 20): Pick<PlacedItem, "x" | "y" | "rotation"> | null {
  const fits = (cand: PlacedItem) => {
    const test = { ...room, items: [...room.items, cand] };
    const issues = analyzeRoomItems(test).get(cand.id) ?? [];
    return issues.length === 0;
  };
  if (item.product.mount !== "ceiling") {
    for (const e of edges(room.polygon)) {
      const inward = mul(e.normal, -1);
      for (let s = item.product.width / 2; s <= e.length - item.product.width / 2; s += step) {
        const probe = add(add(e.a, mul(e.dir, s)), mul(inward, item.product.depth / 2 + 1));
        const placed = placeNearWall(room, item, probe, 5);
        const cand = { ...item, ...placed };
        if (fits(cand)) return placed;
      }
    }
  }
  const b = bbox(room.polygon);
  const c = centroid(room.polygon);
  const pts: Vec2[] = [];
  for (let y = b.minY + step; y < b.maxY; y += step) for (let x = b.minX + step; x < b.maxX; x += step) pts.push({ x, y });
  pts.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
  for (const p of pts) {
    const cand = { ...item, x: p.x, y: p.y };
    if (fits(cand)) return { x: p.x, y: p.y, rotation: item.rotation };
  }
  return null;
}
