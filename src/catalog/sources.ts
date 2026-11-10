/** Nome e descrizione delle sorgenti del catalogo, condivisi da server e versione statica. */
import type { ProductSource } from "@/domain/schema";

export const CATALOG_SOURCES: Record<ProductSource, { label: string; description: string }> = {
  store: { label: "Negozi", description: "Prodotti reali dei negozi (IKEA e JYSK), riletti dalle pagine prodotto e aggiornati ogni giorno." },
  demo: { label: "Catalogo demo", description: "Prodotti generici con misure e prezzi indicativi (dati demo)." },
  import: { label: "Import da file", description: "Cataloghi e feed importati da CSV o JSON con mappatura delle colonne." },
  link: { label: "Da link prodotto", description: "Prodotti precompilati dai metadati pubblici (JSON-LD, Open Graph) della pagina." },
  manual: { label: "Prodotti personalizzati", description: "Prodotti inseriti manualmente con misure e prezzo." },
};

/** Ordine in cui le sorgenti compaiono nei filtri. */
export const SOURCE_ORDER: ProductSource[] = ["store", "demo", "import", "link", "manual"];
