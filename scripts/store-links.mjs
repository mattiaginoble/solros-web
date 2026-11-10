// Sceglie dalle mappe del sito di un negozio un elenco di pagine prodotto per tipo di mobile
// e lo scrive in src/catalog/store/<negozio>-links.json (solo indirizzi: i dati si leggono sul server).
//
//   node scripts/store-links.mjs <ikea|jysk> [prodotti-per-tipo] [sitemap.xml ...]
//
// Senza file scarica le mappe dei prodotti indicate dal sito. L'elenco resta stabile: le
// pagine già scelte rimangono finché sono valide, le nuove sostituiscono solo quelle uscite.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const UA = "ConfiguratoreCasa/1.0 (scelta dei prodotti per un catalogo personale)";

/** Parti di ricambio, accessori, tessili e articoli non da arredo: esclusi ovunque. */
const EXCLUDE =
  /fodera|rivestiment|copri|cuscin|gamba|gambe|piedi|piede|ricamb|-anta-|^anta-|ante-per|cassetto-per|ripiano|maniglia|pomello|cerniera|inserto|accessori|federa|lenzuol|piumino|biancheria|doghe|materasso|testiera|struttura-per-cassetti|zoccolo|copertura|protezione|organizer|scatola|contenitore-per|tenda|paralume|lampadina|kit-|vite|staffa|binario|telaio-per|pannello-|bracciolo|schienale|seduta-per|mensola-per|piano-per|tovaglia|runner|tappetino|bambini|neonat|giocattol|cane|gatto|regalo|buono/;

/** Set di più mobili (tavolo con sedie, scrivania con sedia): nessuna misura d'ingombro unica. */
const SETS = /(tavolo|scrivania)\b.*(\d+-?sedi[ae]|-e-sedi[ae]|sgabell)|^set-|-set-/;

const SHOPS = {
  ikea: {
    index: "https://www.ikea.com/sitemaps/sitemap.xml",
    maps: (u) => /\/prod-it-IT_\d+\.xml$/.test(u),
    product: (u) => u.startsWith("https://www.ikea.com/it/it/p/"),
    // Indirizzi «nome-tipo-…»: /p/kivik-divano-a-2-posti-…/
    slug: (u) => u.split("/p/")[1].replace(/\/$/, ""),
    perType: 30,
    /** [stanza, sottocategoria, schema dell'indirizzo]. */
    types: [
      ["Soggiorno", "Divani", /^[a-z0-9]+-divano-(a-|angolare|con)/],
      ["Soggiorno", "Poltrone", /^[a-z0-9]+-poltrona/],
      ["Soggiorno", "Mobili TV", /^[a-z0-9]+-(mobile-tv|panca-tv)/],
      ["Soggiorno", "Librerie", /^[a-z0-9]+-(libreria|scaffale)/],
      ["Soggiorno", "Tavolini", /^[a-z0-9]+-tavolino/],
      ["Soggiorno", "Tappeti", /^[a-z0-9]+-tappeto/],
      ["Camera", "Letti", /^[a-z0-9]+-(struttura-letto|divano-letto)/],
      ["Camera", "Armadi", /^[a-z0-9]+-(guardaroba|armadio)/],
      ["Camera", "Cassettiere", /^[a-z0-9]+-cassettiera/],
      ["Camera", "Comodini", /^[a-z0-9]+-comodino/],
      ["Sala da pranzo", "Tavoli", /^[a-z0-9]+-tavolo(-allungabile)?-/],
      ["Sala da pranzo", "Sedie", /^[a-z0-9]+-sedia/],
      ["Sala da pranzo", "Credenze", /^[a-z0-9]+-(credenza|madia|buffet|vetrina)/],
      ["Ufficio", "Scrivanie", /^[a-z0-9]+-scrivania/],
      ["Bagno", "Mobili bagno", /^[a-z0-9]+-(mobile-per-lavabo|mobile-lavabo|colonna)/],
      ["Illuminazione", "Lampade", /^[a-z0-9]+-(lampada-da-terra|lampada-a-sospensione|plafoniera)/],
      ["Illuminazione", "Applique", /^[a-z0-9]+-(applique|lampada-da-parete|faretto-da-parete|faretto-led-da-parete)/],
      ["Illuminazione", "Lampade da tavolo", /^[a-z0-9]+-lampada-da-tavolo/],
      ["Soggiorno", "Contenitori", /^[a-z0-9]+-(mobile-con-ante|mobile-con-cassetti|mobile-contenitore|combinazione-contenitori)/],
      ["Soggiorno", "Piante", /^[a-z0-9]+-pianta-(artificiale|in-vaso)/],
      ["Sala da pranzo", "Sgabelli", /^[a-z0-9]+-sgabello/],
      ["Ingresso", "Scarpiere", /^[a-z0-9]+-scarpiera/],
      ["Ingresso", "Specchi", /^[a-z0-9]+-specchio/],
      ["Elettrodomestici", "Elettrodomestici", /^[a-z0-9]+-(frigorifero|frigo-congelatore|lavastoviglie|forno|piano-cottura|cappa|lavatrice)/],
    ],
  },
  jysk: {
    index: "https://jysk.it/sitemap.xml",
    maps: () => false,
    // Fuori le sezioni di accessori e decorazioni (specchi da trucco, tavoli da barbecue…).
    product: (u) => u.startsWith("https://jysk.it/") && !/\/(inspiration|product)\/|\/[a-z-]*(accessori|decorazion)[a-z-]*\//.test(u),
    // Indirizzi «tipo-nome-…» nell'ultima parte: /soggiorno/divani/divano-gedved-2-posti-grigio-chiaro
    slug: (u) => u.replace(/\/$/, "").split("/").pop(),
    perType: 15,
    types: [
      ["Soggiorno", "Divani", /^divano-(?!letto)/],
      ["Soggiorno", "Poltrone", /^poltrona-/],
      ["Soggiorno", "Tavolini", /^tavolino-/],
      ["Soggiorno", "Librerie", /^(scaffale|libreria)-/],
      ["Soggiorno", "Tappeti", /^tappeto-/],
      ["Soggiorno", "Piante", /^pianta-/],
      ["Camera", "Letti", /^(struttura-letto|letto|divano-letto)-/],
      ["Camera", "Armadi", /^armadio-/],
      ["Camera", "Cassettiere", /^cassettiera-/],
      ["Camera", "Comodini", /^comodino-/],
      ["Sala da pranzo", "Tavoli", /^tavolo-/],
      ["Sala da pranzo", "Sedie", /^sedia-/],
      ["Sala da pranzo", "Credenze", /^credenza-/],
      ["Ufficio", "Scrivanie", /^scrivania-/],
      ["Ingresso", "Specchi", /^specchio-/],
      ["Illuminazione", "Lampade", /^lampada-/],
    ],
  },
};

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

