/**
 * Import di cataloghi da CSV o JSON: riconoscimento delle colonne e
 * conversione delle righe in prodotti validati. Funzioni pure.
 */
import { ProductSchema, type MountType, type Product } from "@/domain/schema";
import { normalizeText } from "./filter";
import { categoryForShape, inferShape, parseDimensions, parseLocaleNumber, shortHash, unitToCm } from "./normalize";

export type ImportField =
  | "name"
  | "retailer"
  | "code"
  | "category"
  | "subcategory"
  | "width"
  | "depth"
  | "height"
  | "dimensions"
  | "price"
  | "currency"
  | "color"
  | "imageUrl"
  | "url"
  | "mount"
  | "elevation"
  | "clearanceFront"
  | "modelUrl";

export const IMPORT_FIELDS: { id: ImportField; label: string; required?: boolean; synonyms: string[] }[] = [
  { id: "name", label: "Nome", required: true, synonyms: ["nome", "name", "title", "titolo", "prodotto", "product", "product_name", "nome_prodotto"] },
  { id: "price", label: "Prezzo", required: true, synonyms: ["prezzo", "price", "costo", "importo", "sale_price", "prezzo_eur", "price_eur"] },
  { id: "width", label: "Larghezza", synonyms: ["larghezza", "width", "larg", "l", "w", "larghezza_cm", "width_cm"] },
  { id: "depth", label: "Profondità", synonyms: ["profondita", "depth", "prof", "p", "d", "profondita_cm", "depth_cm", "lunghezza", "length"] },
  { id: "height", label: "Altezza", synonyms: ["altezza", "height", "alt", "h", "altezza_cm", "height_cm"] },
  { id: "dimensions", label: "Dimensioni (testo)", synonyms: ["dimensioni", "dimensions", "misure", "size", "ingombro_totale"] },
  { id: "retailer", label: "Rivenditore", synonyms: ["retailer", "rivenditore", "brand", "marca", "negozio", "store", "venditore", "marchio"] },
  { id: "code", label: "Codice", synonyms: ["codice", "code", "sku", "articolo", "ean", "mpn", "id", "codice_articolo", "gtin"] },
  { id: "category", label: "Categoria", synonyms: ["categoria", "category", "reparto", "product_type", "google_product_category"] },
  { id: "subcategory", label: "Sottocategoria", synonyms: ["sottocategoria", "subcategory", "tipo", "type", "sub_category"] },
  { id: "currency", label: "Valuta", synonyms: ["valuta", "currency"] },
  { id: "color", label: "Colore", synonyms: ["colore", "color", "colour", "finitura", "finish"] },
  { id: "imageUrl", label: "Immagine (URL)", synonyms: ["immagine", "image", "image_url", "img", "foto", "image_link", "picture"] },
  { id: "url", label: "Link prodotto", synonyms: ["url", "link", "product_url", "pagina", "product_link", "deeplink"] },
  { id: "mount", label: "Montaggio", synonyms: ["montaggio", "mount", "installazione", "mounting"] },
  { id: "elevation", label: "Altezza da terra", synonyms: ["altezza_da_terra", "elevation", "quota"] },
  { id: "clearanceFront", label: "Ingombro apertura", synonyms: ["ingombro", "spazio_apertura", "clearance", "ingombro_apertura"] },
  { id: "modelUrl", label: "Modello 3D (glTF)", synonyms: ["modello", "gltf", "glb", "model", "model_url", "modello_3d"] },
];

export type ColumnMapping = Partial<Record<ImportField, string>>;

const normHeader = (h: string) => normalizeText(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Associa automaticamente le colonne ai campi in base al nome dell'intestazione. */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ h, n: normHeader(h) }));
  for (const field of IMPORT_FIELDS) {
    // Prima le corrispondenze esatte, poi quelle per prefisso.
    const exact = normalized.find((x) => !used.has(x.h) && field.synonyms.includes(x.n));
    const partial =
      exact ?? normalized.find((x) => !used.has(x.h) && x.n.length > 2 && field.synonyms.some((s) => s.length > 2 && x.n.startsWith(s)));
    if (partial) {
      mapping[field.id] = partial.h;
      used.add(partial.h);
    }
  }
  return mapping;
}

export interface MapOptions {
  /** Unità delle colonne di misura. */
  unit: "cm" | "mm" | "m";
  retailer: string;
  currency: string;
  batch: string;
  priceDate: string;
}

