import { prisma } from "@/lib/server/db";
import { handleError } from "@/lib/server/http";
import { getWritableProject, newShareToken } from "@/lib/server/projects";
import { getCurrentUser } from "@/lib/server/user";

/** Attiva (o restituisce) il link di condivisione in sola lettura. */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/share">) {
  try {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    const p = await getWritableProject(id, user.id);
    const token = p.shareToken ?? newShareToken();
    if (!p.shareToken) await prisma.project.update({ where: { id }, data: { shareToken: token } });
    return Response.json({ token });
  } catch (err) {
    return handleError(err);
  }
}

/** Revoca il link: chi lo possiede non potrà più aprire il progetto. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]/share">) {
  try {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    await getWritableProject(id, user.id);
    await prisma.project.update({ where: { id }, data: { shareToken: null } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
