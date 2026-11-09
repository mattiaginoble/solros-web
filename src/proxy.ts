import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, constantTimeEqual, sitePassword } from "@/lib/access";

/**
 * Sito riservato: con SITE_PASSWORD impostata, chi non ha il cookie di accesso
 * viene mandato alla pagina della password (le API rispondono 401). Senza
 * SITE_PASSWORD il sito resta aperto. Nella build statica questo file non c'è.
 */
export async function proxy(req: NextRequest) {
  const password = sitePassword();
  if (!password) return NextResponse.next();
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && constantTimeEqual(cookie, await accessToken(password))) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accesso riservato: inserisci la password del sito" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/accesso";
  url.search = pathname === "/" && !search ? "" : `?da=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Tutto tranne: pagina e API di accesso, link di condivisione in sola lettura,
    // aggiornamenti pianificati (protetti da CRON_SECRET), file statici di Next,
    // icona e feed d'esempio pubblico.
    "/((?!accesso|api/access|api/share/|share/|api/cron/|_next/static|_next/image|icon\\.svg|favicon\\.ico|robots\\.txt|esempio-feed\\.xml).*)",
  ],
};
