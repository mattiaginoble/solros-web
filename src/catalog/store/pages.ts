/**
 * Pagine prodotto dei negozi che il server rilegge ogni giorno (catalogo «Negozi»).
 * Nel repository ci sono solo gli indirizzi; nome, prezzo, misure e foto si leggono
 * dalla pagina e restano nel database. Per rigenerare l'elenco IKEA:
 * `node scripts/store-links-ikea.mjs`.
 */
import ikeaLinks from "./ikea-links.json";

export interface StorePageEntry {
  url: string;
  retailer: string;
  /** Stanza (categoria del catalogo). */
  category: string;
  subcategory: string;
}

export const STORE_PAGES: StorePageEntry[] = ikeaLinks.map((l) => ({ ...l, retailer: "IKEA" }));
