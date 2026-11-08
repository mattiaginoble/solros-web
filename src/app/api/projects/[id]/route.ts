import { prisma } from "@/lib/server/db";
import { handleError, readJson } from "@/lib/server/http";
import { getReadableProject, getWritableProject, toSummary, validateHouse } from "@/lib/server/projects";
import { findCurrentUser, requireUser } from "@/lib/server/user";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    const user = await findCurrentUser();
    const p = await getReadableProject(id, user?.id ?? null);
    const owner = !!user && p.ownerId === user.id;
    return Response.json({
      project: {
        ...toSummary(p),
        readOnly: p.isExample || !owner,
        shareToken: owner ? p.shareToken : null,
        data: JSON.parse(p.data),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Salvataggio (anche automatico). Body: { data: House, name? }. */
export async function PUT(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    await getWritableProject(id, user.id);
    const body = (await readJson(req)) as { data?: unknown; name?: string };
    const house = validateHouse(body.data);
    const name = (body.name?.trim() || house.name || "Senza nome").slice(0, 120);
    const p = await prisma.project.update({
      where: { id },
      data: { name, data: JSON.stringify({ ...house, name }) },
    });
    return Response.json({ project: toSummary(p) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    await getWritableProject(id, user.id);
    await prisma.project.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
