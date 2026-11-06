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
});
