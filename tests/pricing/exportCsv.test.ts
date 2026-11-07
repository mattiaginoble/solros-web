import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createHouse, createPlacedItem, createRectRoom } from "@/domain/factory";
import { quoteToCsv } from "@/lib/pricing/exportCsv";
import { quoteForHouse } from "@/lib/pricing/quote";

describe("export CSV del preventivo", () => {
  it("contiene intestazione, righe con quantità e totale con virgola decimale", () => {
    const h = createHouse("Casa; prova");
    const r = createRectRoom(400, 300, { name: "Soggiorno" });
    const chair = DEMO_PRODUCTS.find((p) => p.id === "demo-sedia-legno")!;
    r.items.push(createPlacedItem({ ...chair, url: "https://example.com/sedia" }, 50, 50), createPlacedItem({ ...chair, url: "https://example.com/sedia" }, 100, 50));
    h.floors[0].rooms.push(r);
    const csv = quoteToCsv(quoteForHouse(h), h.name);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[2]).toBe("Prodotto;Codice;Rivenditore;Link;Quantità;Prezzo unitario;Totale;Valuta;Stanze;Prezzo aggiornato al");
    expect(lines[3]).toBe("Sedia in legno;DM-1031;Demo Arredo;https://example.com/sedia;2;59,00;118,00;EUR;Soggiorno;2026-10-15");
    expect(lines[4]).toBe("Totale;;;;2;;118,00;EUR;;");
  });

  it("neutralizza i testi che un foglio di calcolo eseguirebbe come formule", () => {
    const h = createHouse("Casa");
    const r = createRectRoom(300, 300, { name: "-Bagno" });
    const chair = DEMO_PRODUCTS.find((p) => p.id === "demo-sedia-legno")!;
    r.items.push(createPlacedItem({ ...chair, name: '=HYPERLINK("https://x.it","clic")', code: "+390212345", retailer: "@SUM(1+1)", currency: "=1+" }, 50, 50));
    h.floors[0].rooms.push(r);
    const lines = quoteToCsv(quoteForHouse(h), h.name).replace("\uFEFF", "").trim().split("\r\n");
    expect(lines[3]).toBe(`"'=HYPERLINK(""https://x.it"",""clic"")";'+390212345;'@SUM(1+1);;1;59,00;59,00;'=1+;'-Bagno;2026-10-15`);
    expect(lines[4]).toBe("Totale;;;;1;;59,00;'=1+;;");
  });
});
