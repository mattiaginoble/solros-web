/**
 * Calcolo derivato dei muri di un piano.
 *
 * Ogni stanza memorizza solo la faccia interna dei propri muri (poligono) e lo
 * spessore di ciascun lato. I muri reali del piano si ottengono qui:
 *
 * - ogni lato genera una "striscia" verso l'esterno, con giunti a spigolo vivo;
 * - quando il lato di una stanza A fronteggia il lato di una stanza B (direzioni
 *   opposte, distanza tra le facce ≤ spessore), la porzione sovrapposta è un
 *   MURO CONDIVISO: viene generata una sola volta (dalla stanza che compare prima
 *   nell'elenco del piano), con spessore pari alla distanza tra le facce;
 * - le aperture di entrambe le stanze che cadono sul muro condiviso lo forano.
 *
 * Il calcolo è puramente geometrico: spostando le stanze la condivisione si
 * crea o si rompe automaticamente, senza riferimenti incrociati da mantenere.
 */
import type { Opening, Room } from "@/domain/schema";
import { type Edge, bbox, bboxesOverlap, edges as polyEdges, miterPoint } from "./polygon";
import { roomWorldPolygon } from "./transform";
import { type Vec2, add, dot, mul, sub } from "./vec";

/** Tolleranza (cm) oltre lo spessore entro cui due facce si considerano lo stesso muro. */
export const SHARE_TOLERANCE = 2;
/** Lunghezza minima di sovrapposizione (cm) per considerare un tratto condiviso. */
export const MIN_SHARED_LENGTH = 1;

export interface WorldEdge extends Edge {
  roomId: string;
  roomIndex: number;
  wallId: string;
  thickness: number;
}

export interface SharedSpan {
  /** Intervallo sul lato corrente (cm dal vertice iniziale). */
  s0: number;
  s1: number;
  otherRoomId: string;
  otherWallId: string;
  /** Distanza tra le due facce interne = spessore del muro condiviso. */
  gap: number;
  /** La stanza corrente genera la geometria del tratto condiviso. */
  owner: boolean;
}

export interface OpeningSpan {
  opening: Opening;
  roomId: string;
  /** Intervallo dell'apertura nel parametro del lato del pezzo di muro. */
  s0: number;
  s1: number;
}

export interface WallPiece {
  key: string;
  roomId: string;
  wallId: string;
  edge: WorldEdge;
  s0: number;
  s1: number;
  thickness: number;
  shared: { roomId: string; wallId: string } | null;
  /** Punti esterni (lato opposto alla stanza) all'inizio e alla fine del pezzo. */
  outerStart: Vec2;
  outerEnd: Vec2;
  openings: OpeningSpan[];
}

export interface FloorWalls {
  edgesByRoom: Map<string, WorldEdge[]>;
  sharedByWall: Map<string, SharedSpan[]>;
  pieces: WallPiece[];
}

export const wallKey = (roomId: string, wallId: string) => `${roomId}:${wallId}`;

export function roomWorldEdges(room: Room, roomIndex = 0): WorldEdge[] {
  const poly = roomWorldPolygon(room);
  return polyEdges(poly).map((e, i) => ({
    ...e,
    roomId: room.id,
    roomIndex,
    wallId: room.walls[i]?.id ?? `w${i}`,
    thickness: room.walls[i]?.thickness ?? 10,
  }));
}

/**
 * Confronta due lati e, se fronteggiati, restituisce gli intervalli condivisi
 * su entrambi e lo spessore del muro comune.
 */
export function matchFacingEdges(
  e: WorldEdge,
  f: WorldEdge,
  tolerance = SHARE_TOLERANCE,
): { onE: [number, number]; onF: [number, number]; gap: number } | null {
  if (dot(e.dir, f.dir) > -0.999) return null;
  const dA = dot(sub(f.a, e.a), e.normal);
  const dB = dot(sub(f.b, e.a), e.normal);
  if (Math.abs(dA - dB) > 1) return null;
  const gap = (dA + dB) / 2;
  const maxT = Math.max(e.thickness, f.thickness) + tolerance;
  if (gap < 0.5 || gap > maxT) return null;
  const sa = dot(sub(f.a, e.a), e.dir);
  const sb = dot(sub(f.b, e.a), e.dir);
  const lo = Math.max(0, Math.min(sa, sb));
  const hi = Math.min(e.length, Math.max(sa, sb));
  if (hi - lo < MIN_SHARED_LENGTH) return null;
  const pLo = add(e.a, mul(e.dir, lo));
  const pHi = add(e.a, mul(e.dir, hi));
  const tLo = dot(sub(pLo, f.a), f.dir);
  const tHi = dot(sub(pHi, f.a), f.dir);
  return {
    onE: [lo, hi],
    onF: [Math.max(0, Math.min(tLo, tHi)), Math.min(f.length, Math.max(tLo, tHi))],
    gap,
  };
}

