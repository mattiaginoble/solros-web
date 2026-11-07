import { z } from "zod";
import { ProductSchema } from "@/domain/schema";
import { prisma } from "@/lib/server/db";
import { handleError, HttpError, readJson, zodDetails } from "@/lib/server/http";
import { productToRow } from "@/lib/server/products";
import { getCurrentUser } from "@/lib/server/user";

const MAX_PRODUCTS = 5000;

const BodySchema = z.object({
  batch: z.string().trim().min(1).max(120),
  products: z.array(ProductSchema).min(1).max(MAX_PRODUCTS),
});

/** Lotti importati dall'utente, con il numero di prodotti. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const groups = await prisma.product.groupBy({
      by: ["importBatch"],
      where: { ownerId: user.id, source: "import" },
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    return Response.json({
      batches: groups
        .filter((g) => g.importBatch)
        .map((g) => ({ batch: g.importBatch, count: g._count._all, updatedAt: g._max.updatedAt?.toISOString() })),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Importa (o aggiorna) un lotto di prodotti già mappati e validati dal client; il server li rivalida. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const parsed = BodySchema.safeParse(await readJson(req, 25 * 1024 * 1024));
    if (!parsed.success) throw new HttpError(422, "File di catalogo non valido", zodDetails(parsed.error));
    const { batch, products } = parsed.data;
    let imported = 0;
    await prisma.$transaction(async (tx) => {
      for (const p of products) {
        // L'id dipende dall'utente: lo stesso file importato da due utenti non si sovrascrive.
        const product = { ...p, id: `${p.id}-${user.id.slice(-6)}`, source: "import" as const };
        const row = productToRow(product, { ownerId: user.id, importBatch: batch });
        // Si aggiornano solo i prodotti dell'utente: mai quelli di altri o del catalogo demo.
        const existing = await tx.product.findUnique({ where: { id: row.id }, select: { ownerId: true } });
        if (existing && existing.ownerId !== user.id) {
          throw new HttpError(409, `«${p.name}» ha lo stesso identificativo di un prodotto che non è tuo: import annullato`);
        }
        if (existing) await tx.product.update({ where: { id: row.id }, data: row });
        else await tx.product.create({ data: row });
        imported++;
      }
    });
    return Response.json({ imported }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

/** Elimina tutti i prodotti di un lotto importato. */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    const batch = new URL(req.url).searchParams.get("batch");
    if (!batch) throw new HttpError(400, "Lotto mancante");
    const res = await prisma.product.deleteMany({ where: { ownerId: user.id, source: "import", importBatch: batch } });
    return Response.json({ deleted: res.count });
  } catch (err) {
    return handleError(err);
  }
}
