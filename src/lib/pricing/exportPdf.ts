"use client";
/** Preventivo in PDF (jsPDF + autotable), generato interamente nel browser. */
import type { Quote } from "./quote";
import { formatMoney, formatPriceDate, formatTotals } from "./quote";

export async function quoteToPdf(quote: Quote, houseName: string, opts: { groupBy: "rooms" | "retailers"; multiFloor?: boolean }) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Preventivo: ${houseName}`, margin, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")} con Configuratore Casa`, margin, 24);
  const note = `Prezzi indicativi${quote.oldestPriceDate ? ` aggiornati dal ${formatPriceDate(quote.oldestPriceDate)} in poi` : ""}: possono essere cambiati, verificare sul sito del rivenditore.${quote.hasDemo ? " Alcuni prodotti sono dati demo." : ""}`;
  doc.text(doc.splitTextToSize(note, 182), margin, 29);
  doc.setTextColor(20);

  let y = 38;
  const head = [["Prodotto", "Codice", "Q.tà", "Prezzo", "Totale"]];
  const groups =
    opts.groupBy === "rooms"
      ? quote.byRoom.map((r) => ({ title: opts.multiFloor && r.floorName ? `${r.roomName} (${r.floorName})` : r.roomName, lines: r.lines, totals: r.totals }))
      : quote.byRetailer.map((r) => ({ title: r.retailer, lines: r.lines, totals: r.totals }));
  for (const g of groups) {
    autoTable(doc, {
      startY: y,
      head: [[{ content: `${g.title}`, colSpan: 4, styles: { halign: "left" } }, { content: formatTotals(g.totals), styles: { halign: "right" } }], ...head],
      body: g.lines.map((l) => [
        l.url ? `${l.name}\n${l.retailer}` : `${l.name}\n${l.retailer}`,
        l.code ?? "",
        String(l.quantity),
        formatMoney(l.unitPrice, l.currency),
        formatMoney(l.total, l.currency),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [29, 79, 145], textColor: 255 },
      columnStyles: {
        1: { cellWidth: 26 },
        2: { halign: "right", cellWidth: 14 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 28 },
      },
      didDrawCell: (data) => {
        // Link cliccabile sul nome del prodotto.
        if (data.section === "body" && data.column.index === 0) {
          const line = g.lines[data.row.index];
          if (line?.url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: line.url });
        }
      },
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  if (y > 280) {
    doc.addPage();
    y = 20;
  }
  doc.text(`Totale casa: ${formatTotals(quote.totals)}`, 196, y + 2, { align: "right" });
  doc.save(`preventivo-${slug(houseName)}.pdf`);
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "progetto"
  );
}

export function downloadText(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
