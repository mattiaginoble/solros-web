/**
 * Estrazione dei metadati pubblici di una pagina prodotto: dati strutturati
 * JSON-LD (schema.org Product/Offer) e, in mancanza, Open Graph e meta tag.
 * Il risultato precompila il modulo che l'utente conferma o corregge.
 */
import { normalizeText } from "./filter";
import { inferShape, categoryForShape, parseDimensions, parseLocaleNumber, unitToCm } from "./normalize";
import { safeUrl } from "./importMapping";

export interface LinkMetadata {
  name?: string;
  retailer?: string;
  code?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  url: string;
  color?: string;
  description?: string;
  width?: number;
  depth?: number;
  height?: number;
  category?: string;
  shape?: string;
  mount?: string;
  /** Vero se la pagina descrive un singolo prodotto (non una categoria o una ricerca). */
  isProduct: boolean;
  /** Campi trovati e loro origine, per mostrare all'utente cosa verificare. */
  found: string[];
}

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return undefined;
  const c = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return c ? decodeEntities(c).trim() : undefined;
}

type Json = Record<string, unknown>;

function collectNodes(value: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(value)) value.forEach((v) => collectNodes(v, out));
  else if (value && typeof value === "object") {
    const o = value as Json;
    out.push(o);
    if (o["@graph"]) collectNodes(o["@graph"], out);
    if (o.mainEntity) collectNodes(o.mainEntity, out);
    if (o.hasVariant) collectNodes(o.hasVariant, out);
  }
  return out;
}

const isType = (node: Json, t: string) => {
  const ty = node["@type"];
  return Array.isArray(ty) ? ty.includes(t) : ty === t;
};

const text = (v: unknown): string | undefined => {
  if (typeof v === "string") return decodeEntities(v).trim() || undefined;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "name" in (v as Json)) return text((v as Json).name);
  return undefined;
};

function quantity(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" || typeof v === "string") {
    const s = String(v);
    const n = parseLocaleNumber(s);
    if (n === null) return undefined;
    const unit = /(mm|cm|m)\s*$/i.exec(s.trim())?.[1];
    return n * unitToCm(unit ?? "cm");
  }
  if (typeof v === "object") {
    const o = v as Json;
    const n = parseLocaleNumber(o.value);
    if (n === null) return undefined;
    return n * unitToCm(String(o.unitCode ?? o.unitText ?? "cm"));
  }
  return undefined;
}

/** Prezzo attuale fra le specifiche di prezzo (si scartano prezzo barrato e di listino). */
function currentPriceSpec(value: unknown): Json | undefined {
  const specs = (Array.isArray(value) ? value : value ? [value] : []).filter((v): v is Json => !!v && typeof v === "object");
  return specs.find((s) => !/strikethrough|listprice|msrp/i.test(String(s.priceType ?? ""))) ?? specs[0];
}

const MEASURE_LABEL = /<(span|dt|th|div)\b[^>]*class=["']([^"']*)["'][^>]*>([^<]{1,60})<\/\1>\s*<(?:span|dd|td|div)\b[^>]*>([^<]{1,40})</gi;

const MEASURE_KEYS: Record<string, string> = {
  larghezza: "width",
  width: "width",
  profondita: "depth",
  depth: "depth",
  altezza: "height",
  height: "height",
  lunghezza: "length",
  length: "length",
  diametro: "diameter",
  diameter: "diameter",
};

/**
 * Misure principali dalla scheda «Misure» della pagina (per esempio IKEA:
 * measurement-name / measurement-value). Si leggono solo le etichette esatte,
 * non quelle di sedile, pacco o imballo.
 */
