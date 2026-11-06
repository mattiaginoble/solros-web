import { extractProductMetadata } from "@/catalog/linkMetadata";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { fetchProductPage } from "@/lib/server/safeFetch";
import { getCurrentUser } from "@/lib/server/user";

/**
 * Legge i metadati pubblici (JSON-LD, Open Graph) di UNA pagina prodotto,
 * su richiesta esplicita dell'utente. Il risultato precompila il modulo di
 * inserimento: nulla viene salvato finché l'utente non conferma.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await readJson(req, 4096)) as { url?: string };
    if (!body.url || typeof body.url !== "string" || body.url.length > 2048) throw new HttpError(400, "Indirizzo mancante");
    const page = await fetchProductPage(body.url.trim(), user.id);
    const metadata = extractProductMetadata(page.html, page.url);
    return Response.json({ metadata, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
