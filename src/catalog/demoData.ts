/**
 * Catalogo dimostrativo: prodotti generici con misure e prezzi INDICATIVI.
 * I rivenditori sono fittizi ("Demo …") per non attribuire prezzi inventati
 * a marchi reali. Ogni prodotto è marcato come dato demo.
 */
import type { MountType, Product, Shape } from "@/domain/schema";

export const DEMO_PRICE_DATE = "2026-10-15T00:00:00.000Z";

interface Opts {
  retailer?: string;
  color?: string;
  hex?: string;
  mount?: MountType;
  elevation?: number;
  front?: number;
  sides?: number;
  shape?: Shape;
  meta?: Record<string, unknown>;
}

let seq = 1000;

function p(
  slug: string,
  name: string,
  category: string,
  subcategory: string,
  [width, depth, height]: [number, number, number],
  price: number,
  o: Opts = {},
): Product {
  seq += 1;
  return {
    id: `demo-${slug}`,
    source: "demo",
    retailer: o.retailer ?? "Demo Arredo",
    code: `DM-${seq}`,
    name,
    category,
    subcategory,
    width,
    depth,
    height,
    price,
    currency: "EUR",
    color: o.color,
    colorHex: o.hex,
    mount: o.mount ?? "floor",
    elevation: o.elevation,
    clearance: { front: o.front ?? 0, sides: o.sides ?? 0 },
    shape: o.shape ?? "box",
    meta: o.meta,
    priceUpdatedAt: DEMO_PRICE_DATE,
  };
}

const CASA = "Demo Casa";
const ELETTRO = "Demo Elettro";
const BAGNO = "Demo Bagno";
const LUCE = "Demo Luce";