export function measurementList(
  html: string,
  shape?: string,
): { width?: number; depth?: number; height?: number; seatDiameter?: number; seatHeight?: number } {
  const values: Record<string, number> = {};
  const fallback: Record<string, number> = {};
  /** Valore più grande fra le etichette che iniziano con la stessa misura («Altezza testiera»…). */
  const largest: Record<string, number> = {};
  const sides: { right?: number; left?: number } = {};
  const seat: { diameter?: number; height?: number } = {};
  for (const m of html.matchAll(MEASURE_LABEL)) {
    const cls = m[2].toLowerCase();
    if (!/measure|dimension|misur/.test(cls) || /package|pacco|imball/.test(cls)) continue;
    const label = normalizeText(decodeEntities(m[3])).replace(/[:\s]+$/, "").trim();
    const value = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i.exec(decodeEntities(m[4]).trim());
    if (!value) continue;
    const cm = Math.round(Number(value[1].replace(",", ".")) * unitToCm(value[2].toLowerCase()) * 10) / 10;
    if (!(cm > 0)) continue;
    const key = MEASURE_KEYS[label];
    if (key) values[key] ??= cm;
    // «Altezza, inclusi cuscini schienale», «Profondità minima»: solo se manca l'etichetta semplice.
    const variant = /^(larghezza|profondita|altezza|lunghezza|diametro),? (?:minima|inclus\w*|con)\b/.exec(label);
    if (variant) fallback[MEASURE_KEYS[variant[1]]] ??= cm;
    // Tappeti: lo spessore è l'altezza.
    if (label === "spessore") fallback.height ??= cm;
    // Sedile: misura d'ingombro degli sgabelli senza schienale.
    if (/^diametro (sedile|seduta)$/.test(label)) seat.diameter ??= cm;
    if (/^altezza (sedile|seduta)$/.test(label)) seat.height ??= cm;
    // Divani angolari: i due lati della L.
    if (/^larghezza (destra|lato destro)$/.test(label)) sides.right ??= cm;
    if (/^larghezza (sinistra|lato sinistro)$/.test(label)) sides.left ??= cm;
    const prefixed = /^(larghezza|profondita|altezza|diametro)\b(.*)$/.exec(label);
    if (prefixed && !/sedile|seduta|intern|materasso|bracciolo|spazio|minima|massima|pacco/.test(prefixed[2])) {
      const k = MEASURE_KEYS[prefixed[1]];
      largest[k] = Math.max(largest[k] ?? 0, cm);
    }
  }
  for (const [k, v] of Object.entries(fallback)) values[k] ??= v;
  let { width, depth, height } = values;
  const { length, diameter } = values;
  if (width === undefined && sides.right && sides.left) {
    // L: un lato è la larghezza, l'altro la profondità d'ingombro (non quella della seduta).
    width = Math.max(sides.right, sides.left);
    depth = Math.min(sides.right, sides.left);
  }
  if (length !== undefined) {
    if (width === undefined) width = length;
    else if (depth === undefined) {
      // Letti e tappeti: la lunghezza è la profondità; tavoli e altro: il lato lungo è la larghezza.
      if (shape === "bed" || shape === "rug") depth = length;
      else [width, depth] = [Math.max(width, length), Math.min(width, length)];
    }
  }
  // Lampade: «Diametro», oppure il più grande fra «Diametro base» e «Diametro paralume».
  const round = diameter ?? largest.diameter;
  if (round !== undefined) {
    // Specchio tondo: il diametro è larghezza e altezza, non profondità.
    width ??= round;
    if (shape === "mirror") height ??= round;
    else depth ??= round;
  }
  // Letti: «Altezza testiera» è l'altezza d'ingombro quando manca quella semplice.
  width ??= largest.width;
  depth ??= largest.depth;
  height ??= largest.height;
  return { width, depth, height, seatDiameter: seat.diameter, seatHeight: seat.height };
}

