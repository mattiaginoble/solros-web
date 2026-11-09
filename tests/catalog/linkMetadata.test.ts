import { describe, expect, it } from "vitest";
import { extractProductMetadata, measurementList } from "@/catalog/linkMetadata";

const jsonLdPage = `<!doctype html><html><head>
<title>Divano letto | Negozio</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Divano letto Lisa","sku":"LS-200",
 "brand":{"@type":"Brand","name":"Casa Esempio"},"color":"Blu",
 "image":["https://cdn.example.com/lisa.jpg"],
 "width":{"@type":"QuantitativeValue","value":200,"unitCode":"CMT"},
 "depth":{"@type":"QuantitativeValue","value":950,"unitCode":"MMT"},
 "height":{"@type":"QuantitativeValue","value":0.88,"unitCode":"MTR"},
 "offers":{"@type":"Offer","price":"649.00","priceCurrency":"EUR"}}
</script></head><body></body></html>`;

const ogPage = `<html><head>
<meta property="og:title" content="Tavolo da pranzo Nord &amp; Sud">
<meta property="og:image" content="https://cdn.example.com/tavolo.jpg">
<meta property="og:site_name" content="Arredi Esempio">
<meta property="product:price:amount" content="399,90">
<meta property="product:price:currency" content="eur">
<meta name="description" content="Tavolo in rovere. Dimensioni 180x90x75 cm.">
</head></html>`;