function thicknessAt(edge: WorldEdge, spans: SharedSpan[] | undefined, s: number) {
  if (spans) {
    for (const sp of spans) if (s >= sp.s0 - 0.01 && s <= sp.s1 + 0.01) return sp.gap;
  }
  return edge.thickness;
}

export function computeFloorWalls(rooms: Room[]): FloorWalls {
  const edgesByRoom = new Map<string, WorldEdge[]>();
  const boxes = rooms.map((r, i) => {
    const es = roomWorldEdges(r, i);
    edgesByRoom.set(r.id, es);
    return bbox(es.map((e) => e.a));
  });

  const sharedByWall = new Map<string, SharedSpan[]>();
  const push = (roomId: string, wallId: string, span: SharedSpan) => {
    const k = wallKey(roomId, wallId);
    const list = sharedByWall.get(k);
    if (list) list.push(span);
    else sharedByWall.set(k, [span]);
  };

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (!bboxesOverlap(boxes[i], boxes[j], 60)) continue;
      const ei = edgesByRoom.get(rooms[i].id)!;
      const ej = edgesByRoom.get(rooms[j].id)!;
      for (const e of ei) {
        for (const f of ej) {
          const m = matchFacingEdges(e, f);
          if (!m) continue;
          push(e.roomId, e.wallId, {
            s0: m.onE[0],
            s1: m.onE[1],
            otherRoomId: f.roomId,
            otherWallId: f.wallId,
            gap: m.gap,
            owner: true,
          });
          push(f.roomId, f.wallId, {
            s0: m.onF[0],
            s1: m.onF[1],
            otherRoomId: e.roomId,
            otherWallId: e.wallId,
            gap: m.gap,
            owner: false,
          });
        }
      }
    }
  }
  for (const list of sharedByWall.values()) list.sort((a, b) => a.s0 - b.s0);

  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const pieces: WallPiece[] = [];

  for (const room of rooms) {
    const es = edgesByRoom.get(room.id)!;
    es.forEach((e, idx) => {
      const spans = sharedByWall.get(wallKey(room.id, e.wallId)) ?? [];
      const prev = es[(idx - 1 + es.length) % es.length];
      const next = es[(idx + 1) % es.length];
      const prevSpans = sharedByWall.get(wallKey(room.id, prev.wallId));
      const nextSpans = sharedByWall.get(wallKey(room.id, next.wallId));

      const segs: { s0: number; s1: number; span: SharedSpan | null }[] = [];
      let cursor = 0;
      for (const sp of spans) {
        const s0 = Math.max(sp.s0, cursor);
        if (sp.s1 <= s0 + 0.01) continue;
        if (s0 > cursor + 0.01) segs.push({ s0: cursor, s1: s0, span: null });
        segs.push({ s0, s1: sp.s1, span: sp });
        cursor = sp.s1;
      }
      if (cursor < e.length - 0.01) segs.push({ s0: cursor, s1: e.length, span: null });

      for (const seg of segs) {
        if (seg.span && !seg.span.owner) continue; // generato dalla stanza proprietaria
        const thickness = seg.span ? seg.span.gap : e.thickness;
        const outerStart =
          seg.s0 < 0.01
            ? miterPoint(prev, thicknessAt(prev, prevSpans, prev.length), e, thickness)
            : add(add(e.a, mul(e.dir, seg.s0)), mul(e.normal, thickness));
        const outerEnd =
          seg.s1 > e.length - 0.01
            ? miterPoint(e, thickness, next, thicknessAt(next, nextSpans, 0))
            : add(add(e.a, mul(e.dir, seg.s1)), mul(e.normal, thickness));

        const openings: OpeningSpan[] = [];
        for (const o of room.openings) {
          if (o.wallId !== e.wallId) continue;
          const a = Math.max(seg.s0, o.offset);
          const b = Math.min(seg.s1, o.offset + o.width);
          if (b - a > 0.5) openings.push({ opening: o, roomId: room.id, s0: a, s1: b });
        }
        if (seg.span) {
          const other = roomsById.get(seg.span.otherRoomId);
          const otherEdge = edgesByRoom
            .get(seg.span.otherRoomId)
            ?.find((x) => x.wallId === seg.span!.otherWallId);
          if (other && otherEdge) {
            for (const o of other.openings) {
              if (o.wallId !== otherEdge.wallId) continue;
              const pA = add(otherEdge.a, mul(otherEdge.dir, o.offset));
              const pB = add(otherEdge.a, mul(otherEdge.dir, o.offset + o.width));
              const tA = dot(sub(pA, e.a), e.dir);
              const tB = dot(sub(pB, e.a), e.dir);
              const a = Math.max(seg.s0, Math.min(tA, tB));
              const b = Math.min(seg.s1, Math.max(tA, tB));
              if (b - a > 0.5) openings.push({ opening: o, roomId: other.id, s0: a, s1: b });
            }
          }
        }
        openings.sort((x, y) => x.s0 - y.s0);

        pieces.push({
          key: `${room.id}:${e.wallId}:${Math.round(seg.s0)}`,
          roomId: room.id,
          wallId: e.wallId,
          edge: e,
          s0: seg.s0,
          s1: seg.s1,
          thickness,
          shared: seg.span ? { roomId: seg.span.otherRoomId, wallId: seg.span.otherWallId } : null,
          outerStart,
          outerEnd,
          openings,
        });
      }
    });
  }

  return { edgesByRoom, sharedByWall, pieces };
}

