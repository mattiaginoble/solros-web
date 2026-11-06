/** Azioni di alto livello dell'editor, condivise da barra strumenti, scorciatoie e pannelli. */
import { OPENING_DEFAULTS } from "@/domain/constants";
import { cloneRoomWithNewIds, createFloor, createOpening, createPlacedItem, uid } from "@/domain/factory";
import type { Floor, House, OpeningKind, PlacedItem, Product, Room } from "@/domain/schema";
import { applyMatchThickness, joinRooms } from "@/lib/geometry/houseSnap";
import { adjacentFloor, recomputeElevations } from "@/domain/floors";
export { adjacentFloor, recomputeElevations };
import { computeFloorWalls, wallKey } from "@/lib/geometry/walls";
import { addOpening, nearestWallInRooms, removeVertex } from "@/domain/roomOps";
import { bbox, bboxUnion, centroid, edgeLength, pointInPolygon } from "@/lib/geometry/polygon";
import { doesNotFit, findFreeSpot, placeNearWall } from "@/lib/geometry/placement";
import { dirToLocal, localToWorld, roomWorldPolygon, rotateRoomTransform, worldToLocal } from "@/lib/geometry/transform";
import type { Vec2 } from "@/lib/geometry/vec";
import { activeFloor, findRoom, useEditor } from "./editor";
import { useView2D, viewCenterWorld } from "./view2d";

const st = () => useEditor.getState();

export function floorBBox(rooms: Room[]) {
  if (rooms.length === 0) return null;
  return rooms.map((r) => bbox(roomWorldPolygon(r))).reduce(bboxUnion);
}

/** Aggiunge una stanza al piano attivo. Se `place` è "auto" la affianca alle esistenti. */
export function addRoom(room: Room, opts: { place?: "auto" | "center" | "keep"; focus?: boolean } = {}) {
  const floor = activeFloor(st());
  let r = room;
  const place = opts.place ?? "auto";
  if (place !== "keep") {
    const own = bbox(roomWorldPolygon({ ...room, x: 0, y: 0 }));
    const box = floorBBox(floor.rooms);
    let target: Vec2;
    if (place === "auto" && box) {
      target = { x: box.maxX + 100 - own.minX, y: box.minY - own.minY };
    } else {
      const c = viewCenterWorld();
      target = {
        x: Math.round((c.x - (own.maxX - own.minX) / 2) / 10) * 10 - own.minX,
        y: Math.round((c.y - (own.maxY - own.minY) / 2) / 10) * 10 - own.minY,
      };
    }
    r = { ...room, x: target.x, y: target.y };
  }
  st().apply((h) => {
    const f = h.floors.find((x) => x.id === floor.id);
    f?.rooms.push(r);
  });
  if (opts.focus) st().focusRoom(r.id);
  else st().select({ kind: "room", roomId: r.id });
  return r;
}

export function fitToFloor() {
  const floor = activeFloor(st());
  const box = floorBBox(floor.rooms);
  if (box) useView2D.getState().fit(box);
}

export function fitToRoom(roomId: string) {
  const loc = findRoom(st().house, roomId);
  if (!loc) return;
  useView2D.getState().fit(bbox(roomWorldPolygon(loc.room)), 120);
}

export function deleteSelection() {
  const { selection, updateRoom, apply, select, focusedRoomId, readOnly } = st();
  if (!selection || readOnly) return;
  switch (selection.kind) {
    case "room": {
      apply((h) => {
        for (const f of h.floors) f.rooms = f.rooms.filter((r) => r.id !== selection.roomId);
      });
      if (focusedRoomId === selection.roomId) st().focusRoom(null);
      select(null);
      break;
    }
    case "opening":
      updateRoom(selection.roomId, (r) => ({ ...r, openings: r.openings.filter((o) => o.id !== selection.openingId) }));
      select({ kind: "room", roomId: selection.roomId });
      break;
    case "item":
      updateRoom(selection.roomId, (r) => ({ ...r, items: r.items.filter((i) => i.id !== selection.itemId) }));
      select({ kind: "room", roomId: selection.roomId });
      break;
    case "vertex": {
      const loc = findRoom(st().house, selection.roomId);
      if (!loc) return;
      if (loc.room.polygon.length <= 3) {
        st().notify("Una stanza deve avere almeno 3 vertici", "warning");
        return;
      }
      updateRoom(selection.roomId, (r) => removeVertex(r, selection.index));
      select({ kind: "room", roomId: selection.roomId });
      break;
    }
    case "wall":
      st().notify("I muri seguono il perimetro della stanza: modifica i vertici o elimina la stanza", "info");
      break;
  }
}

