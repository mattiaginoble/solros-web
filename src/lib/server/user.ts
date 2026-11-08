import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { HttpError } from "./http";

export const USER_COOKIE = "cc_uid";

/**
 * Utenti semplici: ogni browser riceve un'identità anonima in un cookie httpOnly,
 * con un nome modificabile. Nessuna password: è sufficiente per separare i
 * progetti tra dispositivi o persone diverse in un'installazione locale.
 */
export async function findCurrentUser() {
  const jar = await cookies();
  const id = jar.get(USER_COOKIE)?.value;
  return id ? prisma.user.findUnique({ where: { id } }) : null;
}

/**
 * Utente corrente, senza crearne uno: per modificare o eliminare dati che
 * devono già appartenergli. Senza sessione non c'è nulla di suo.
 */
export async function requireUser() {
  const user = await findCurrentUser();
  if (!user) throw new HttpError(403, "Sessione non trovata: ricarica la pagina");
  return user;
}

/**
 * Utente corrente; se manca, ne crea uno nuovo e imposta il cookie. Solo per
 * le richieste che creano dati: le letture non devono generare utenti.
 */
export async function getCurrentUser() {
  const existing = await findCurrentUser();
  if (existing) return existing;
  const jar = await cookies();
  const user = await prisma.user.create({ data: {} });
  jar.set(USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return user;
}
