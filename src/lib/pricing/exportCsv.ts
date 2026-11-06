/** Esportazione del preventivo in CSV (separatore ";" e virgola decimale, leggibile da Excel in italiano). */
import type { Quote } from "./quote";

function cell(v: string | number): string {
  const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function quoteToCsv(quote: Quote, houseName: string): string {
  const header = ["Prodotto", "Codice", "Rivenditore", "Link", "Quantità", "Prezzo unitario", "Totale", "Valuta", "Stanze", "Prezzo aggiornato al"];
  const rows = quote.lines.map((l) => [
    cell(l.name),
    cell(l.code ?? ""),
    cell(l.retailer),
    cell(l.url ?? ""),
    String(l.quantity),
    cell(l.unitPrice),
    cell(l.total),
    l.currency,
    cell(l.rooms.join(", ")),
    l.priceUpdatedAt ? l.priceUpdatedAt.slice(0, 10) : "",
  ]);
  const totals = Object.entries(quote.totals).map(([c, v]) => ["Totale", "", "", "", String(quote.itemCount), "", cell(v), c, "", ""]);
  const lines = [
    `# Preventivo: ${houseName}`.replace(/[\r\n]/g, " "),
    "# Prezzi indicativi: possono essere cambiati, verificare sul sito del rivenditore.",
    header.join(";"),
    ...rows.map((r) => r.join(";")),
    ...totals.map((r) => r.join(";")),
  ];
  // BOM UTF-8 per l'apertura corretta degli accenti in Excel.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
