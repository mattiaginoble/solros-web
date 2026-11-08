import { getProduct } from "@/catalog/service";
import { handleError, HttpError, type IdContext } from "@/lib/server/http";
import { findCurrentUser } from "@/lib/server/user";

export async function GET(_req: Request, ctx: IdContext) {
  try {
    const { id } = await ctx.params;
    const user = await findCurrentUser();
    const product = await getProduct(id, { userId: user?.id ?? null });
    if (!product) throw new HttpError(404, "Prodotto non trovato");
    return Response.json({ product });
  } catch (err) {
    return handleError(err);
  }
}