const graphPage = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":["Product"],"name":"Lampada Arco",
"offers":[{"@type":"AggregateOffer","lowPrice":"129","priceCurrency":"EUR"}],
"additionalProperty":[{"name":"Altezza","value":"180","unitText":"cm"},{"name":"Larghezza","value":"40","unitText":"cm"}]}]}</script>`;

describe("metadati da link prodotto", () => {
  it("legge nome, prezzo, immagine e misure dal JSON-LD", () => {
    const m = extractProductMetadata(jsonLdPage, "https://negozio.example/p/lisa");
    expect(m).toMatchObject({
      name: "Divano letto Lisa",
      code: "LS-200",
      retailer: "Casa Esempio",
      price: 649,
      currency: "EUR",
      imageUrl: "https://cdn.example.com/lisa.jpg",
      width: 200,
      depth: 95,
      height: 88,
      shape: "sofa",
    });
    expect(m.found.some((f) => f.includes("JSON-LD"))).toBe(true);
  });

  it("usa Open Graph e la descrizione quando mancano i dati strutturati", () => {
    const m = extractProductMetadata(ogPage, "https://www.arredi.example/tavolo");
    expect(m).toMatchObject({ name: "Tavolo da pranzo Nord & Sud", price: 399.9, currency: "EUR", retailer: "Arredi Esempio", width: 180, depth: 90, height: 75, shape: "table" });
  });

  it("trova il prodotto anche dentro @graph e nelle proprietà aggiuntive", () => {
    const m = extractProductMetadata(graphPage, "https://luci.example/arco");
    expect(m).toMatchObject({ name: "Lampada Arco", price: 129, height: 180, width: 40, retailer: "luci.example" });
  });

  it("restituisce comunque l'URL anche se la pagina non ha metadati", () => {
    const m = extractProductMetadata("<html></html>", "https://x.example/a");
    expect(m.url).toBe("https://x.example/a");
    expect(m.price).toBeUndefined();
  });

  // Struttura dei dati strutturati delle pagine prodotto IKEA (valori di esempio).
  const ikeaLike = (product: Record<string, unknown>) =>
    `<html><head><meta property="og:type" content="product"><meta property="og:image" content="https://www.ikea.com/og.jpg">
    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org/", "@type": "Product", brand: { "@type": "Brand", name: "IKEA" }, ...product })}</script></head></html>`;

  it("legge le pagine prodotto con misure in testo e immagini ImageObject", () => {
    const m = extractProductMetadata(
      ikeaLike({
        name: "YXSTABY Tavolino da gaming con rotelle - rovere/grigio",
        sku: "906.200.05",
        category: "Accessori da gaming",
        width: "50 cm",
        depth: "50 cm",
        height: "55 cm",
        image: [{ "@type": "ImageObject", contentUrl: "https://www.ikea.com/it/it/images/products/yxstaby__s5.jpg" }],
        offers: { "@type": "Offer", price: "119", priceCurrency: "EUR" },
      }),
      "https://www.ikea.com/it/it/p/yxstaby-90620005/",
    );
    expect(m).toMatchObject({ isProduct: true, name: expect.stringContaining("YXSTABY"), code: "906.200.05", retailer: "IKEA", price: 119, currency: "EUR", width: 50, depth: 50, height: 55, shape: "table" });
    expect(m.imageUrl).toBe("https://www.ikea.com/it/it/images/products/yxstaby__s5.jpg");
  });

  it("riconosce gli elettrodomestici da incasso anche se il nome contiene 'sottotavolo'", () => {
    const m = extractProductMetadata(
      ikeaLike({ name: "YTTERNÄS Congelatore sottotavolo - IKEA 500 integrato 94 l", width: "59.5 cm", depth: "54.5 cm", height: "82 cm", offers: { price: "369", priceCurrency: "EUR" } }),
      "https://www.ikea.com/it/it/p/ytternaes-00568356/",
    );
    expect(m).toMatchObject({ shape: "fridge", width: 59.5, depth: 54.5, height: 82 });
  });

  it("usa il diametro nel nome come ingombro delle lampade", () => {
    const m = extractProductMetadata(
      ikeaLike({ name: "ZEBRASÄV Lampada a sospensione - bianco/plastica 46 cm", height: "24 cm", offers: { price: "4.95", priceCurrency: "EUR" } }),
      "https://www.ikea.com/it/it/p/zebrasaev-10522481/",
    );
    expect(m).toMatchObject({ shape: "lamp-ceiling", mount: "ceiling", width: 46, depth: 46, height: 24, price: 4.95 });
  });

  it("segnala le pagine senza dati di prodotto (categorie, ricerche)", () => {
    const html = `<html><head><title>BILLY Librerie</title><meta property="og:title" content="BILLY Librerie"><meta property="og:type" content="product.group"></head></html>`;
    expect(extractProductMetadata(html, "https://www.ikea.com/it/it/cat/billy-58288/").isProduct).toBe(false);
  });

  it("dà ai tappeti senza spessore un'altezza di 1 cm", () => {
    const rug = extractProductMetadata(ikeaLike({ name: "STOENSE Tappeto pelo corto - beige 133x195 cm", offers: { price: "49" } }), "https://www.ikea.com/it/it/p/stoense-1/");
    expect(rug).toMatchObject({ shape: "rug", width: 133, depth: 195, height: 1 });
  });

  it("non scambia l'altezza di una lampada da terra per un diametro; legge i tappeti LxP", () => {
    const lamp = extractProductMetadata(ikeaLike({ name: "Lampada da terra - ottone 154 cm", offers: { price: "49" } }), "https://www.ikea.com/it/it/p/l-1/");
    expect(lamp.shape).toBe("lamp-floor");
    expect(lamp.width).toBeUndefined();
    const rug = extractProductMetadata(ikeaLike({ name: "Tappeto pelo corto - grigio 160x230 cm", offers: { price: "79" } }), "https://www.ikea.com/it/it/p/t-1/");
    expect(rug).toMatchObject({ shape: "rug", width: 160, depth: 230 });
  });

  it("prende il prezzo attuale da una lista di specifiche, non quello barrato", () => {
    const m = extractProductMetadata(
      ikeaLike({
        name: "KIVIK Divano a 2 posti - beige",
        width: "190 cm",
        depth: "95 cm",
        height: "83 cm",
        offers: {
          "@type": "Offer",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", price: "399", priceCurrency: "EUR", priceType: "https://schema.org/StrikethroughPrice" },
            { "@type": "UnitPriceSpecification", price: "299", priceCurrency: "EUR" },
          ],
        },
      }),
      "https://www.ikea.com/it/it/p/kivik-s09440599/",
    );
    expect(m).toMatchObject({ price: 299, currency: "EUR", width: 190, depth: 95, height: 83 });
  });

  it("legge le misure dalla scheda «Misure» quando mancano nei dati strutturati", () => {
    const row = (name: string, value: string) =>
      `<li class="pipf-measurements-tab__measurement-row"><span class="pipf-measurements-tab__measurement-name">${name}\n</span><span class="pipf-measurements-tab__measurement-value">${value}</span></li>`;
    const pkg = `<li class="pipf-measurements-tab__package-measurement-item"><span class="pipf-measurements-tab__package-measurement-label">Larghezza: </span>94 cm</li>`;
    const html = ikeaLike({ name: "HEMNES Struttura letto - bianco 160x200 cm", offers: { price: "279", priceCurrency: "EUR" } }).replace(
      "</html>",
      `<body><ul>${row("Larghezza sedile", "140 cm")}${row("Lunghezza", "211 cm")}${row("Larghezza", "174 cm")}${row("Altezza testiera", "112 cm")}${row("Altezza", "66 cm")}${pkg}</ul></body></html>`,
    );
    const m = extractProductMetadata(html, "https://www.ikea.com/it/it/p/hemnes-1/");
    expect(m).toMatchObject({ shape: "bed", width: 174, depth: 211, height: 66, price: 279 });
    expect(m.found).toContain("depth (scheda misure)");
  });

  it("scheda misure: lato lungo come larghezza per i tavoli, diametro, millimetri e varianti delle etichette", () => {
    const html = (pairs: [string, string][]) =>
      pairs.map(([n, v]) => `<span class="product-dimensions__name">${n}:</span><span class="product-dimensions__value">${v}</span>`).join("");
    expect(measurementList(html([["Larghezza", "80 cm"], ["Lunghezza", "140 cm"], ["Altezza", "75 cm"]]), "table")).toEqual({ width: 140, depth: 80, height: 75 });
    expect(measurementList(html([["Diametro", "90 cm"], ["Altezza", "74 cm"]]), "table")).toEqual({ width: 90, depth: 90, height: 74 });
    expect(measurementList(html([["Larghezza", "600 mm"]]))).toEqual({ width: 60, depth: undefined, height: undefined });
    // Varianti solo in mancanza dell'etichetta semplice: altezza con i cuscini, profondità minima.
    expect(
      measurementList(html([["Altezza schienale", "70 cm"], ["Altezza, inclusi cuscini schienale", "82 cm"], ["Profondità", "93 cm"], ["Larghezza", "199 cm"]]), "sofa"),
    ).toEqual({ width: 199, depth: 93, height: 82 });
    expect(measurementList(html([["Larghezza", "61 cm"], ["Profondità minima", "166 cm"], ["Profondità massima", "270 cm"], ["Altezza", "180 cm"]]))).toEqual({
      width: 61,
      depth: 166,
      height: 180,
    });
    expect(measurementList(html([["Altezza, inclusi cuscini schienale", "82 cm"], ["Altezza", "80 cm"]])).height).toBe(80);
    // Tappeti: spessore come altezza. Letti: altezza della testiera. Angolari: i due lati della L.
    expect(measurementList(html([["Lunghezza", "195 cm"], ["Larghezza", "133 cm"], ["Superficie", "2.60 m²"], ["Spessore", "18 mm"]]), "rug")).toEqual({
      width: 133,
      depth: 195,
      height: 1.8,
    });
    expect(
      measurementList(
        html([["Altezza interna", "27 cm"], ["Lunghezza", "210 cm"], ["Larghezza", "155 cm"], ["Altezza pediera", "38 cm"], ["Altezza testiera", "100 cm"], ["Larghezza materasso", "140 cm"]]),
        "bed",
      ),
    ).toEqual({ width: 155, depth: 210, height: 100 });
    expect(
      measurementList(
        html([["Altezza, inclusi cuscini schienale", "83 cm"], ["Profondità", "98 cm"], ["Larghezza destra", "249 cm"], ["Larghezza sedile destra", "192 cm"], ["Larghezza sinistra", "209 cm"]]),
        "sofa",
      ),
    ).toEqual({ width: 249, depth: 209, height: 83 });
    // Classi senza riferimenti alle misure: ignorate.
    expect(measurementList(`<span class="title">Larghezza</span><span>10 cm</span>`)).toEqual({ width: undefined, depth: undefined, height: undefined });
  });
});
