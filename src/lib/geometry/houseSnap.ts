/**
 * Composizione della casa: snap magnetico tra stanze e unione dei muri.
 *
 * Trascinando una stanza vicino a un'altra, i lati affacciati vengono portati
 * alla distanza dello spessore del muro esistente (così diventano un muro
 * condiviso) e gli angoli vicini si allineano. Anche i lati paralleli con lo
 * stesso verso (es. i muri di facciata) si allineano sulla stessa retta.
 */
import type { Room } from "@/domain/schema";
import { roomWorldEdges, type WorldEdge } from "./walls";
import { type Vec2, add, dot, mul } from "./vec";

export interface EdgeMatch {
  kind: "facing" | "collinear";
  moving: { roomId: string; wallId: string };
  target: { roomId: string; wallId: string };
  /** Spessore del muro condiviso risultante (solo per "facing"). */
  gap: number;
}

export interface RoomSnapResult {
  x: number;
  y: number;
  matches: EdgeMatch[];
}

function overlapAlong(e: WorldEdge, f: WorldEdge, extra: number) {
  const sa = dot({ x: f.a.x - e.a.x, y: f.a.y - e.a.y }, e.dir);
  const sb = dot({ x: f.b.x - e.a.x, y: f.b.y - e.a.y }, e.dir);
  const lo = Math.max(-extra, Math.min(sa, sb));
  const hi = Math.min(e.length + extra, Math.max(sa, sb));
  return hi - lo;
}

/**
 * Posizione agganciata per la stanza `moving` proposta in (x, y).
 * `tolerance` è la distanza massima (cm) entro cui scatta l'aggancio.
 */