export function extractProductMetadata(html: string, pageUrl: string): LinkMetadata {
  const found: string[] = [];
  const meta: LinkMetadata = { url: pageUrl, found, isProduct: false };
  const set = <K extends keyof LinkMetadata>(k: K, v: LinkMetadata[K] | undefined, source: string) => {
    if (v === undefined || v === null || v === "" || meta[k] !== undefined) return;
    meta[k] = v;
    found.push(`${String(k)} (${source})`);
  };

  // 1. JSON-LD
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const nodes: Json[] = [];
  for (const m of scripts) {
    try {
      collectNodes(JSON.parse(m[1].trim()), nodes);
    } catch {
      /* blocco JSON-LD non valido: si ignora */
    }
  }
  const product = nodes.find((n) => isType(n, "Product") || isType(n, "ProductGroup"));
  if (product) {
    set("name", text(product.name), "JSON-LD");
    set("code", text(product.sku ?? product.mpn ?? product.productID ?? product.gtin13), "JSON-LD");
    set("retailer", text(product.brand ?? product.manufacturer), "JSON-LD");
    set("color", text(product.color), "JSON-LD");
    set("description", text(product.description), "JSON-LD");
    set("category", text(product.category), "JSON-LD");
    const image = Array.isArray(product.image) ? product.image[0] : product.image;
    const imageUrl = typeof image === "object" && image ? ((image as Json).url ?? (image as Json).contentUrl) : image;
    set("imageUrl", safeUrl(text(imageUrl) ?? ""), "JSON-LD");
    const offersRaw = product.offers;
    const offers = (Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : []) as Json[];
    const offer = offers[0];
    if (offer) {
      const spec = currentPriceSpec(offer.priceSpecification);
      const price = parseLocaleNumber(offer.price ?? offer.lowPrice ?? spec?.price);
      set("price", price ?? undefined, "JSON-LD");
      set("currency", text(offer.priceCurrency ?? spec?.priceCurrency), "JSON-LD");
      set("retailer", text(offer.seller), "JSON-LD");
    }
    set("width", quantity(product.width), "JSON-LD");
    set("depth", quantity(product.depth), "JSON-LD");
    set("height", quantity(product.height), "JSON-LD");
    const props = (Array.isArray(product.additionalProperty) ? product.additionalProperty : []) as Json[];
    for (const p of props) {
      const name = (text(p.name) ?? "").toLowerCase();
      const value = quantity({ value: p.value, unitCode: p.unitCode ?? p.unitText });
      if (/larghezza|width/.test(name)) set("width", value, "JSON-LD");
      if (/profondit|depth/.test(name)) set("depth", value, "JSON-LD");
      if (/altezza|height/.test(name)) set("height", value, "JSON-LD");
    }
  }

  // 2. Open Graph e meta tag
  set("name", metaContent(html, "og:title"), "Open Graph");
  set("imageUrl", safeUrl(metaContent(html, "og:image") ?? ""), "Open Graph");
  const ogPrice = parseLocaleNumber(metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount"));
  set("price", ogPrice ?? undefined, "Open Graph");
  set("currency", metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency"), "Open Graph");
  set("retailer", metaContent(html, "og:site_name") ?? metaContent(html, "product:brand"), "Open Graph");
  set("description", metaContent(html, "og:description") ?? metaContent(html, "description"), "meta");
  if (!meta.name) {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
    set("name", title ? decodeEntities(title).replace(/\s+/g, " ").trim() : undefined, "titolo pagina");
  }

  // 3. Scheda delle misure della pagina (coppie etichetta / valore)
  if (!meta.width || !meta.depth || !meta.height) {
    const m = measurementList(html, inferShape(`${meta.name ?? ""} ${meta.category ?? ""}`).shape);
    // Sgabelli: tondi, e l'altezza del sedile è l'altezza d'ingombro.
    if (/sgabell|stool/.test(normalizeText(meta.name ?? ""))) {
      m.width ??= m.seatDiameter;
      m.depth ??= m.width;
      m.height ??= m.seatHeight;
    }
    set("width", m.width, "scheda misure");
    set("depth", m.depth, "scheda misure");
    set("height", m.height, "scheda misure");
  }

  // 4. Misure dal testo della descrizione
  if (meta.description && (!meta.width || !meta.depth || !meta.height)) {
    const d = parseDimensions(meta.description);
    set("width", d.width, "descrizione");
    set("depth", d.depth, "descrizione");
    set("height", d.height, "descrizione");
  }
  if (!meta.retailer) {
    try {
      set("retailer", new URL(pageUrl).hostname.replace(/^www\./, ""), "indirizzo");
    } catch {
      /* URL già validato a monte */
    }
  }
  const inferred = inferShape(`${meta.name ?? ""} ${meta.category ?? ""}`);
  meta.shape = inferred.shape;
  meta.mount = inferred.mount;
  if (!meta.width && !meta.depth && meta.name) {
    const name = normalizeText(meta.name).replace(/,(\d)/g, ".$1");
    // Tappeti: "160x230 cm" nel nome.
    const rug = inferred.shape === "rug" ? /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/.exec(name) : null;
    if (rug) {
      const k = unitToCm(rug[3] ?? "cm");
      set("width", Number(rug[1]) * k, "nome");
      set("depth", Number(rug[2]) * k, "nome");
    }
    // Lampade a sospensione o da parete e piante: la misura nel nome è il diametro.
    if (/^(lamp-ceiling|lamp-wall|plant)$/.test(inferred.shape)) {
      const last = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm)\b/g)].at(-1);
      const diameter = last ? Number(last[1]) * unitToCm(last[2]) : undefined;
      if (diameter && diameter !== meta.height) {
        set("width", diameter, "nome (diametro)");
        set("depth", diameter, "nome (diametro)");
      }
    }
  }
  // Tappeti senza spessore indicato: 1 cm, quanto basta per la pianta e il 3D.
  if (inferred.shape === "rug" && meta.width && meta.depth && !meta.height) set("height", 1, "tappeto (spessore stimato)");
  // Oggetti a parete e piante con una misura mancante: stime minime per pianta e 3D.
  if (inferred.shape === "mirror" && meta.width && meta.height) set("depth", 3, "specchio (spessore stimato)");
  if (inferred.shape === "lamp-wall" && meta.width) set("height", meta.width, "lampada (altezza stimata)");
  if (inferred.shape === "plant" && meta.width) {
    set("depth", meta.width, "pianta (vaso tondo)");
    set("height", Math.round(meta.width * 3), "pianta (altezza stimata dal vaso)");
  }
  if (inferred.shape === "lamp-floor" && meta.width) set("depth", meta.width, "lampada (paralume tondo)");
  // Lampade a sospensione: paralume tondo (profondità = larghezza) e altezza stimata se manca.
  if (inferred.shape === "lamp-ceiling" && meta.width) {
    set("depth", meta.width, "lampada (paralume tondo)");
    set("height", 25, "lampada (altezza stimata)");
  }
  // og:type "product" sì, "product.group" (pagine di categoria) no.
  const ogType = (metaContent(html, "og:type") ?? "").toLowerCase();
  meta.isProduct = !!product || ["product", "product.item", "og:product"].includes(ogType) || meta.price !== undefined;
  if (!meta.category || meta.category.length > 60) meta.category = categoryForShape(inferred.shape);
  if (meta.currency) meta.currency = meta.currency.toUpperCase().slice(0, 3);
  return meta;
}
