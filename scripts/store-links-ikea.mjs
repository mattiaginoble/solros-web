// Sceglie dalle mappe del sito di IKEA Italia un elenco di pagine prodotto per categoria
// e lo scrive in src/catalog/store/ikea-links.json (solo indirizzi: i dati si leggono sul server).
//
//   node scripts/store-links-ikea.mjs [prodotti-per-categoria] [sitemap.xml ...]
//
// Senza file scarica le mappe prod-it-IT_*.xml indicate dall'indice del sito.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const UA = "ConfiguratoreCasa/1.0 (scelta dei prodotti per un catalogo personale)";
const INDEX = "https://www.ikea.com/sitemaps/sitemap.xml";
const OUT = new URL("../src/catalog/store/ikea-links.json", import.meta.url);

const EXCLUDE =
  /fodera|rivestiment|copri|cuscin|gamba|gambe|piedi|piede|ricamb|-anta-|^anta-|ante-per|cassetto-per|ripiano|maniglia|pomello|cerniera|inserto|accessori|federa|lenzuol|piumino|biancheria|doghe|materasso|testiera|struttura-per-cassetti|zoccolo|copertura|protezione|organizer|scatola|contenitore-per|tenda|paralume|lampadina|kit-|vite|staffa|binario|telaio-per|pannello-|bracciolo|schienale|seduta-per|mensola-per|piano-per|tovaglia|runner|tappetino|bambini|neonat|giocattol|cane|gatto|regalo|buono/;

/** Set di più mobili (tavolo con sedie, scrivania con sedia): nessuna misura d'ingombro unica. */
const SETS = /(tavolo|scrivania)\b.*(\d+-?sedi[ae]|-e-sedi[ae]|sgabell)/;

/** [stanza, sottocategoria, schema dell'indirizzo]. */
const CATEGORIES = [
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
  ["Elettrodomestici", "Elettrodomestici", /^[a-z0-9]+-(frigorifero|frigo-congelatore|lavastoviglie|forno|piano-cottura|cappa|lavatrice)/],
];

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

const [perArg, ...files] = process.argv.slice(2);
const perCategory = Number(perArg) || 20;
let urls = [];
if (files.length) {
  for (const f of files) urls.push(...locs(readFileSync(f, "utf8")));
} else {
  const maps = locs(await get(INDEX)).filter((u) => /\/prod-it-IT_\d+\.xml$/.test(u));
  for (const map of maps) {
    console.error(`scarico ${map}`);
    urls.push(...locs(await get(map)));
  }
}
urls = [...new Set(urls.filter((u) => u.startsWith("https://www.ikea.com/it/it/p/")))].sort();

// Elenco stabile: restano le pagine già scelte che vanno ancora bene, le nuove
// servono solo a sostituire quelle uscite (così i prodotti già letti non cambiano).
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const out = [];
const seen = new Set();
for (const [category, subcategory, pattern] of CATEGORIES) {
  const found = urls.filter((u) => {
    const slug = u.split("/p/")[1].replace(/\/$/, "");
    return pattern.test(slug) && !EXCLUDE.test(slug) && !SETS.test(slug);
  });
  const valid = new Set(found);
  const kept = previous.filter((p) => p.subcategory === subcategory && valid.has(p.url)).map((p) => p.url).slice(0, perCategory);
  // Prodotti distribuiti lungo l'elenco, non solo i primi in ordine alfabetico.
  const step = Math.max(1, Math.floor(found.length / perCategory));
  const spread = [...found.filter((_, i) => i % step === 0), ...found];
  const chosen = [...kept];
  for (const url of spread) {
    if (chosen.length >= perCategory) break;
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
