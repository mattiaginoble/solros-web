/** Esportazione del preventivo in CSV (separatore ";" e virgola decimale, leggibile da Excel in italiano). */
import type { Quote } from "./quote";

/** Inizi che Excel o LibreOffice interpreterebbero come formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: string | number): string {
  let s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
  // Nomi, codici e rivenditori arrivano da file importati e pagine di terzi:
  // l'apostrofo iniziale li fa trattare come testo.
  if (typeof v === "string" && FORMULA_START.test(s)) s = `'${s}`;
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
    cell(l.currency),
    cell(l.rooms.join(", ")),
    cell(l.priceUpdatedAt ? l.priceUpdatedAt.slice(0, 10) : ""),
  ]);
  const totals = Object.entries(quote.totals).map(([c, v]) => ["Totale", "", "", "", String(quote.itemCount), "", cell(v), cell(c), "", ""]);
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
