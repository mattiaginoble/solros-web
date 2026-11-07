import { APIConnectionError, APIError, AuthenticationError, InternalServerError, PermissionDeniedError, RateLimitError } from "@anthropic-ai/sdk";
import { analyzeWithClaude, claudeAnalyzerEnabled } from "@/floorplan/claudeAnalyzer";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { envLimit, SlidingWindowLimiter } from "@/lib/server/rateLimit";
import { getCurrentUser } from "@/lib/server/user";

const MAX_BYTES = 8 * 1024 * 1024;
const HOUR = 3600_000;

// Ogni analisi è una chiamata a pagamento all'API: limiti per utente e complessivi.
const perUser = new SlidingWindowLimiter(envLimit("FLOORPLAN_ANALYZER_USER_LIMIT", 10), HOUR);
const overall = new SlidingWindowLimiter(envLimit("FLOORPLAN_ANALYZER_HOURLY_LIMIT", 60), HOUR);
const busyUsers = new Set<string>();

const minutes = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m === 1 ? "1 minuto" : `${m} minuti`;
};

/** Analizzatori disponibili: quello locale c'è sempre, quello remoto solo se configurato. */
export async function GET() {
  const remote = claudeAnalyzerEnabled();
  return Response.json({
    analyzers: [
      { id: "local", label: "Riconoscimento locale", available: true },
      { id: "claude", label: "Riconoscimento con Claude vision", available: remote },
    ],
    default: remote ? "claude" : "local",
  });
}

/** Body: { image: dataURL (png/jpeg/webp), width, height }. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!claudeAnalyzerEnabled()) throw new HttpError(501, "Analizzatore remoto non configurato");
    const body = (await readJson(req, MAX_BYTES * 1.4)) as { image?: string; width?: number; height?: number };
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? "");
    if (!m) throw new HttpError(400, "Immagine non valida: serve un PNG, JPEG o WebP");
    const width = Number(body.width);
    const height = Number(body.height);
    if (!(width > 0 && height > 0 && width <= 4000 && height <= 4000)) throw new HttpError(400, "Dimensioni non valide");
    if ((m[2].length * 3) / 4 > MAX_BYTES) throw new HttpError(413, "Immagine troppo grande");
    if (busyUsers.has(user.id)) throw new HttpError(429, "È già in corso un'analisi: attendi che finisca");
    const wait = Math.max(perUser.wait(user.id), overall.wait("tutti"));
    if (wait > 0) {
      throw new HttpError(429, `Limite di analisi con Claude raggiunto: riprova tra ${minutes(wait)} oppure usa il riconoscimento locale`);
    }
    perUser.record(user.id);
    overall.record("tutti");
    busyUsers.add(user.id);
    try {
      const analysis = await analyzeWithClaude({
        base64: m[2],
        mediaType: m[1] as "image/png" | "image/jpeg" | "image/webp",
        width,
        height,
      });
      return Response.json({ analysis });
    } finally {
      busyUsers.delete(user.id);
    }
  } catch (err) {
    if (err instanceof APIError) return handleError(apiErrorToHttp(err));
    if (err instanceof SyntaxError) return handleError(new HttpError(502, "Risposta del modello non leggibile"));
    if (err instanceof Error && !(err instanceof HttpError) && err.message.startsWith("L'analisi")) {
      return handleError(new HttpError(422, err.message));
    }
    return handleError(err);
  }
}

/** Errori dell'API Claude tradotti in messaggi utili; i dettagli restano nel log del server. */
function apiErrorToHttp(err: APIError): HttpError {
  const local = "oppure usa il riconoscimento locale";
  if (err instanceof APIConnectionError) return new HttpError(502, `Il servizio di analisi non è raggiungibile: riprova più tardi ${local}`);
  console.error("Analisi planimetria:", err.status, err.message);
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new HttpError(502, `L'analizzatore remoto non è configurato correttamente (chiave API): ${local}`);
  }
  if (err instanceof RateLimitError || err instanceof InternalServerError) {
    return new HttpError(503, `Il servizio di analisi è momentaneamente sovraccarico: riprova tra poco ${local}`);
  }
  return new HttpError(502, `Analisi non riuscita: ${local}`);
}
