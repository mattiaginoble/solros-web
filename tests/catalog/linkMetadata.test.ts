import { describe, expect, it } from "vitest";
import { extractProductMetadata } from "@/catalog/linkMetadata";

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
});
