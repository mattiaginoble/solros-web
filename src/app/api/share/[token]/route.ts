import { prisma } from "@/lib/server/db";
import { handleError, HttpError } from "@/lib/server/http";
import { toSummary } from "@/lib/server/projects";

/** Lettura pubblica di un progetto condiviso (nessun dato del proprietario). */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]">) {
  try {
    const { token } = await ctx.params;
    if (!token || token.length < 16) throw new HttpError(404, "Link non valido");
    const p = await prisma.project.findUnique({ where: { shareToken: token } });
    if (!p) throw new HttpError(404, "Link non valido o revocato");
    return Response.json({ project: { ...toSummary(p), readOnly: true, data: JSON.parse(p.data) } });
  } catch (err) {
    return handleError(err);
  }
}
