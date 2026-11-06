import { ProductSchema } from "@/domain/schema";
import { prisma } from "@/lib/server/db";
import { handleError, HttpError, readJson, zodDetails } from "@/lib/server/http";
import { productToRow, rowToProduct } from "@/lib/server/products";
import { getCurrentUser } from "@/lib/server/user";
import { shortHash } from "@/catalog/normalize";

/** Salva un prodotto personale (inserito a mano o da link) nel catalogo dell'utente. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await readJson(req, 64 * 1024)) as { product?: Record<string, unknown> };
    const source = body.product?.source === "link" ? "link" : "manual";
    const parsed = ProductSchema.safeParse({
      ...body.product,
      id: `${source}-${shortHash(`${user.id}|${Date.now()}|${Math.random()}`)}`,
      source,
      priceUpdatedAt: new Date().toISOString(),
    });
    if (!parsed.success) throw new HttpError(422, "Dati del prodotto non validi", zodDetails(parsed.error));
    const row = await prisma.product.create({ data: productToRow(parsed.data, { ownerId: user.id }) });
    return Response.json({ product: rowToProduct(row) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
