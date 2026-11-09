import { prisma } from "@/lib/server/db";
import { refreshFeed } from "@/lib/server/feeds";
import { handleError, HttpError, type IdContext } from "@/lib/server/http";
import { requireUser } from "@/lib/server/user";

/** Aggiorna subito un feed salvato. */
export async function POST(_req: Request, ctx: IdContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const feed = await prisma.catalogFeed.findUnique({ where: { id } });
    if (!feed || feed.ownerId !== user.id) throw new HttpError(404, "Feed non trovato");
    return Response.json(await refreshFeed(feed));
  } catch (err) {
    return handleError(err);
  }
}