export function duplicateSelection() {
  const { selection, house, updateRoom, select, readOnly } = st();
  if (!selection || readOnly) return;
  const loc = findRoom(house, selection.roomId);
  if (!loc) return;
  if (selection.kind === "room") {
    const b = bbox(roomWorldPolygon(loc.room));
    const copy = cloneRoomWithNewIds(loc.room, { x: b.maxX - b.minX + 60, y: 0 });
    copy.name = `${loc.room.name} (copia)`;
    st().apply((h) => {
      h.floors[loc.floorIndex].rooms.push(copy);
    });
    select({ kind: "room", roomId: copy.id });
  } else if (selection.kind === "item") {
    const item = loc.room.items.find((i) => i.id === selection.itemId);
    if (!item) return;
    const copy = { ...structuredClone(item), id: uid("i"), x: item.x + 20, y: item.y + 20 };
    copy.kitchen = undefined;
    updateRoom(loc.room.id, (r) => ({ ...r, items: [...r.items, copy] }));
    select({ kind: "item", roomId: loc.room.id, itemId: copy.id });
  } else if (selection.kind === "opening") {
    const o = loc.room.openings.find((x) => x.id === selection.openingId);
    if (!o) return;
    const idx = loc.room.walls.findIndex((w) => w.id === o.wallId);
    const len = edgeLength(loc.room.polygon, idx);
    const offset = o.offset + o.width + 20 + o.width <= len ? o.offset + o.width + 20 : Math.max(0, o.offset - o.width - 20);
    const copy = { ...o, id: uid("o"), offset };
    updateRoom(loc.room.id, (r) => ({ ...r, openings: [...r.openings, copy] }));
    select({ kind: "opening", roomId: loc.room.id, openingId: copy.id });
  }
}

export function rotateSelection(delta = 90) {
  const { selection, house, updateRoom, readOnly } = st();
  if (!selection || readOnly) return;
  const loc = findRoom(house, selection.roomId);
  if (!loc) return;
  if (selection.kind === "room" || selection.kind === "wall" || selection.kind === "vertex") {
    if (st().mode === "room" && selection.kind !== "room") return;
    updateRoom(loc.room.id, (r) => ({ ...r, ...rotateRoomTransform(r, delta) }));
  } else if (selection.kind === "item") {
    updateRoom(loc.room.id, (r) => ({
      ...r,
      items: r.items.map((i) => (i.id === selection.itemId ? { ...i, rotation: (((i.rotation + delta) % 360) + 360) % 360 } : i)),
    }));
  } else if (selection.kind === "opening") {
    // Per le aperture "ruotare" significa invertire cerniera/verso.
    updateRoom(loc.room.id, (r) => ({
      ...r,
      openings: r.openings.map((o) => {
        if (o.id !== selection.openingId) return o;
        if (o.hinge === "start" && o.swing === "in") return { ...o, hinge: "end" };
        if (o.hinge === "end" && o.swing === "in") return { ...o, swing: "out" };
        if (o.hinge === "end" && o.swing === "out") return { ...o, hinge: "start" };
        return { ...o, swing: "in" };
      }),
    }));
  }
}