/** Punto della faccia interna del pezzo al parametro s. */
export function innerPoint(piece: WallPiece, s: number): Vec2 {
  return add(piece.edge.a, mul(piece.edge.dir, s));
}

/** Punto della faccia esterna del pezzo al parametro s (interpolando i giunti). */
export function outerPoint(piece: WallPiece, s: number): Vec2 {
  if (Math.abs(s - piece.s0) < 0.01) return piece.outerStart;
  if (Math.abs(s - piece.s1) < 0.01) return piece.outerEnd;
  return add(innerPoint(piece, s), mul(piece.edge.normal, piece.thickness));
}

/** Quadrilatero (interno inizio, interno fine, esterno fine, esterno inizio) del tratto [s0, s1]. */
export function pieceQuad(piece: WallPiece, s0 = piece.s0, s1 = piece.s1): Vec2[] {
  return [innerPoint(piece, s0), innerPoint(piece, s1), outerPoint(piece, s1), outerPoint(piece, s0)];
}

export interface PieceSegment {
  s0: number;
  s1: number;
  opening: OpeningSpan | null;
}

/** Suddivide il pezzo in tratti pieni e tratti occupati da aperture. */
export function pieceSegments(piece: WallPiece): PieceSegment[] {
  const out: PieceSegment[] = [];
  let cursor = piece.s0;
  for (const o of piece.openings) {
    const a = Math.max(o.s0, cursor);
    if (o.s1 <= a) continue;
    if (a > cursor + 0.01) out.push({ s0: cursor, s1: a, opening: null });
    out.push({ s0: a, s1: o.s1, opening: o });
    cursor = o.s1;
  }
  if (cursor < piece.s1 - 0.01) out.push({ s0: cursor, s1: piece.s1, opening: null });
  return out;
}

/** Spessore effettivo del muro di una stanza nel punto s (condiviso o proprio). */
export function effectiveThickness(walls: FloorWalls, roomId: string, wallId: string, s: number): number {
  const e = walls.edgesByRoom.get(roomId)?.find((x) => x.wallId === wallId);
  if (!e) return 10;
  return thicknessAt(e, walls.sharedByWall.get(wallKey(roomId, wallId)), s);
}

export interface OpeningGeometry {
  opening: Opening;
  roomId: string;
  edge: WorldEdge;
  /** Estremi sulla faccia interna della stanza proprietaria. */
  start: Vec2;
  end: Vec2;
  /** Direzione verso l'interno della stanza. */
  inward: Vec2;
  thickness: number;
}

export function openingGeometries(rooms: Room[], walls: FloorWalls): OpeningGeometry[] {
  const out: OpeningGeometry[] = [];
  for (const room of rooms) {
    const es = walls.edgesByRoom.get(room.id);
    if (!es) continue;
    for (const o of room.openings) {
      const e = es.find((x) => x.wallId === o.wallId);
      if (!e) continue;
      out.push({
        opening: o,
        roomId: room.id,
        edge: e,
        start: add(e.a, mul(e.dir, o.offset)),
        end: add(e.a, mul(e.dir, o.offset + o.width)),
        inward: mul(e.normal, -1),
        thickness: effectiveThickness(walls, room.id, o.wallId, o.offset + o.width / 2),
      });
    }
  }
  return out;
}

/** Lista dei muri condivisi (una voce per coppia), utile per UI e test. */
export function listSharedWalls(walls: FloorWalls) {
  const out: { roomId: string; wallId: string; otherRoomId: string; otherWallId: string; length: number; gap: number }[] = [];
  for (const [k, spans] of walls.sharedByWall) {
    const [roomId, wallId] = k.split(":");
    for (const s of spans) {
      if (!s.owner) continue;
      out.push({ roomId, wallId, otherRoomId: s.otherRoomId, otherWallId: s.otherWallId, length: s.s1 - s.s0, gap: s.gap });
    }
  }
  return out;
}
