import { prisma } from "@/lib/server/db";
import { handleError, HttpError, type IdContext } from "@/lib/server/http";
import { requireUser } from "@/lib/server/user";

/** Elimina un prodotto personale (solo il proprietario; i prodotti demo non si eliminano). */
export async function DELETE(_req: Request, ctx: IdContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) throw new HttpError(404, "Prodotto non trovato");
    if (p.ownerId !== user.id) throw new HttpError(403, "Puoi eliminare solo i tuoi prodotti");
    await prisma.product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
