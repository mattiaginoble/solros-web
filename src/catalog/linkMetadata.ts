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
      const price = parseLocaleNumber(offer.price ?? offer.lowPrice ?? (offer.priceSpecification as Json | undefined)?.price);
      set("price", price ?? undefined, "JSON-LD");
      set("currency", text(offer.priceCurrency ?? (offer.priceSpecification as Json | undefined)?.priceCurrency), "JSON-LD");
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

  // 3. Misure dal testo della descrizione
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
  // og:type "product" sì, "product.group" (pagine di categoria) no.
  const ogType = (metaContent(html, "og:type") ?? "").toLowerCase();
  meta.isProduct = !!product || ["product", "product.item", "og:product"].includes(ogType) || meta.price !== undefined;
  if (!meta.category || meta.category.length > 60) meta.category = categoryForShape(inferred.shape);
  if (meta.currency) meta.currency = meta.currency.toUpperCase().slice(0, 3);
  return meta;
}
