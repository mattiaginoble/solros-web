import { cloneHouseWithNewIds } from "@/domain/factory";
import { prisma } from "@/lib/server/db";
import { handleError } from "@/lib/server/http";
import { getReadableProject, toSummary, validateHouse } from "@/lib/server/projects";
import { getCurrentUser } from "@/lib/server/user";

/** Duplica un progetto (proprio o di esempio) nei progetti dell'utente. */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/duplicate">) {
  try {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    const src = await getReadableProject(id, user.id);
    const house = cloneHouseWithNewIds(validateHouse(JSON.parse(src.data)));
    const name = src.isExample ? src.name : `${src.name} (copia)`;
    const p = await prisma.project.create({
      data: { name, data: JSON.stringify({ ...house, name }), ownerId: user.id },
    });
    return Response.json({ project: toSummary(p) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
