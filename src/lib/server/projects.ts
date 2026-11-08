import "server-only";
import { randomBytes } from "node:crypto";
import { safeParseHouse, type House } from "@/domain/schema";
import { houseStats, housePreview, type HousePreview, type HouseStats } from "@/domain/summary";
import { prisma } from "./db";
import { HttpError, zodDetails } from "./http";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  isExample: boolean;
  shared: boolean;
  stats: HouseStats;
  preview: HousePreview;
}

export function validateHouse(input: unknown): House {
  const parsed = safeParseHouse(input);
  if (!parsed.success) {
    throw new HttpError(422, "Documento casa non valido", zodDetails(parsed.error));
  }
  return parsed.data;
}

export { houseStats };

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
    preview = housePreview(house);
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
export async function getReadableProject(id: string, userId: string | null) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, "Progetto non trovato");
  if (!p.isExample && (!userId || p.ownerId !== userId)) throw new HttpError(403, "Progetto non accessibile");
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
