import "server-only";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

/**
 * Manutenzione: le route /api/admin esistono solo se ADMIN_TOKEN (almeno 32
 * caratteri) è impostato, e richiedono `Authorization: Bearer <ADMIN_TOKEN>`.
 * Senza token, o con un token sbagliato, rispondono 404 come se non ci fossero.
 */
export function assertAdmin(req: Request, expected = process.env.ADMIN_TOKEN) {
  const notFound = new HttpError(404, "Non trovato");
  if (!expected || expected.length < 32) throw notFound;
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) throw notFound;
}
