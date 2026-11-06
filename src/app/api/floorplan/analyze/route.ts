import { analyzeWithClaude, claudeAnalyzerEnabled } from "@/floorplan/claudeAnalyzer";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/user";

const MAX_BYTES = 8 * 1024 * 1024;

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
    await getCurrentUser();
    if (!claudeAnalyzerEnabled()) throw new HttpError(501, "Analizzatore remoto non configurato");
    const body = (await readJson(req, MAX_BYTES * 1.4)) as { image?: string; width?: number; height?: number };
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? "");
    if (!m) throw new HttpError(400, "Immagine non valida: serve un PNG, JPEG o WebP");
    const width = Number(body.width);
    const height = Number(body.height);
    if (!(width > 0 && height > 0 && width <= 4000 && height <= 4000)) throw new HttpError(400, "Dimensioni non valide");
    if ((m[2].length * 3) / 4 > MAX_BYTES) throw new HttpError(413, "Immagine troppo grande");
    const analysis = await analyzeWithClaude({
      base64: m[2],
      mediaType: m[1] as "image/png" | "image/jpeg" | "image/webp",
      width,
      height,
    });
    return Response.json({ analysis });
  } catch (err) {
    if (err instanceof SyntaxError) return handleError(new HttpError(502, "Risposta del modello non leggibile"));
    if (err instanceof Error && !(err instanceof HttpError) && err.message.startsWith("L'analisi")) {
      return handleError(new HttpError(422, err.message));
    }
    return handleError(err);
  }
}
