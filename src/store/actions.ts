/** Azioni di alto livello dell'editor, condivise da barra strumenti, scorciatoie e pannelli. */
import { OPENING_DEFAULTS } from "@/domain/constants";
import { cloneRoomWithNewIds, uid } from "@/domain/factory";
import type { OpeningKind, Room } from "@/domain/schema";
import { addOpening, nearestWallInRooms, removeVertex } from "@/domain/roomOps";
import { bbox, bboxUnion, edgeLength } from "@/lib/geometry/polygon";
import { dirToLocal, roomWorldPolygon, rotateRoomTransform } from "@/lib/geometry/transform";
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
