import { prisma } from "@/lib/server/db";
import { handleError, type IdContext } from "@/lib/server/http";
import { getWritableProject, newShareToken } from "@/lib/server/projects";
import { requireUser } from "@/lib/server/user";

/** Attiva (o restituisce) il link di condivisione in sola lettura. */
export async function POST(_req: Request, ctx: IdContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const p = await getWritableProject(id, user.id);
    const token = p.shareToken ?? newShareToken();
    if (!p.shareToken) await prisma.project.update({ where: { id }, data: { shareToken: token } });
    return Response.json({ token });
  } catch (err) {
    return handleError(err);
  }
}

/** Revoca il link: chi lo possiede non potrà più aprire il progetto. */
export async function DELETE(_req: Request, ctx: IdContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    await getWritableProject(id, user.id);
    await prisma.project.update({ where: { id }, data: { shareToken: null } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
