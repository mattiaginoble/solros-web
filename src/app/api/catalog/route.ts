import { z } from "zod";
import { searchCatalog } from "@/catalog/service";
import { handleError, HttpError, zodDetails } from "@/lib/server/http";
import { findCurrentUser } from "@/lib/server/user";

const num = z.coerce.number().finite().optional();
const QuerySchema = z.object({
  q: z.string().max(200).optional(),
  retailer: z.array(z.string().max(120)).max(20).optional(),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  priceMin: num,
  priceMax: num,
  maxWidth: num,
  maxDepth: num,
  maxHeight: num,
  color: z.string().max(60).optional(),
  source: z.array(z.enum(["demo", "import", "link", "manual"])).optional(),
  mount: z.enum(["floor", "wall", "ceiling"]).optional(),
  sort: z.enum(["relevance", "price-asc", "price-desc", "name"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** Ricerca nel catalogo con filtri per rivenditore, categoria, prezzo, dimensioni e colore. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const raw: Record<string, unknown> = {};
    for (const key of new Set(sp.keys())) {
      const values = sp.getAll(key).filter((v) => v !== "");
      if (!values.length) continue;
      raw[key] = key === "retailer" || key === "source" ? values : values[0];
    }
    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, "Parametri di ricerca non validi", zodDetails(parsed.error));
    const q = parsed.data;
    const user = await findCurrentUser();
    const result = await searchCatalog(
      {
        text: q.q,
        retailers: q.retailer,
        category: q.category,
        subcategory: q.subcategory,
        priceMin: q.priceMin,
        priceMax: q.priceMax,
        maxWidth: q.maxWidth,
        maxDepth: q.maxDepth,
        maxHeight: q.maxHeight,
        color: q.color,
        sources: q.source,
        mount: q.mount,
        sort: q.sort,
        limit: q.limit,
        offset: q.offset,
      },
      { userId: user?.id ?? null },
    );
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