export interface MapResult {
  products: Product[];
  errors: { row: number; message: string }[];
}

function parseMount(v: unknown, fallback: MountType): MountType {
  const t = typeof v === "string" ? normalizeText(v) : "";
  if (/parete|wall|muro|sospes/.test(t)) return "wall";
  if (/soffitto|ceiling/.test(t)) return "ceiling";
  if (/pavimento|floor|terra/.test(t)) return "floor";
  return fallback;
}

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

/** Converte le righe (oggetti chiave → valore) in prodotti validati. */
export function mapRows(rows: Record<string, unknown>[], mapping: ColumnMapping, opts: MapOptions): MapResult {
  const products: Product[] = [];
  const errors: MapResult["errors"] = [];
  const k = unitToCm(opts.unit);
  const get = (row: Record<string, unknown>, f: ImportField) => (mapping[f] ? row[mapping[f]!] : undefined);
  rows.forEach((row, i) => {
    const line = i + 2; // riga del file (intestazione = 1)
    const name = str(get(row, "name"));
    if (!name) {
      errors.push({ row: line, message: "Nome mancante" });
      return;
    }
    const price = parseLocaleNumber(get(row, "price"));
    if (price === null || price < 0) {
      errors.push({ row: line, message: `Prezzo non valido per «${name}»` });
      return;
    }
    let width = parseLocaleNumber(get(row, "width"));
    let depth = parseLocaleNumber(get(row, "depth"));
    let height = parseLocaleNumber(get(row, "height"));
    width = width !== null ? width * k : null;
    depth = depth !== null ? depth * k : null;
    height = height !== null ? height * k : null;
    const dimText = str(get(row, "dimensions"));
    if (dimText && (width === null || depth === null || height === null)) {
      const d = parseDimensions(dimText);
      width ??= d.width ?? null;
      depth ??= d.depth ?? null;
      height ??= d.height ?? null;
    }
    if (!width || !depth || !height) {
      errors.push({ row: line, message: `Misure mancanti per «${name}» (servono larghezza, profondità e altezza)` });
      return;
    }
    const category = str(get(row, "category"));
    const inferred = inferShape(`${name} ${category} ${str(get(row, "subcategory"))}`);
    const code = str(get(row, "code"));
    const candidate = {
      id: `imp-${shortHash(`${opts.batch}|${code || name}|${opts.retailer}`)}`,
      source: "import" as const,
      retailer: str(get(row, "retailer")) || opts.retailer,
      code: code || undefined,
      name,
      category: category || categoryForShape(inferred.shape),
      subcategory: str(get(row, "subcategory")) || undefined,
      width: Math.round(width * 10) / 10,
      depth: Math.round(depth * 10) / 10,
      height: Math.round(height * 10) / 10,
      price: Math.round(price * 100) / 100,
      currency: (str(get(row, "currency")) || opts.currency).toUpperCase().slice(0, 3),
      color: str(get(row, "color")) || undefined,
      imageUrl: safeUrl(str(get(row, "imageUrl"))),
      url: safeUrl(str(get(row, "url"))),
      mount: parseMount(get(row, "mount"), inferred.mount),
      elevation: parseLocaleNumber(get(row, "elevation")) ?? undefined,
      clearance: { front: parseLocaleNumber(get(row, "clearanceFront")) ?? 0, sides: 0 },
      modelUrl: safeUrl(str(get(row, "modelUrl"))),
      shape: inferred.shape,
      priceUpdatedAt: opts.priceDate,
    };
    const parsed = ProductSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ row: line, message: `Dati non validi per «${name}»: ${parsed.error.issues[0]?.message ?? ""}` });
      return;
    }
    products.push(parsed.data);
  });
  return { products, errors };
}

/** Solo URL http(s) assoluti; tutto il resto viene scartato. */
export function safeUrl(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Righe da un file JSON: array di oggetti, oppure { products: [...] } / { items: [...] }. */
export function rowsFromJson(data: unknown): Record<string, unknown>[] {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ((data as Record<string, unknown>).products ?? (data as Record<string, unknown>).items ?? (data as Record<string, unknown>).data)
      : null;
  if (!Array.isArray(arr)) throw new Error("Il JSON deve contenere un elenco di prodotti");
  return arr.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)).map((x) => flatten(x));
}

/** Appiattisce oggetti annidati in chiavi "a.b" (es. offers.price). */
function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, unknown> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value as Record<string, unknown>, k, out);
    else out[k] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}