export function snapRoomPosition(moving: Room, proposed: Vec2, others: Room[], tolerance: number): RoomSnapResult {
  const placed = { ...moving, x: proposed.x, y: proposed.y };
  const mEdges = roomWorldEdges(placed);
  const oEdges = others.filter((r) => r.id !== moving.id).flatMap((r, i) => roomWorldEdges(r, i));

  // Correzione separata per ciascuno dei due assi principali di traslazione.
  type Cand = { delta: Vec2; normal: Vec2; score: number; match: EdgeMatch; e: WorldEdge; f: WorldEdge };
  const cands: Cand[] = [];
  for (const e of mEdges) {
    for (const f of oEdges) {
      const d = dot(e.dir, f.dir);
      if (d < -0.999) {
        if (overlapAlong(e, f, tolerance) <= 1) continue;
        const gap = f.thickness;
        const dist = dot({ x: f.a.x - e.a.x, y: f.a.y - e.a.y }, e.normal);
        const delta = dist - gap;
        if (Math.abs(delta) > tolerance) continue;
        cands.push({
          delta: mul(e.normal, delta),
          normal: e.normal,
          score: Math.abs(delta),
          match: { kind: "facing", moving: { roomId: moving.id, wallId: e.wallId }, target: { roomId: f.roomId, wallId: f.wallId }, gap },
          e,
          f,
        });
      } else if (d > 0.999) {
        // Lati con lo stesso verso: allineamento della faccia interna sulla stessa retta.
        const dist = dot({ x: f.a.x - e.a.x, y: f.a.y - e.a.y }, e.normal);
        if (Math.abs(dist) > tolerance * 0.6) continue;
        cands.push({
          delta: mul(e.normal, dist),
          normal: e.normal,
          score: Math.abs(dist) + tolerance * 0.5,
          match: { kind: "collinear", moving: { roomId: moving.id, wallId: e.wallId }, target: { roomId: f.roomId, wallId: f.wallId }, gap: 0 },
          e,
          f,
        });
      }
    }
  }
  cands.sort((a, b) => a.score - b.score);

  let delta = { x: 0, y: 0 };
  const used: Vec2[] = [];
  const matches: EdgeMatch[] = [];
  for (const c of cands) {
    if (used.some((n) => Math.abs(dot(n, c.normal)) > 0.99)) continue;
    // Le correzioni lungo assi diversi non devono interferire (stanze ortogonali o comunque non parallele).
    if (used.length && used.some((n) => Math.abs(dot(n, c.normal)) > 0.05)) continue;
    delta = add(delta, c.delta);
    used.push(c.normal);
    matches.push(c.match);
    if (used.length === 2) break;
  }

  // Allineamento degli angoli lungo il lato affacciato (se resta un asse libero).
  if (used.length === 1 && matches[0].kind === "facing") {
    const c = cands.find((x) => x.match === matches[0])!;
    const along = c.e.dir;
    const ea = add(c.e.a, delta);
    const eb = add(c.e.b, delta);
    const options = [
      dot({ x: c.f.b.x - ea.x, y: c.f.b.y - ea.y }, along),
      dot({ x: c.f.a.x - eb.x, y: c.f.a.y - eb.y }, along),
      dot({ x: c.f.a.x - ea.x, y: c.f.a.y - ea.y }, along),
      dot({ x: c.f.b.x - eb.x, y: c.f.b.y - eb.y }, along),
    ].filter((v) => Math.abs(v) <= tolerance);
    if (options.length) {
      const best = options.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
      delta = add(delta, mul(along, best));
    }
  }

  return { x: round(proposed.x + delta.x), y: round(proposed.y + delta.y), matches };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Trasformazione che accosta `moving` a `target` sul lato affacciato più vicino,
 * a qualsiasi distanza: usata dal pulsante "Unisci". Restituisce null se le
 * stanze non hanno lati paralleli affacciabili.
 */
export function joinRooms(moving: Room, target: Room): { x: number; y: number; match: EdgeMatch } | null {
  const mEdges = roomWorldEdges(moving);
  const tEdges = roomWorldEdges(target);
  let best: { cost: number; delta: Vec2; e: WorldEdge; f: WorldEdge } | null = null;
  for (const e of mEdges) {
    for (const f of tEdges) {
      if (dot(e.dir, f.dir) > -0.999) continue;
      // Il lato della stanza mobile deve guardare verso l'altra stanza.
      const dist = dot({ x: f.a.x - e.a.x, y: f.a.y - e.a.y }, e.normal);
      if (dist < -1) continue;
      const gap = f.thickness;
      const perp = mul(e.normal, dist - gap);
      // Se i lati si sovrappongono poco, si centrano l'uno sull'altro.
      const eMid = mul(add(e.a, e.b), 0.5);
      const fMid = mul(add(f.a, f.b), 0.5);
      const alongOff = dot({ x: fMid.x - eMid.x, y: fMid.y - eMid.y }, e.dir);
      const needed = overlapAlong(e, f, 0) < Math.min(e.length, f.length) * 0.5 ? alongOff : 0;
      const delta = add(perp, mul(e.dir, needed));
      const cost = Math.hypot(delta.x, delta.y) - Math.min(e.length, f.length) * 0.01;
      if (!best || cost < best.cost) best = { cost, delta, e, f };
    }
  }
  if (!best) return null;
  const proposed = { x: moving.x + best.delta.x, y: moving.y + best.delta.y };
  // Rifinitura con lo snap magnetico (allineamento degli angoli).
  const refined = snapRoomPosition({ ...moving }, proposed, [target], 40);
  return {
    x: refined.x,
    y: refined.y,
    match: {
      kind: "facing",
      moving: { roomId: moving.id, wallId: best.e.wallId },
      target: { roomId: target.id, wallId: best.f.wallId },
      gap: best.f.thickness,
    },
  };
}

/** Allinea gli spessori dei muri uniti allo spessore del muro condiviso. */
export function applyMatchThickness(rooms: Room[], matches: EdgeMatch[]): Room[] {
  const facing = matches.filter((m) => m.kind === "facing");
  if (!facing.length) return rooms;
  return rooms.map((r) => {
    const changes = facing.filter((m) => m.moving.roomId === r.id || m.target.roomId === r.id);
    if (!changes.length) return r;
    return {
      ...r,
      walls: r.walls.map((w) => {
        const m = changes.find((c) => (c.moving.roomId === r.id && c.moving.wallId === w.id) || (c.target.roomId === r.id && c.target.wallId === w.id));
        return m && w.thickness !== m.gap ? { ...w, thickness: m.gap } : w;
      }),
    };
  });
}
