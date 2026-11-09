import { constantTimeEqual } from "@/lib/access";
import { handleError } from "@/lib/server/http";
import { storeSyncStatus, syncStorePages } from "@/lib/server/storeSync";

// Le letture sono distanziate di qualche secondo: serve il tempo massimo del piano gratuito.
export const maxDuration = 300;

/**
 * Aggiornamento pianificato del catalogo «Negozi» (vercel.json → crons).
 * Vercel invia `Authorization: Bearer <CRON_SECRET>`; senza la variabile la route resta chiusa.
 * Con `?stato=1` restituisce solo il riepilogo, senza leggere pagine.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !constantTimeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }
  try {
    if (new URL(req.url).searchParams.has("stato")) return Response.json(await storeSyncStatus());
    return Response.json(await syncStorePages());
  } catch (err) {
    return handleError(err);
  }
}
