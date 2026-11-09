import { headersOf } from "@/catalog/feedRows";
import { downloadFeed, parseFeed } from "@/lib/server/feeds";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/user";

const PREVIEW_ROWS = 200;

/** Scarica un feed dall'indirizzo indicato e ne restituisce le colonne e un'anteprima delle righe. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await readJson(req, 4096)) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim() || body.url.length > 2048) throw new HttpError(400, "Indirizzo del feed mancante");
    const rows = parseFeed(await downloadFeed(body.url.trim(), user.id));
    return Response.json({ rows: rows.slice(0, PREVIEW_ROWS), total: rows.length, headers: headersOf(rows) });
  } catch (err) {
    return handleError(err);
  }
}