const [shopId, perArg, ...files] = process.argv.slice(2);
const shop = SHOPS[shopId];
if (!shop) {
  console.error(`Uso: node scripts/store-links.mjs <${Object.keys(SHOPS).join("|")}> [prodotti-per-tipo] [sitemap.xml ...]`);
  process.exit(1);
}
const OUT = new URL(`../src/catalog/store/${shopId}-links.json`, import.meta.url);
const perType = Number(perArg) || shop.perType;

let urls = [];
if (files.length) {
  for (const f of files) urls.push(...locs(readFileSync(f, "utf8")));
} else {
  const index = await get(shop.index);
  // Indice di mappe (IKEA) oppure una sola mappa con tutte le pagine (JYSK).
  const maps = /<sitemapindex/i.test(index) ? locs(index).filter(shop.maps) : [];
  if (!maps.length) urls.push(...locs(index));
  for (const map of maps) {
    console.error(`scarico ${map}`);
    urls.push(...locs(await get(map)));
  }
}
urls = [...new Set(urls.filter(shop.product))].sort();

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const out = [];
const seen = new Set();
for (const [category, subcategory, pattern] of shop.types) {
  const found = urls.filter((u) => {
    const slug = shop.slug(u);
    return pattern.test(slug) && !EXCLUDE.test(slug) && !SETS.test(slug);
  });
  const valid = new Set(found);
  const kept = previous.filter((p) => p.subcategory === subcategory && valid.has(p.url)).map((p) => p.url).slice(0, perType);
  // Prodotti distribuiti lungo l'elenco, non solo i primi in ordine alfabetico.
  const step = Math.max(1, Math.floor(found.length / perType));
  const spread = [...found.filter((_, i) => i % step === 0), ...found];
  const chosen = [...kept];
  for (const url of spread) {
    if (chosen.length >= perType) break;
    if (!chosen.includes(url)) chosen.push(url);
  }
  console.error(`${subcategory}: ${found.length} candidati, ${kept.length} confermati, ${chosen.length - kept.length} nuovi`);
  for (const url of chosen) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, category, subcategory });
  }
}
// Una pagina per riga: differenze leggibili quando l'elenco cambia.
writeFileSync(OUT, `[\n${out.map((o) => JSON.stringify(o)).join(",\n")}\n]\n`);
console.error(`totale: ${out.length} pagine in ${OUT.pathname}`);