/** Sposta la selezione di (dx, dy) cm nel piano. */
export function nudgeSelection(dx: number, dy: number) {
  const { selection, house, updateRoom, mode, readOnly } = st();
  if (!selection || readOnly) return;
  const loc = findRoom(house, selection.roomId);
  if (!loc) return;
  if (selection.kind === "room" && mode === "house") {
    updateRoom(loc.room.id, (r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
  } else if (selection.kind === "item") {
    const d = dirToLocal(loc.room, { x: dx, y: dy });
    updateRoom(loc.room.id, (r) => ({
      ...r,
      items: r.items.map((i) => (i.id === selection.itemId ? { ...i, x: i.x + d.x, y: i.y + d.y } : i)),
    }));
  }
}

/** Inserisce un'apertura sul muro più vicino al punto del piano. */
export function addOpeningAtWorld(kind: OpeningKind, world: Vec2, opts: { roomId?: string } = {}) {
  const s = st();
  const floor = activeFloor(s);
  const rooms = opts.roomId ? floor.rooms.filter((r) => r.id === opts.roomId) : floor.rooms;
  const tol = 40 / useView2D.getState().scale;
  const hit = nearestWallInRooms(rooms, world, Math.max(tol, 30));
  if (!hit) {
    s.notify(`Avvicina la ${OPENING_DEFAULTS[kind].label.toLowerCase()} a un muro`, "warning");
    return null;
  }
  const loc = findRoom(s.house, hit.roomId)!;
  const res = addOpening(loc.room, kind, hit.wallId, hit.s);
  if (!res.opening) {
    s.notify("Il muro è troppo corto per questa apertura", "warning");
    return null;
  }
  s.updateRoom(hit.roomId, () => res.room);
  s.select({ kind: "opening", roomId: hit.roomId, openingId: res.opening.id });
  return res.opening;
}

// ---------------------------------------------------------------------------
// Oggetti d'arredo

/** Stanza del piano attivo che contiene il punto (coordinate di piano). */
export function roomAtWorld(world: Vec2): Room | null {
  const floor = activeFloor(st());
  for (let i = floor.rooms.length - 1; i >= 0; i--) {
    const r = floor.rooms[i];
    if (pointInPolygon(world, roomWorldPolygon(r))) return r;
  }
  return null;
}

/**
 * Inserisce un prodotto nel punto del piano indicato: lo assegna alla stanza
 * che contiene il punto, lo appoggia al muro più vicino e segnala se non entra.
 */
export function placeProductAtWorld(product: Product, world: Vec2) {
  const s = st();
  if (s.readOnly) return null;
  const room = s.mode === "room" && s.focusedRoomId ? findRoom(s.house, s.focusedRoomId)?.room ?? null : roomAtWorld(world);
  if (!room) {
    s.notify("Rilascia l’oggetto dentro una stanza", "warning");
    return null;
  }
  const local = worldToLocal(room, world);
  const draft = createPlacedItem(product, local.x, local.y);
  const placed = product.mount === "ceiling" ? { x: local.x, y: local.y, rotation: 0 } : placeNearWall(room, draft, local);
  const item = { ...draft, ...placed };
  if (product.shape === "stairs") {
    const loc = findRoom(s.house, room.id);
    const above = loc ? adjacentFloor(s.house, loc.floor.id, 1) : null;
    if (above) item.linkFloorId = above.id;
  }
  s.updateRoom(room.id, (r) => ({ ...r, items: [...r.items, item] }));
  s.select({ kind: "item", roomId: room.id, itemId: item.id });
  if (doesNotFit(room, product.width, product.depth)) {
    s.notify(`${product.name} non entra in ${room.name}: è più grande della stanza`, "warning");
  }
  return item;
}

/** Inserisce un prodotto nella stanza selezionata (o al centro della vista), in un punto libero. */
export function addProduct(product: Product) {
  const s = st();
  const sel = s.selection;
  const roomId = s.focusedRoomId ?? (sel ? sel.roomId : null);
  const loc = roomId ? findRoom(s.house, roomId) : null;
  if (loc) {
    const draft = createPlacedItem(product, 0, 0);
    const spot = findFreeSpot(loc.room, draft);
    if (spot) {
      const item = { ...draft, ...spot };
      s.updateRoom(loc.room.id, (r) => ({ ...r, items: [...r.items, item] }));
      s.select({ kind: "item", roomId: loc.room.id, itemId: item.id });
      return item;
    }
    const c = localToWorld(loc.room, centroid(loc.room.polygon));
    const placed = placeProductAtWorld(product, c);
    if (placed && !doesNotFit(loc.room, product.width, product.depth))
      s.notify(`In ${loc.room.name} non c’è uno spazio libero: l’oggetto è stato messo al centro`, "warning");
    return placed;
  }
  const center = viewCenterWorld();
  if (roomAtWorld(center)) return placeProductAtWorld(product, center);
  const first = activeFloor(s).rooms[0];
  if (!first) {
    s.notify("Crea prima una stanza in cui inserire l’oggetto", "warning");
    return null;
  }
  return placeProductAtWorld(product, localToWorld(first, centroid(first.polygon)));
}

export function updateItem(roomId: string, itemId: string, patch: Partial<PlacedItem>) {
  st().updateRoom(roomId, (r) => ({ ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
}

/**
 * Se il centro dell'oggetto è finito in un'altra stanza dello stesso piano,
 * lo sposta in quella stanza mantenendo posizione e orientamento nel piano.
 */
export function reparentItemIfMoved(roomId: string, itemId: string) {
  const s = st();
  const loc = findRoom(s.house, roomId);
  const item = loc?.room.items.find((i) => i.id === itemId);
  if (!loc || !item) return;
  const world = localToWorld(loc.room, { x: item.x, y: item.y });
  if (pointInPolygon(world, roomWorldPolygon(loc.room))) return;
  const target = loc.floor.rooms.find((r) => r.id !== roomId && pointInPolygon(world, roomWorldPolygon(r)));
  if (!target) return;
  const local = worldToLocal(target, world);
  const moved = {
    ...item,
    x: Math.round(local.x * 10) / 10,
    y: Math.round(local.y * 10) / 10,
    rotation: (((item.rotation + loc.room.rotation - target.rotation) % 360) + 360) % 360,
  };
  s.apply((h) => {
    const f = h.floors[loc.floorIndex];
    const from = f.rooms.find((r) => r.id === roomId)!;
    const to = f.rooms.find((r) => r.id === target.id)!;
    from.items = from.items.filter((i) => i.id !== itemId);
    to.items.push(moved);
  });
  s.select({ kind: "item", roomId: target.id, itemId });
}

// ---------------------------------------------------------------------------
// Composizione della casa

/** Accosta la stanza `roomId` alla stanza `targetId` creando un muro condiviso. */
export function joinRoomTo(roomId: string, targetId: string) {
  const s = st();
  const a = findRoom(s.house, roomId);
  const b = findRoom(s.house, targetId);
  if (!a || !b || a.floorIndex !== b.floorIndex) return false;
  const res = joinRooms(a.room, b.room);
  if (!res) {
    s.notify("Le due stanze non hanno lati paralleli: ruotale prima di unirle", "warning");
    return false;
  }
  const merged = applyMatchThickness(
    a.floor.rooms.map((r) => (r.id === roomId ? { ...r, x: res.x, y: res.y } : r)),
    [res.match],
  );
  s.apply((h) => {
    h.floors[a.floorIndex].rooms = merged;
  });
  s.notify(`${a.room.name} e ${b.room.name} ora condividono un muro`);
  return true;
}

/** Unisce la stanza alla stanza più vicina del piano. */
export function joinToNearest(roomId: string) {
  const s = st();
  const loc = findRoom(s.house, roomId);
  if (!loc) return;
  const me = bbox(roomWorldPolygon(loc.room));
  let best: { id: string; d: number } | null = null;
  for (const r of loc.floor.rooms) {
    if (r.id === roomId) continue;
    const o = bbox(roomWorldPolygon(r));
    const dx = Math.max(0, Math.max(o.minX - me.maxX, me.minX - o.maxX));
    const dy = Math.max(0, Math.max(o.minY - me.maxY, me.minY - o.maxY));
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { id: r.id, d };
  }
  if (!best) {
    s.notify("Non ci sono altre stanze su questo piano", "info");
    return;
  }
  joinRoomTo(roomId, best.id);
}

/** Apre un passaggio lungo tutto il tratto condiviso del muro (es. per un open space). */
export function openSharedWall(roomId: string, wallId: string) {
  const s = st();
  const loc = findRoom(s.house, roomId);
  if (!loc) return;
  const walls = computeFloorWalls(loc.floor.rooms);
  const spans = walls.sharedByWall.get(wallKey(roomId, wallId)) ?? [];
  if (!spans.length) {
    s.notify("Questo muro non è condiviso con un'altra stanza", "info");
    return;
  }
  const span = spans.reduce((a, b) => (b.s1 - b.s0 > a.s1 - a.s0 ? b : a));
  const margin = Math.min(10, (span.s1 - span.s0) / 4);
  const width = Math.round(span.s1 - span.s0 - margin * 2);
  if (width < 40) {
    s.notify("Il tratto condiviso è troppo corto per un passaggio", "warning");
    return;
  }
  const opening = createOpening("passage", wallId, Math.round(span.s0 + margin), {
    width,
    height: Math.min(loc.room.ceilingHeight - 10, 240),
  });
  s.updateRoom(roomId, (r) => ({ ...r, openings: [...r.openings, opening] }));
  s.select({ kind: "opening", roomId, openingId: opening.id });
}

// ---------------------------------------------------------------------------
// Piani

export function addFloor(where: "above" | "below") {
  const s = st();
  const levels = s.house.floors.map((f) => f.level);
  const level = where === "above" ? Math.max(...levels) + 1 : Math.min(...levels) - 1;
  const floor = createFloor(level);
  const next = recomputeElevations({ ...s.house, floors: [...s.house.floors, floor] });
  s.apply(() => next);
  s.setActiveFloor(floor.id);
  s.notify(`${floor.name} aggiunto: il piano sottostante resta visibile in trasparenza come riferimento`);
}

export function deleteFloor(floorId: string) {
  const s = st();
  if (s.house.floors.length <= 1) {
    s.notify("La casa deve avere almeno un piano", "warning");
    return;
  }
  const remaining = s.house.floors.filter((f) => f.id !== floorId);
  const next = recomputeElevations({ ...s.house, floors: remaining });
  // Le scale collegate al piano eliminato perdono il collegamento.
  const cleaned: House = {
    ...next,
    floors: next.floors.map((f) => ({
      ...f,
      rooms: f.rooms.map((r) => ({
        ...r,
        items: r.items.map((it) => (it.linkFloorId === floorId ? { ...it, linkFloorId: undefined } : it)),
      })),
    })),
  };
  s.apply(() => cleaned);
  s.setActiveFloor(remaining.find((f) => f.level === 0)?.id ?? remaining[0].id);
}

export function updateFloor(floorId: string, patch: Partial<Pick<Floor, "name" | "slabThickness" | "elevation">>) {
  const s = st();
  const updated = { ...s.house, floors: s.house.floors.map((f) => (f.id === floorId ? { ...f, ...patch } : f)) };
  s.apply(() => (patch.slabThickness !== undefined ? recomputeElevations(updated) : updated));
}


/** Copia sul piano attivo la forma delle stanze del piano sottostante (senza arredi né porte). */
export function copyRoomsFromBelow() {
  const s = st();
  const floor = activeFloor(s);
  const below = adjacentFloor(s.house, floor.id, -1);
  if (!below || below.rooms.length === 0) return;
  const copies = below.rooms.map((r) => {
    const c = cloneRoomWithNewIds(r);
    return { ...c, items: [], openings: c.openings.filter((o) => o.kind === "window"), kitchen: undefined };
  });
  s.apply((h) => {
    const f = h.floors.find((x) => x.id === floor.id);
    f?.rooms.push(...copies);
  });
  s.notify(`Copiate ${copies.length} stanze da ${below.name}: modificale liberamente`);
}
