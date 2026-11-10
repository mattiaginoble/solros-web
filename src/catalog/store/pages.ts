/**
 * Pagine prodotto dei negozi che il server rilegge ogni giorno (catalogo «Negozi»).
 * Nel repository ci sono solo gli indirizzi; nome, prezzo, misure e foto si leggono
 * dalla pagina e restano nel database. Per rigenerare un elenco:
 * `node scripts/store-links.mjs <ikea|jysk>`.
 */
import ikeaLinks from "./ikea-links.json";
import jyskLinks from "./jysk-links.json";

export interface StorePageEntry {
  url: string;
  retailer: string;
  /** Stanza (categoria del catalogo). */
  category: string;
  subcategory: string;
}

export const STORE_PAGES: StorePageEntry[] = [
  ...ikeaLinks.map((l) => ({ ...l, retailer: "IKEA" })),
  ...jyskLinks.map((l) => ({ ...l, retailer: "JYSK" })),
];
