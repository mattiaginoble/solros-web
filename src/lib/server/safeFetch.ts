import "server-only";
/**
 * Lettura di una singola pagina web su richiesta esplicita dell'utente, con:
 * - protezione SSRF (solo http/https su porte standard, nessun indirizzo
 *   privato, di loopback o link-local, anche in forma IPv6; redirect
 *   rivalidati; indirizzo controllato anche al momento della connessione);
 * - rispetto di robots.txt;
 * - una richiesta alla volta per utente e intervallo minimo per dominio;
 * - timeout e dimensione massima della risposta.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { HttpError } from "./http";

export const USER_AGENT = "ConfiguratoreCasa/1.0 (anteprima di un singolo prodotto richiesta dall'utente)";
const ROBOTS_AGENT = "configuratorecasa";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REQUESTS = 4; // richiesta iniziale + 3 reindirizzamenti
const HOST_INTERVAL_MS = 3_000;

// ---------------------------------------------------------------------------
// Indirizzi ammessi

function isPrivateIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** Gli 8 gruppi da 16 bit di un indirizzo IPv6 (anche con IPv4 finale), o null. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.split("%")[0];
  if (isIP(text) !== 6) return null;
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = text.slice(0, dotted.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const hex = (part: string) => (part ? part.split(":").map((h) => parseInt(h, 16)) : []);
  if (!text.includes("::")) return hex(text);
  const [head, tail] = text.split("::");
  const h = hex(head);
  const t = hex(tail);
  return [...h, ...new Array<number>(8 - h.length - t.length).fill(0), ...t];
}

const embeddedV4 = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];

/**
 * Vero se l'indirizzo non è un unicast pubblico: privato, loopback, link-local,
 * multicast, riservato, oppure IPv6 che incorpora un IPv4 di questo tipo
 * (::ffff:7f00:1, NAT64, 6to4). Gli indirizzi non riconosciuti sono rifiutati.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIpv4(ip.split(".").map(Number));
  const g = ipv6Groups(ip);
  if (!g || g.length !== 8) return true;
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0 || g[5] === 0xffff)) {
    // ::, ::1, IPv4 compatibile (::a.b.c.d) o mappato (::ffff:a.b.c.d)
    if (g[5] === 0 && g[6] === 0) return true;
    return isPrivateIpv4(embeddedV4(g[6], g[7]));
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateIpv4(embeddedV4(g[6], g[7]));
  if (g[0] === 0x2002) return isPrivateIpv4(embeddedV4(g[1], g[2]));
  // Pubblici solo gli unicast globali 2000::/3, esclusi Teredo e documentazione.
  if ((g[0] & 0xe000) !== 0x2000) return true;
  return g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8);
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

/**
 * Lookup DNS usato per aprire la connessione: fallisce se il nome risolve anche
 * a un solo indirizzo non pubblico. Il controllo avviene sull'indirizzo a cui
 * ci si connette davvero, quindi un DNS che cambia risposta dopo
 * `assertPublicUrl` (DNS rebinding) non permette di raggiungere la rete interna.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
      const denied: NodeJS.ErrnoException = new Error(`${hostname}: indirizzo non ammesso`);
      denied.code = "EPRIVATE";
      return callback(denied, "", 0);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

// ---------------------------------------------------------------------------
// Richieste

interface RawResponse {
  status: number;
  location: string | null;
  type: string;
  body: string;
  bytes: Buffer;
  /** Vero se la risposta superava la dimensione massima ed è stata interrotta. */
  truncated: boolean;
}

/** Una singola GET senza seguire i redirect, con limite di tempo totale e di dimensione. */
function requestOnce(url: URL, accept: string, maxBytes: number, timeoutMs: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: publicLookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.6",
          "Accept-Encoding": "gzip, br",
        },
      },
      (res) => {
        res.on("error", (err) => settle(() => reject(err)));
        const status = res.statusCode ?? 0;
        const location = status >= 300 && status < 400 ? (res.headers.location ?? null) : null;
        if (location) {
          settle(() => resolve({ status, location, type: "", body: "", bytes: Buffer.alloc(0), truncated: false }));
          req.destroy();
          return;
        }
        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        const stream: Readable =
          encoding === "gzip" || encoding === "x-gzip" ? res.pipe(zlib.createGunzip()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated = false) =>
          settle(() => {
            const bytes = Buffer.concat(chunks, size);
            resolve({ status, location: null, type: String(res.headers["content-type"] ?? ""), body: bytes.toString("utf8"), bytes, truncated });
          });
        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          const room = maxBytes - size;
          if (chunk.length > room) {
            chunks.push(chunk.subarray(0, room));
            size = maxBytes;
            finish(true);
            req.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () => finish());
        stream.on("error", (err) => settle(() => reject(err)));
      },
    );
    const timer = setTimeout(() => {
      const err: NodeJS.ErrnoException = new Error("timeout");
      err.code = "ETIMEOUT";
      req.destroy(err);
    }, timeoutMs);
    req.on("error", (err) => settle(() => reject(err)));
    req.end();
  });
}

/**
 * GET con redirect gestiti a mano: ogni destinazione viene rivalidata e ogni
 * connessione passa da `publicLookup`. Gli URL con IP letterale devono essere
 * già stati controllati con `assertPublicUrl`.
 */
export async function guardedGet(
  start: URL,
  accept: string,
  maxBytes: number,
  opts: { timeoutMs?: number } = {},
): Promise<{ url: URL; status: number; body: string; type: string; bytes: Buffer; truncated: boolean }> {
  let url = start;
  for (let i = 0; i < MAX_REQUESTS; i++) {
    let res: RawResponse;
    try {
      res = await requestOnce(url, accept, maxBytes, opts.timeoutMs ?? TIMEOUT_MS);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPRIVATE") throw new HttpError(400, "Indirizzo non ammesso");
      if (code === "ETIMEOUT") throw new HttpError(504, "Il sito non ha risposto in tempo");
      if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new HttpError(400, "Dominio non raggiungibile");
      throw new HttpError(502, "Impossibile leggere la pagina dal sito");
    }
    if (!res.location) return { url, status: res.status, body: res.body, type: res.type, bytes: res.bytes, truncated: res.truncated };
    let next: string;
    try {
      next = new URL(res.location, url).toString();
    } catch {
      throw new HttpError(502, "Il sito ha risposto con un reindirizzamento non valido");
    }
    url = await assertPublicUrl(next);
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
