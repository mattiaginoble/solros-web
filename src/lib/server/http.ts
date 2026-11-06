import "server-only";
import type { ZodError } from "zod";

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
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Richiesta troppo grande");
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
