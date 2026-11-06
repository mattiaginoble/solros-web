/** Utilità condivise per normalizzare i dati prodotto provenienti da file e pagine web. */
import type { MountType, Shape } from "@/domain/schema";
import { normalizeText } from "./filter";

/** Numero da testo in formato italiano o inglese ("1.299,00 €", "1,299.00", "45,5"). */
export function parseLocaleNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let t = input.trim().replace(/[^\d.,-]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    t = t.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const decimals = t.length - lastComma - 1;
    t = decimals === 3 && t.indexOf(",") === lastComma && t.length > 4 && !/^-?0,/.test(t) ? t.replace(",", "") : t.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const decimals = t.length - lastDot - 1;
    if (decimals === 3 && t.split(".").length >= 2 && !/^0\./.test(t)) t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Fattore di conversione in cm per un'unità di misura testuale o un codice UN/CEFACT. */
export function unitToCm(unit: string | undefined | null): number {
  const u = (unit ?? "").trim().toLowerCase();
  if (["mm", "mmt", "millimetri", "millimeter", "millimeters"].includes(u)) return 0.1;
  if (["m", "mtr", "metri", "meter", "meters"].includes(u)) return 100;
  if (["in", "inh", "inch", "inches", '"'].includes(u)) return 2.54;
  return 1;
}

/**
 * Larghezza, profondità e altezza da testi come "200x90x85 cm",
 * "L 200 x P 90 x H 85 cm" o "Larghezza: 200 cm, Profondità: 90 cm".
 */
export function parseDimensions(text: string): { width?: number; depth?: number; height?: number } {
  const t = normalizeText(text).replace(/,(\d)/g, ".$1");
  const out: { width?: number; depth?: number; height?: number } = {};
  const labelled: [keyof typeof out, RegExp][] = [
    ["width", /(?:larghezza|width|\bl\b|\bw\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/],
    ["depth", /(?:profondita|depth|\bp\b|\bd\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/],
    ["height", /(?:altezza|height|\bh\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/],
  ];
  for (const [k, re] of labelled) {
    const m = re.exec(t);
    if (m) out[k] = Number(m[1]) * unitToCm(m[2] ?? "cm");
  }
  if (out.width && out.depth && out.height) return out;
  const triple = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/.exec(t);
  if (triple) {
    const k = unitToCm(triple[4] ?? "cm");
    return { width: Number(triple[1]) * k, depth: Number(triple[2]) * k, height: Number(triple[3]) * k };
  }
  return out;
}

const SHAPE_RULES: [RegExp, Shape, MountType?][] = [
  [/divano|sofa/, "sofa"],
  [/poltron|armchair/, "armchair"],
  [/\bletto|\bbed\b|materasso/, "bed"],
  [/scrivania|desk/, "desk"],
  [/tavolino|tavolo|table/, "table"],
  [/sedia|sgabello|chair|stool/, "chair"],
  [/armadio|guardaroba|wardrobe/, "wardrobe"],
  [/libreria|scaffal|bookcase|shelf/, "shelf"],
  [/comodino|nightstand|bedside/, "nightstand"],
  [/mobile tv|porta tv|tv unit|tv bench/, "tv-unit"],
  [/pensile/, "cabinet", "wall"],
  [/cassettiera|madia|credenza|mobile|cabinet|dresser|sideboard/, "cabinet"],
  [/frigo|fridge|refrigerat/, "fridge"],
  [/lavastoviglie|dishwasher/, "dishwasher"],
  [/lavatrice|asciugatrice|washer|dryer/, "washer"],
  [/forno|oven/, "oven"],
  [/piano cottura|piano a induzione|cooktop|hob/, "cooktop"],
  [/cappa|hood/, "hood", "wall"],
  [/lavello|sink/, "sink"],
  [/lavabo|lavandino|washbasin|basin/, "washbasin"],
  [/\bwc\b|vaso|toilet/, "toilet"],
  [/bidet/, "bidet"],
  [/doccia|shower/, "shower"],
  [/vasca|bathtub|bath tub/, "bathtub"],
  [/specchio|mirror/, "mirror", "wall"],
  [/applique|wall lamp|wall light/, "lamp-wall", "wall"],
  [/lampadario|plafoniera|sospensione|pendant|ceiling/, "lamp-ceiling", "ceiling"],
  [/lampada|lamp/, "lamp-floor"],
  [/tappeto|rug|carpet/, "rug"],
  [/pianta|plant/, "plant"],
  [/scala|stairs|staircase/, "stairs"],
];

/** Forma parametrica e tipo di montaggio dedotti dal nome o dalla categoria. */
export function inferShape(text: string): { shape: Shape; mount: MountType } {
  const t = normalizeText(text);
  for (const [re, shape, mount] of SHAPE_RULES) if (re.test(t)) return { shape, mount: mount ?? "floor" };
  return { shape: "box", mount: "floor" };
}

/** Categoria indicativa dalla forma, per prodotti senza categoria. */
export function categoryForShape(shape: Shape): string {
  if (["sofa", "armchair", "tv-unit", "shelf", "rug", "plant"].includes(shape)) return "Soggiorno";
  if (["bed", "wardrobe", "nightstand"].includes(shape)) return "Camera";
  if (["table", "chair"].includes(shape)) return "Sala da pranzo";
  if (shape === "desk") return "Ufficio";
  if (["fridge", "oven", "dishwasher", "cooktop", "hood", "sink"].includes(shape)) return "Cucina";
  if (["washbasin", "toilet", "bidet", "shower", "bathtub", "mirror"].includes(shape)) return "Bagno";
  if (shape.startsWith("lamp")) return "Illuminazione";
  if (shape === "washer") return "Elettrodomestici";
  return "Altro";
}

/** Hash breve e stabile (FNV-1a) per identificativi deterministici. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
