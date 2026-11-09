import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { refreshFeed } from "@/lib/server/feeds";
import { handleError, HttpError, readJson, zodDetails } from "@/lib/server/http";
import { assertPublicUrl } from "@/lib/server/safeFetch";
import { getCurrentUser } from "@/lib/server/user";

const MAX_FEEDS_PER_USER = 20;

const FeedSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1).max(2048),
  mapping: z.record(z.string().max(40), z.string().max(200)),
  unit: z.enum(["cm", "mm", "m"]).default("cm"),
  retailer: z.string().trim().max(120).default(""),
  currency: z.string().trim().length(3).default("EUR"),
});

/** Salva (o aggiorna) un feed e lo importa subito; poi si aggiorna da solo ogni giorno. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const parsed = FeedSchema.safeParse(await readJson(req, 16 * 1024));
    if (!parsed.success) throw new HttpError(422, "Dati del feed non validi", zodDetails(parsed.error));
    const input = parsed.data;
    if (!input.mapping.name || !input.mapping.price) throw new HttpError(422, "Indica almeno le colonne del nome e del prezzo");
    await assertPublicUrl(input.url);
    const existing = await prisma.catalogFeed.findUnique({ where: { ownerId_name: { ownerId: user.id, name: input.name } } });
    if (!existing && (await prisma.catalogFeed.count({ where: { ownerId: user.id } })) >= MAX_FEEDS_PER_USER) {
      throw new HttpError(409, `Puoi salvare al massimo ${MAX_FEEDS_PER_USER} feed`);
    }
    const data = {
      url: input.url,
      mapping: JSON.stringify(input.mapping),
      unit: input.unit,
      retailer: input.retailer || "Importato",
      currency: input.currency.toUpperCase(),
    };
    const feed = await prisma.catalogFeed.upsert({
      where: { ownerId_name: { ownerId: user.id, name: input.name } },
      create: { ownerId: user.id, name: input.name, ...data },
      update: data,
    });
    const result = await refreshFeed(feed);
    return Response.json({ feedId: feed.id, ...result }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
