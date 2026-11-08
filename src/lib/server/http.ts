import "server-only";
import type { ZodError } from "zod";

/** Contesto delle route con parametro dinamico (tipi espliciti: valgono anche nella build statica). */
export type IdContext = { params: Promise<{ id: string }> };
export type TokenContext = { params: Promise<{ token: string }> };

export function jsonError(status: number, message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export function zodDetails(err: ZodError) {
  return err.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** Legge il body JSON rispettando un limite di dimensione. */
export async function readJson(req: Request, maxBytes = 20 * 1024 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Richiesta troppo grande");
  // Lettura a blocchi: ci si ferma appena si supera il limite, senza caricare
  // in memoria un body inviato in streaming senza content-length.
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Richiesta troppo grande");
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks, size));
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON non valido");
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return jsonError(err.status, err.message, err.details);
  console.error(err);
  return jsonError(500, "Errore interno");
}
