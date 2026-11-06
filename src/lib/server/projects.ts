import "server-only";
import { randomBytes } from "node:crypto";
import { safeParseHouse, type House } from "@/domain/schema";
import { roomWorldPolygon } from "@/lib/geometry/transform";
import { prisma } from "./db";
import { HttpError, zodDetails } from "./http";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  isExample: boolean;
  shared: boolean;
  stats: { floors: number; rooms: number; items: number; areaM2: number };
  /** Poligoni del piano principale (coordinate di piano) per la miniatura. */
  preview: { points: { x: number; y: number }[]; color: string }[];
}

export function validateHouse(input: unknown): House {
  const parsed = safeParseHouse(input);
  if (!parsed.success) {
    throw new HttpError(422, "Documento casa non valido", zodDetails(parsed.error));
  }
  return parsed.data;
}

export function houseStats(house: House) {
  let rooms = 0;
  let items = 0;
  let area = 0;
  for (const f of house.floors) {
    rooms += f.rooms.length;
    for (const r of f.rooms) {
      items += r.items.length;
      let a = 0;
      for (let i = 0; i < r.polygon.length; i++) {
        const p = r.polygon[i];
        const q = r.polygon[(i + 1) % r.polygon.length];
        a += p.x * q.y - q.x * p.y;
      }
      area += Math.abs(a) / 2 / 10000;
    }
  }
  return { floors: house.floors.length, rooms, items, areaM2: Math.round(area * 10) / 10 };
}

export function toSummary(p: {
  id: string;
  name: string;
  data: string;
  updatedAt: Date;
  createdAt: Date;
  isExample: boolean;
  shareToken: string | null;
}): ProjectSummary {
  let stats = { floors: 0, rooms: 0, items: 0, areaM2: 0 };
  let preview: ProjectSummary["preview"] = [];
  try {
    const house = JSON.parse(p.data) as House;
    stats = houseStats(house);
    const floor = [...house.floors].sort((a, b) => Math.abs(a.level) - Math.abs(b.level))[0];
    preview = (floor?.rooms ?? []).map((r) => ({
      points: roomWorldPolygon(r).map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })),
      color: r.color,
    }));
  } catch {
    /* documento corrotto: statistiche vuote */
  }
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    isExample: p.isExample,
    shared: !!p.shareToken,
    stats,
    preview,
  };
}

/** Progetto leggibile dall'utente (proprietario o esempio pubblico). */
export async function getReadableProject(id: string, userId: string) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, "Progetto non trovato");
  if (!p.isExample && p.ownerId !== userId) throw new HttpError(403, "Progetto non accessibile");
  return p;
}

/** Progetto modificabile: solo il proprietario, mai gli esempi. */
export async function getWritableProject(id: string, userId: string) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, "Progetto non trovato");
  if (p.ownerId !== userId || p.isExample) throw new HttpError(403, "Progetto non modificabile");
  return p;
}

export function newShareToken() {
  return randomBytes(18).toString("base64url");
}
