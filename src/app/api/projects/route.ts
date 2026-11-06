import { createHouse } from "@/domain/factory";
import { prisma } from "@/lib/server/db";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { toSummary, validateHouse } from "@/lib/server/projects";
import { getCurrentUser } from "@/lib/server/user";

/** Elenco dei progetti dell'utente e delle case di esempio. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const rows = await prisma.project.findMany({
      where: { OR: [{ ownerId: user.id }, { isExample: true }] },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({
      user: { id: user.id, name: user.name },
      projects: rows.filter((r) => !r.isExample).map(toSummary),
      examples: rows.filter((r) => r.isExample).map(toSummary),
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Crea un progetto. Body: { name?, data?, fromExampleId? }.
 * Con `fromExampleId` copia una casa di esempio nel progetto dell'utente.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = ((await readJson(req)) ?? {}) as { name?: string; data?: unknown; fromExampleId?: string };
    let house;
    if (body.fromExampleId) {
      const ex = await prisma.project.findUnique({ where: { id: body.fromExampleId } });
      if (!ex || !ex.isExample) throw new HttpError(404, "Esempio non trovato");
      const { cloneHouseWithNewIds } = await import("@/domain/factory");
      house = cloneHouseWithNewIds(validateHouse(JSON.parse(ex.data)));
    } else if (body.data) {
      house = validateHouse(body.data);
    } else {
      house = createHouse(body.name?.trim() || "Nuova casa");
    }
    const name = (body.name?.trim() || house.name).slice(0, 120);
    house = { ...house, name };
    const p = await prisma.project.create({
      data: { name, data: JSON.stringify(house), ownerId: user.id },
    });
    return Response.json({ project: { ...toSummary(p), data: house } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
