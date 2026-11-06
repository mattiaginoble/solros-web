import "server-only";
/**
 * Lettura di una singola pagina web su richiesta esplicita dell'utente, con:
 * - protezione SSRF (solo http/https su porte standard, nessun indirizzo
 *   privato, di loopback o link-local, redirect rivalidati);
 * - rispetto di robots.txt;
 * - una richiesta alla volta per utente e intervallo minimo per dominio;
 * - timeout e dimensione massima della risposta.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./http";

export const USER_AGENT = "ConfiguratoreCasa/1.0 (anteprima di un singolo prodotto richiesta dall'utente)";
const ROBOTS_AGENT = "configuratorecasa";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const HOST_INTERVAL_MS = 3_000;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

/** Valida l'URL e verifica che il nome risolva solo a indirizzi pubblici. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Indirizzo non valido");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "Sono ammessi solo indirizzi http o https");
  if (url.username || url.password) throw new HttpError(400, "Indirizzo non ammesso");
  if (url.port && url.port !== "80" && url.port !== "443") throw new HttpError(400, "Porta non ammessa");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpError(400, "Indirizzo non ammesso");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new HttpError(400, "Dominio non raggiungibile");
  if (addresses.some((a) => isPrivateIp(a.address))) throw new HttpError(400, "Indirizzo non ammesso");
  return url;
}

async function readLimited(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, max - size));
      size = max;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/** GET con redirect gestiti a mano (ogni destinazione viene rivalidata). */
async function guardedGet(start: URL, accept: string, maxBytes: number): Promise<{ url: URL; status: number; body: string; type: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "it-IT,it;q=0.9,en;q=0.6" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      const body = await readLimited(res, maxBytes);
      return { url, status: res.status, body, type };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(504, "Il sito non ha risposto in tempo");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(508, "Troppi reindirizzamenti");
}

// ---------------------------------------------------------------------------
// robots.txt

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

const robotsCache = new Map<string, { at: number; rules: RobotsRules }>();

/** Regole per il nostro user agent (o per "*") da un robots.txt. */
export function parseRobots(txt: string, agent = ROBOTS_AGENT): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    if (key === "disallow" && value) current.disallow.push(value);
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow) };
}

function ruleMatches(rule: string, path: string) {
  const re = new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  return re.test(path);
}

/** Vero se il percorso è consentito (vince la regola più lunga, Allow a parità). */
export function robotsAllows(rules: RobotsRules, path: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules.disallow) if (ruleMatches(r, path) && (!best || r.length > best.len)) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (ruleMatches(r, path) && (!best || r.length >= best.len)) best = { len: r.length, allow: true };
  return best ? best.allow : true;
}

async function robotsFor(url: URL): Promise<RobotsRules> {
  const cached = robotsCache.get(url.origin);
  if (cached && Date.now() - cached.at < 3600_000) return cached.rules;
  let rules: RobotsRules = { allow: [], disallow: [] };
  try {
    const res = await guardedGet(new URL("/robots.txt", url.origin), "text/plain", 512 * 1024);
    if (res.status >= 200 && res.status < 300) rules = parseRobots(res.body);
    // 401/403 su robots.txt: il sito non vuole accessi automatici.
    if (res.status === 401 || res.status === 403) rules = { allow: [], disallow: ["/"] };
  } catch {
    /* robots.txt irraggiungibile: si procede come se non esistesse */
  }
  robotsCache.set(url.origin, { at: Date.now(), rules });
  return rules;
}

// ---------------------------------------------------------------------------
// Limiti di frequenza

const busyUsers = new Set<string>();
const lastHit = new Map<string, number>();

/** Legge una pagina HTML pubblica rispettando robots.txt e i limiti di frequenza. */
export async function fetchProductPage(rawUrl: string, userId: string): Promise<{ url: string; html: string }> {
  if (busyUsers.has(userId)) throw new HttpError(429, "È già in corso la lettura di un'altra pagina: attendi qualche secondo");
  busyUsers.add(userId);
  try {
    const url = await assertPublicUrl(rawUrl);
    const last = lastHit.get(url.hostname) ?? 0;
    if (Date.now() - last < HOST_INTERVAL_MS) throw new HttpError(429, "Attendi qualche secondo prima di leggere un'altra pagina dello stesso sito");
    lastHit.set(url.hostname, Date.now());
    const rules = await robotsFor(url);
    if (!robotsAllows(rules, url.pathname + url.search)) {
      throw new HttpError(403, "Il sito non consente la lettura automatica di questa pagina (robots.txt): inserisci i dati a mano");
    }
    const res = await guardedGet(url, "text/html,application/xhtml+xml", MAX_BYTES);
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new HttpError(502, "Il sito ha rifiutato la richiesta: inserisci i dati del prodotto a mano");
    }
    if (res.status >= 400) throw new HttpError(502, `Il sito ha risposto con errore ${res.status}`);
    if (!/html/i.test(res.type)) throw new HttpError(415, "L'indirizzo non è una pagina web");
    return { url: res.url.toString(), html: res.body };
  } finally {
    busyUsers.delete(userId);
  }
}
