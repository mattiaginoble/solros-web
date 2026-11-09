import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_HINT_COOKIE, accessToken, passwordMatches, sitePassword } from "@/lib/access";
import { readJson } from "@/lib/server/http";
import { SlidingWindowLimiter } from "@/lib/server/rateLimit";

const ONE_YEAR = 60 * 60 * 24 * 365;
// Tentativi sbagliati: 10 ogni 15 minuti per indirizzo.
const failures = new SlidingWindowLimiter(10, 15 * 60_000);

const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sconosciuto";
const secure = () => process.env.VERCEL === "1";

/** Accesso con la password del sito. Body: { password }. */
export async function POST(req: Request) {
  const password = sitePassword();
  if (!password) return NextResponse.json({ ok: true, open: true });
  const ip = clientIp(req);
  const wait = failures.wait(ip);
  if (wait > 0) {
    return NextResponse.json({ error: `Troppi tentativi: riprova tra ${Math.ceil(wait / 60_000)} minuti` }, { status: 429 });
  }
  let given = "";
  try {
    const body = (await readJson(req, 4096)) as { password?: unknown };
    given = typeof body.password === "string" ? body.password : "";
  } catch {
    /* body non valido: trattato come password sbagliata */
  }
  if (!given || !(await passwordMatches(given, password))) {
    failures.record(ip);
    return NextResponse.json({ error: "Password non corretta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await accessToken(password), { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: ONE_YEAR });
  res.cookies.set(ACCESS_HINT_COOKIE, "1", { httpOnly: false, sameSite: "lax", secure: secure(), path: "/", maxAge: ONE_YEAR });
  return res;
}

/** Uscita: cancella il cookie di accesso. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 0 });
  res.cookies.set(ACCESS_HINT_COOKIE, "", { httpOnly: false, sameSite: "lax", secure: secure(), path: "/", maxAge: 0 });
  return res;
}
