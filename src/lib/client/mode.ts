/**
 * Modalità di build. Con NEXT_PUBLIC_STATIC_EXPORT=1 l'app viene esportata come
 * sito statico (GitHub Pages): niente server, progetti e prodotti restano nel
 * browser. I valori sono sostituiti al momento della build.
 */
export const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

/** Prefisso del sito, per esempio "/solros-web" su GitHub Pages. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Indirizzo della versione completa (con server), mostrato nella versione statica. */
export const FULL_APP_URL = process.env.NEXT_PUBLIC_FULL_APP_URL ?? "";

/** Funzioni che richiedono il server. */
export const FEATURES = {
  productLink: !STATIC_MODE,
  sharing: !STATIC_MODE,
  remoteAnalyzer: !STATIC_MODE,
};

/** Percorso dell'editor per un progetto (next/link e il router aggiungono il prefisso del sito). */
export function editorHref(id: string, action?: string | null): string {
  const extra = action ? `azione=${encodeURIComponent(action)}` : "";
  if (STATIC_MODE) return `/editor/?id=${encodeURIComponent(id)}${extra ? `&${extra}` : ""}`;
  return `/editor/${encodeURIComponent(id)}${extra ? `?${extra}` : ""}`;
}

/** URL di un file della cartella public/, con il prefisso del sito. */
export function assetUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