export const DEMO_PRODUCTS: Product[] = [
  // Soggiorno
  p("divano-2p", "Divano 2 posti in tessuto", "Soggiorno", "Divani", [160, 88, 82], 449, { color: "Grigio chiaro", hex: "#b9bcbf", shape: "sofa", front: 50 }),
  p("divano-3p", "Divano 3 posti in tessuto", "Soggiorno", "Divani", [218, 92, 84], 699, { color: "Grigio antracite", hex: "#5b5f63", shape: "sofa", front: 50 }),
  p("divano-3p-pelle", "Divano 3 posti in pelle", "Soggiorno", "Divani", [210, 95, 80], 1290, { retailer: CASA, color: "Cognac", hex: "#8a5432", shape: "sofa", front: 50 }),
  p("divano-angolare", "Divano angolare con penisola", "Soggiorno", "Divani", [276, 165, 85], 1190, { color: "Beige", hex: "#cdbfa8", shape: "sofa", front: 50 }),
  p("divano-letto", "Divano letto 2 posti", "Soggiorno", "Divani", [190, 95, 88], 599, { retailer: CASA, color: "Blu notte", hex: "#2f3b55", shape: "sofa", front: 120 }),
  p("poltrona", "Poltrona imbottita", "Soggiorno", "Poltrone", [82, 85, 90], 249, { color: "Verde salvia", hex: "#8fa287", shape: "armchair", front: 40 }),
  p("poltrona-relax", "Poltrona relax reclinabile", "Soggiorno", "Poltrone", [86, 92, 102], 389, { retailer: CASA, color: "Grigio", hex: "#8c8f93", shape: "armchair", front: 70 }),
  p("tavolino-rett", "Tavolino rettangolare in rovere", "Soggiorno", "Tavolini", [110, 60, 42], 129, { color: "Rovere", hex: "#c39a6b", shape: "table" }),
  p("tavolino-tondo", "Tavolino rotondo Ø 70", "Soggiorno", "Tavolini", [70, 70, 45], 89, { color: "Bianco", hex: "#f1f1ee", shape: "table", meta: { round: true } }),
  p("mobile-tv-160", "Mobile TV 160 cm", "Soggiorno", "Mobili TV", [160, 42, 48], 199, { color: "Bianco opaco", hex: "#efefec", shape: "tv-unit", front: 40 }),
  p("mobile-tv-200", "Mobile TV sospeso 200 cm", "Soggiorno", "Mobili TV", [200, 38, 40], 329, { retailer: CASA, color: "Noce", hex: "#7b5137", shape: "tv-unit", mount: "wall", elevation: 30, front: 40 }),
  p("libreria-80", "Libreria 5 ripiani 80 cm", "Soggiorno", "Librerie", [80, 30, 202], 119, { color: "Bianco", hex: "#f2f2ef", shape: "shelf" }),
  p("libreria-160", "Libreria a giorno 160 cm", "Soggiorno", "Librerie", [160, 35, 190], 259, { color: "Rovere", hex: "#c39a6b", shape: "shelf" }),
  p("madia", "Madia 3 ante", "Soggiorno", "Madie", [180, 45, 80], 349, { retailer: CASA, color: "Noce", hex: "#7b5137", shape: "cabinet", front: 50 }),

  // Camera
  p("letto-singolo", "Letto singolo 90×200", "Camera", "Letti", [97, 207, 90], 199, { color: "Bianco", hex: "#efefec", shape: "bed", front: 60, sides: 50 }),
  p("letto-120", "Letto piazza e mezza 120×200", "Camera", "Letti", [127, 207, 95], 279, { color: "Grigio", hex: "#9a9c9e", shape: "bed", front: 60, sides: 50 }),
  p("letto-160", "Letto matrimoniale 160×200", "Camera", "Letti", [168, 210, 100], 449, { color: "Tessuto grigio", hex: "#8f9296", shape: "bed", front: 60, sides: 60 }),
  p("letto-180", "Letto king size 180×200 contenitore", "Camera", "Letti", [190, 215, 105], 799, { retailer: CASA, color: "Tortora", hex: "#a8998a", shape: "bed", front: 60, sides: 60 }),
  p("armadio-100", "Armadio 2 ante battenti 100 cm", "Camera", "Armadi", [100, 58, 220], 249, { color: "Bianco", hex: "#f1f1ee", shape: "wardrobe", front: 60 }),
  p("armadio-150", "Armadio 3 ante 150 cm", "Camera", "Armadi", [150, 58, 236], 389, { color: "Rovere", hex: "#c39a6b", shape: "wardrobe", front: 60 }),
  p("armadio-200", "Armadio 4 ante 200 cm", "Camera", "Armadi", [200, 60, 236], 529, { color: "Bianco", hex: "#f1f1ee", shape: "wardrobe", front: 60 }),
  p("armadio-scorrevole", "Armadio ante scorrevoli 240 cm", "Camera", "Armadi", [240, 66, 236], 899, { retailer: CASA, color: "Grigio seta", hex: "#b5b3ae", shape: "wardrobe", front: 10 }),
  p("comodino", "Comodino 2 cassetti", "Camera", "Comodini", [45, 38, 50], 69, { color: "Bianco", hex: "#efefec", shape: "nightstand", front: 30 }),
  p("comodino-sospeso", "Comodino sospeso", "Camera", "Comodini", [40, 30, 20], 49, { color: "Noce", hex: "#7b5137", shape: "nightstand", mount: "wall", elevation: 45 }),
  p("cassettiera", "Cassettiera 6 cassetti", "Camera", "Cassettiere", [120, 48, 80], 229, { color: "Bianco", hex: "#efefec", shape: "cabinet", front: 50 }),
  p("specchio-terra", "Specchio da terra 50×170", "Camera", "Specchi", [50, 4, 170], 79, { color: "Cornice nera", hex: "#2b2b2b", shape: "mirror" }),

  // Sala da pranzo e ufficio
  p("tavolo-120", "Tavolo 4 posti 120×80", "Sala da pranzo", "Tavoli", [120, 80, 75], 179, { color: "Rovere", hex: "#c39a6b", shape: "table", sides: 60 }),
  p("tavolo-180", "Tavolo 6 posti 180×90", "Sala da pranzo", "Tavoli", [180, 90, 75], 399, { retailer: CASA, color: "Noce", hex: "#7b5137", shape: "table", sides: 60 }),
  p("tavolo-tondo", "Tavolo rotondo Ø 110", "Sala da pranzo", "Tavoli", [110, 110, 75], 289, { color: "Bianco", hex: "#efefec", shape: "table", sides: 60, meta: { round: true } }),
  p("tavolo-allungabile", "Tavolo allungabile 140/220", "Sala da pranzo", "Tavoli", [140, 90, 76], 459, { retailer: CASA, color: "Grigio cemento", hex: "#a5a39e", shape: "table", sides: 60 }),
  p("sedia-legno", "Sedia in legno", "Sala da pranzo", "Sedie", [45, 52, 82], 59, { color: "Faggio", hex: "#d2a97a", shape: "chair" }),
  p("sedia-imbottita", "Sedia imbottita", "Sala da pranzo", "Sedie", [48, 56, 86], 89, { retailer: CASA, color: "Velluto verde", hex: "#4f6b58", shape: "chair" }),
  p("scrivania-120", "Scrivania 120×60", "Ufficio", "Scrivanie", [120, 60, 75], 149, { color: "Bianco", hex: "#efefec", shape: "desk", front: 70 }),
  p("scrivania-angolo", "Scrivania angolare 150×120", "Ufficio", "Scrivanie", [150, 120, 75], 279, { color: "Rovere", hex: "#c39a6b", shape: "desk", front: 70 }),
  p("sedia-ufficio", "Sedia da ufficio ergonomica", "Ufficio", "Sedute", [65, 65, 110], 189, { color: "Nero", hex: "#2d2d2d", shape: "chair" }),

  // Cucina: moduli (usati anche dal configuratore cucina)
  p("base-30", "Modulo base 30 cm", "Cucina", "Moduli base", [30, 60, 88], 89, { shape: "cabinet", front: 50, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 30 } } }),
  p("base-40", "Modulo base 40 cm", "Cucina", "Moduli base", [40, 60, 88], 109, { shape: "cabinet", front: 50, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 40 } } }),
  p("base-60", "Modulo base 60 cm", "Cucina", "Moduli base", [60, 60, 88], 139, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 60, accepts: ["oven", "cooktop"] } } }),
  p("base-60-cassetti", "Modulo base 60 cm a 3 cassetti", "Cucina", "Moduli base", [60, 60, 88], 219, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 60, variant: "cassetti", accepts: ["cooktop"] } } }),
  p("base-80", "Modulo base 80 cm", "Cucina", "Moduli base", [80, 60, 88], 169, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 80, accepts: ["cooktop"] } } }),
  p("base-lavello-80", "Modulo base lavello 80 cm", "Cucina", "Moduli base", [80, 60, 88], 189, { shape: "sink", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "base", width: 80, variant: "lavello" } } }),
  p("base-angolo", "Modulo base angolare 90 cm", "Cucina", "Moduli base", [90, 90, 88], 249, { shape: "cabinet", front: 50, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "corner", width: 90 } } }),
  p("pensile-40", "Pensile 40 cm", "Cucina", "Pensili", [40, 35, 72], 79, { shape: "cabinet", mount: "wall", elevation: 145, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "wall", width: 40 } } }),
  p("pensile-60", "Pensile 60 cm", "Cucina", "Pensili", [60, 35, 72], 99, { shape: "cabinet", mount: "wall", elevation: 145, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "wall", width: 60, accepts: ["hood"] } } }),
  p("pensile-80", "Pensile 80 cm", "Cucina", "Pensili", [80, 35, 72], 129, { shape: "cabinet", mount: "wall", elevation: 145, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "wall", width: 80 } } }),
  p("pensile-scolapiatti", "Pensile scolapiatti 80 cm", "Cucina", "Pensili", [80, 35, 72], 149, { shape: "cabinet", mount: "wall", elevation: 145, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "wall", width: 80, variant: "scolapiatti" } } }),
  p("colonna-forno", "Colonna forno 60 cm", "Cucina", "Colonne", [60, 60, 216], 299, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "tall", width: 60, accepts: ["oven"] } } }),
  p("colonna-frigo", "Colonna frigo da incasso 60 cm", "Cucina", "Colonne", [60, 60, 216], 279, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "tall", width: 60, accepts: ["fridge"] } } }),
  p("colonna-dispensa", "Colonna dispensa 60 cm", "Cucina", "Colonne", [60, 60, 216], 259, { shape: "cabinet", front: 60, color: "Bianco", hex: "#f4f4f1", meta: { kitchen: { kind: "tall", width: 60, variant: "dispensa" } } }),
  p("forno-incasso", "Forno multifunzione da incasso", "Cucina", "Elettrodomestici da incasso", [60, 57, 60], 349, { retailer: ELETTRO, shape: "oven", color: "Acciaio", hex: "#9fa3a7", meta: { appliance: "oven", fit: ["base", "tall"] } }),
  p("piano-induzione", "Piano cottura a induzione 60 cm", "Cucina", "Elettrodomestici da incasso", [59, 52, 6], 399, { retailer: ELETTRO, shape: "cooktop", color: "Vetro nero", hex: "#1f1f1f", meta: { appliance: "cooktop", fit: ["base"] } }),
  p("piano-gas", "Piano cottura a gas 4 fuochi 60 cm", "Cucina", "Elettrodomestici da incasso", [58, 50, 8], 229, { retailer: ELETTRO, shape: "cooktop", color: "Acciaio", hex: "#9fa3a7", meta: { appliance: "cooktop", fit: ["base"] } }),
  p("piano-induzione-80", "Piano cottura a induzione 80 cm", "Cucina", "Elettrodomestici da incasso", [78, 52, 6], 549, { retailer: ELETTRO, shape: "cooktop", color: "Vetro nero", hex: "#1f1f1f", meta: { appliance: "cooktop", fit: ["base"], minWidth: 80 } }),
  p("lavastoviglie", "Lavastoviglie a scomparsa totale 60 cm", "Cucina", "Elettrodomestici da incasso", [60, 57, 82], 479, { retailer: ELETTRO, shape: "dishwasher", color: "Pannello coordinato", hex: "#f4f4f1", meta: { appliance: "dishwasher", fit: ["slot"] } }),
  p("frigo-incasso", "Frigorifero combinato da incasso", "Cucina", "Elettrodomestici da incasso", [54, 55, 177], 749, { retailer: ELETTRO, shape: "fridge", color: "Pannello coordinato", hex: "#f4f4f1", meta: { appliance: "fridge", fit: ["tall"] } }),
  p("cappa-60", "Cappa sottopensile 60 cm", "Cucina", "Elettrodomestici da incasso", [60, 30, 15], 129, { retailer: ELETTRO, shape: "hood", mount: "wall", elevation: 145, color: "Acciaio", hex: "#9fa3a7", meta: { appliance: "hood", fit: ["wall"] } }),
  p("cappa-90", "Cappa a parete 90 cm", "Cucina", "Elettrodomestici da incasso", [90, 50, 70], 289, { retailer: ELETTRO, shape: "hood", mount: "wall", elevation: 150, color: "Acciaio", hex: "#9fa3a7", meta: { appliance: "hood", fit: ["wall-free"] } }),
  p("lavello-inox", "Lavello inox 1 vasca con gocciolatoio", "Cucina", "Lavelli", [79, 50, 20], 119, { retailer: CASA, shape: "sink", color: "Inox", hex: "#b8bcc0", meta: { appliance: "sink", fit: ["base"] } }),
  p("frigo-libera", "Frigorifero combinato libera installazione", "Elettrodomestici", "Frigoriferi", [60, 66, 186], 599, { retailer: ELETTRO, shape: "fridge", color: "Inox", hex: "#b8bcc0", front: 60 }),
  p("frigo-americano", "Frigorifero side by side", "Elettrodomestici", "Frigoriferi", [91, 72, 179], 1299, { retailer: ELETTRO, shape: "fridge", color: "Inox", hex: "#b8bcc0", front: 80 }),
  p("microonde", "Forno a microonde 25 L", "Elettrodomestici", "Piccoli elettrodomestici", [49, 39, 29], 119, { retailer: ELETTRO, shape: "appliance", color: "Nero", hex: "#2a2a2a" }),
  p("lavatrice", "Lavatrice 8 kg carica frontale", "Elettrodomestici", "Lavaggio", [60, 55, 85], 449, { retailer: ELETTRO, shape: "washer", color: "Bianco", hex: "#f6f6f6", front: 60 }),
  p("asciugatrice", "Asciugatrice a pompa di calore 8 kg", "Elettrodomestici", "Lavaggio", [60, 64, 85], 549, { retailer: ELETTRO, shape: "washer", color: "Bianco", hex: "#f6f6f6", front: 60 }),

  // Bagno
  p("lavabo-sospeso", "Lavabo sospeso 60 cm", "Bagno", "Lavabi", [60, 45, 18], 129, { retailer: BAGNO, shape: "washbasin", mount: "wall", elevation: 70, color: "Ceramica bianca", hex: "#fbfbfb", front: 70 }),
  p("mobile-lavabo-80", "Mobile bagno 80 cm con lavabo", "Bagno", "Mobili bagno", [80, 46, 50], 329, { retailer: BAGNO, shape: "washbasin", mount: "wall", elevation: 35, color: "Rovere chiaro", hex: "#cfae86", front: 70 }),
  p("mobile-lavabo-60", "Mobile bagno 60 cm a terra", "Bagno", "Mobili bagno", [60, 45, 85], 249, { retailer: BAGNO, shape: "washbasin", color: "Bianco lucido", hex: "#f7f7f7", front: 70 }),
  p("wc-sospeso", "WC sospeso con sedile", "Bagno", "Sanitari", [36, 53, 40], 219, { retailer: BAGNO, shape: "toilet", color: "Ceramica bianca", hex: "#fbfbfb", front: 60, sides: 20 }),
  p("bidet-sospeso", "Bidet sospeso", "Bagno", "Sanitari", [36, 53, 40], 179, { retailer: BAGNO, shape: "bidet", color: "Ceramica bianca", hex: "#fbfbfb", front: 60, sides: 20 }),
  p("piatto-doccia-80", "Piatto doccia 80×80", "Bagno", "Docce", [80, 80, 4], 159, { retailer: BAGNO, shape: "shower", color: "Bianco", hex: "#f2f2f2", front: 60 }),
  p("piatto-doccia-120", "Piatto doccia 70×120 con box", "Bagno", "Docce", [120, 70, 200], 449, { retailer: BAGNO, shape: "shower", color: "Cristallo", hex: "#dfe9ee", front: 60 }),
  p("vasca-170", "Vasca da incasso 170×70", "Bagno", "Vasche", [170, 70, 58], 369, { retailer: BAGNO, shape: "bathtub", color: "Acrilico bianco", hex: "#fbfbfb", front: 60 }),
  p("vasca-freestanding", "Vasca freestanding 160×75", "Bagno", "Vasche", [160, 75, 60], 990, { retailer: BAGNO, shape: "bathtub", color: "Bianco opaco", hex: "#f2f2f0", front: 60 }),
  p("specchio-bagno", "Specchio con luce LED 80×60", "Bagno", "Specchi", [80, 4, 60], 139, { retailer: BAGNO, shape: "mirror", mount: "wall", elevation: 110, color: "Specchio", hex: "#cfdde4" }),
  p("colonna-bagno", "Colonna bagno 35 cm", "Bagno", "Mobili bagno", [35, 30, 170], 159, { retailer: BAGNO, shape: "cabinet", color: "Bianco lucido", hex: "#f7f7f7", front: 40 }),

  // Illuminazione
  p("lampada-terra", "Lampada da terra ad arco", "Illuminazione", "Lampade da terra", [40, 40, 180], 129, { retailer: LUCE, shape: "lamp-floor", color: "Ottone", hex: "#b48a46" }),
  p("lampada-lettura", "Lampada da lettura", "Illuminazione", "Lampade da terra", [30, 30, 150], 59, { retailer: LUCE, shape: "lamp-floor", color: "Nero", hex: "#2a2a2a" }),
  p("sospensione", "Lampada a sospensione Ø 45", "Illuminazione", "Sospensioni", [45, 45, 30], 89, { retailer: LUCE, shape: "lamp-ceiling", mount: "ceiling", color: "Bianco", hex: "#f2f2f2" }),
  p("plafoniera", "Plafoniera LED Ø 40", "Illuminazione", "Plafoniere", [40, 40, 8], 49, { retailer: LUCE, shape: "lamp-ceiling", mount: "ceiling", color: "Bianco", hex: "#f2f2f2" }),
  p("applique", "Applique da parete", "Illuminazione", "Applique", [15, 12, 25], 39, { retailer: LUCE, shape: "lamp-wall", mount: "wall", elevation: 170, color: "Nero opaco", hex: "#2a2a2a" }),

  // Decorazioni ed esterni
  p("tappeto-160", "Tappeto 160×230", "Decorazioni", "Tappeti", [160, 230, 1], 99, { color: "Grigio melange", hex: "#a8a9a6", shape: "rug" }),
  p("tappeto-200", "Tappeto 200×300", "Decorazioni", "Tappeti", [200, 300, 1], 169, { retailer: CASA, color: "Écru", hex: "#e3dccb", shape: "rug" }),
  p("pianta-grande", "Pianta in vaso grande", "Decorazioni", "Piante", [50, 50, 150], 69, { color: "Verde", hex: "#5d7b4f", shape: "plant" }),
  p("pianta-piccola", "Pianta in vaso piccola", "Decorazioni", "Piante", [30, 30, 60], 25, { color: "Verde", hex: "#6c8a5c", shape: "plant" }),

  // Scale per il collegamento tra piani
  p("scala-chiocciola", "Scala a chiocciola Ø 140", "Scale", "Scale", [140, 140, 300], 1890, { retailer: CASA, shape: "stairs", color: "Acciaio e faggio", hex: "#8f8a80", front: 30, meta: { stairs: "spiral" } }),
  p("scala-dritta", "Scala dritta 90×300", "Scale", "Scale", [90, 300, 300], 1490, { retailer: CASA, shape: "stairs", color: "Rovere", hex: "#c39a6b", front: 60, meta: { stairs: "straight" } }),
];

export const DEMO_RETAILERS = Array.from(new Set(DEMO_PRODUCTS.map((x) => x.retailer)));
