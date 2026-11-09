import { describe, expect, it } from "vitest";
import { rowsFromXml } from "@/catalog/feedXml";
import { autoDetectMapping, mapRows } from "@/catalog/importMapping";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel><title>Negozio Esempio</title>
<!-- commento -->
<item>
  <g:id>NE-100</g:id>
  <g:title><![CDATA[Divano 3 posti "Aria" & pouf]]></g:title>
  <g:description>Divano sfoderabile, 214x94x86 cm</g:description>
  <g:link>https://negozio.example.com/p/aria?utm=feed&amp;x=1</g:link>
  <g:image_link>https://negozio.example.com/img/aria.jpg</g:image_link>
  <g:additional_image_link>https://negozio.example.com/img/aria-2.jpg</g:additional_image_link>
  <g:additional_image_link>https://negozio.example.com/img/aria-3.jpg</g:additional_image_link>
  <g:price>899.00 EUR</g:price>
  <g:brand>Negozio Esempio</g:brand>
  <g:product_type>Soggiorno &gt; Divani</g:product_type>
  <g:color>Grigio</g:color>
  <g:shipping><g:country>IT</g:country><g:price>0 EUR</g:price></g:shipping>
</item>
<item>
  <g:id>NE-200</g:id>
  <title>Libreria Alta</title>
  <link>https://negozio.example.com/p/libreria</link>
  <g:price>1.299,00 EUR</g:price>
  <g:product_width>800 mm</g:product_width>
  <g:product_length>28 cm</g:product_length>
  <g:product_height>2,02 m</g:product_height>
</item>
<item><g:id>NE-300</g:id><g:title>Lampada senza misure</g:title><g:price>19.90 EUR</g:price></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:g="http://base.google.com/ns/1.0">
<entry><g:id>A1</g:id><title>Comodino 2 cassetti</title><link href="https://shop.example.com/comodino"/>
<g:price>59 EUR</g:price><g:size>45x38x50 cm</g:size></entry></feed>`;

describe("feed XML (Google Merchant)", () => {
  it("legge i campi con prefisso g:, CDATA, entità, link e campi annidati", () => {
    const rows = rowsFromXml(RSS);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: "NE-100",
      title: 'Divano 3 posti "Aria" & pouf',
      link: "https://negozio.example.com/p/aria?utm=feed&x=1",
      image_link: "https://negozio.example.com/img/aria.jpg",
      additional_image_link: "https://negozio.example.com/img/aria-2.jpg",
      price: "899.00 EUR",
      product_type: "Soggiorno > Divani",
      "shipping.country": "IT",
    });
    expect(rowsFromXml(ATOM)[0]).toMatchObject({ id: "A1", link: "https://shop.example.com/comodino", size: "45x38x50 cm" });
  });

  it("riconosce le colonne Google e converte misure con unità e prezzi con valuta", () => {
    const rows = rowsFromXml(RSS);
    const mapping = autoDetectMapping(Array.from(new Set(rows.flatMap((r) => Object.keys(r)))));
    expect(mapping).toMatchObject({ name: "title", price: "price", code: "id", url: "link", imageUrl: "image_link", retailer: "brand", category: "product_type", width: "product_width", depth: "product_length", height: "product_height" });
    const { products, errors } = mapRows(rows, mapping, { unit: "cm", retailer: "Importato", currency: "EUR", batch: "feed", priceDate: "2026-11-09" });
    expect(products.map((p) => [p.name, p.width, p.depth, p.height, p.price, p.currency])).toEqual([
      ['Divano 3 posti "Aria" & pouf', 214, 94, 86, 899, "EUR"],
      ["Libreria Alta", 80, 28, 202, 1299, "EUR"],
    ]);
    expect(products[0]).toMatchObject({ imageUrl: "https://negozio.example.com/img/aria.jpg", url: "https://negozio.example.com/p/aria?utm=feed&x=1", retailer: "Negozio Esempio", code: "NE-100" });
    expect(errors).toEqual([expect.objectContaining({ message: expect.stringContaining("Misure mancanti") })]);
  });

  it("usa la valuta indicata nel prezzo e la colonna size del feed Atom", () => {
    const rows = rowsFromXml(ATOM.replace("59 EUR", "59 CHF"));
    const { products } = mapRows(rows, autoDetectMapping(Object.keys(rows[0])), { unit: "cm", retailer: "Importato", currency: "EUR", batch: "feed", priceDate: "2026-11-09" });
    expect(products[0]).toMatchObject({ name: "Comodino 2 cassetti", width: 45, depth: 38, height: 50, price: 59, currency: "CHF" });
  });

  it("segnala i file senza prodotti", () => {
    expect(() => rowsFromXml("<rss><channel><title>vuoto</title></channel></rss>")).toThrow(/non ci sono prodotti/);
  });

  it("usa il prezzo scontato e divide la gerarchia di categoria del feed", () => {
    const xml = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>T1</g:id><g:title>Tavolo Brezza</g:title>
      <g:price>429.00 EUR</g:price><g:sale_price>389.00 EUR</g:sale_price><g:product_type>Sala da pranzo &gt; Tavoli &gt; Allungabili</g:product_type>
      <g:size>1600x900x750 mm</g:size></item></channel></rss>`;
    const rows = rowsFromXml(xml);
    const mapping = autoDetectMapping(Object.keys(rows[0]));
    expect(mapping).toMatchObject({ price: "price", salePrice: "sale_price" });
    const [p] = mapRows(rows, mapping, { unit: "cm", retailer: "Importato", currency: "EUR", batch: "feed", priceDate: "2026-11-09" }).products;
    expect(p).toMatchObject({ price: 389, category: "Sala da pranzo", subcategory: "Tavoli", width: 160, depth: 90, height: 75 });
  });
});
