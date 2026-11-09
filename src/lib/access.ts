/**
 * Accesso riservato al sito: se SITE_PASSWORD è impostata, pagine e API
 * richiedono un cookie che vale solo per quella password (HMAC). Cambiando la
 * password, tutti gli accessi precedenti decadono. Usato dal proxy e dalla
 * route di accesso: solo Web Crypto, nessuna dipendenza da Node.
 */

export const ACCESS_COOKIE = "cc_access";
/** Cookie leggibile dal browser: dice solo che l'accesso è attivo (per mostrare "Esci"). */
export const ACCESS_HINT_COOKIE = "cc_access_attivo";

const encoder = new TextEncoder();

export function sitePassword(): string | null {
  const p = process.env.SITE_PASSWORD?.trim();
  return p ? p : null;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Valore del cookie di accesso per una password. */
export async function accessToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode("configuratore-casa:accesso:v1"))));
}

/** Confronto a tempo costante (per stringhe della stessa lunghezza). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica la password confrontando gli HMAC (lunghezza fissa, nessuna informazione dai tempi). */
export async function passwordMatches(given: string, password: string): Promise<boolean> {
  return constantTimeEqual(await accessToken(given), await accessToken(password));
}

/** Percorso interno a cui tornare dopo l'accesso (mai un sito esterno). */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}
