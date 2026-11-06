"use client";
import { useMemo, useState } from "react";
import { Button, Modal, Segmented } from "@/components/ui/controls";
import { quoteToCsv } from "@/lib/pricing/exportCsv";
import { downloadText, quoteToPdf, slug } from "@/lib/pricing/exportPdf";
import { formatMoney, formatPriceDate, formatTotals, quoteForHouse, type QuoteLine } from "@/lib/pricing/quote";
import { useEditor } from "@/store/editor";

type View = "rooms" | "retailers" | "list";

function LinesTable({ lines, showRooms }: { lines: QuoteLine[]; showRooms?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="py-1.5 pr-2 font-normal">Prodotto</th>
          <th className="py-1.5 pr-2 text-right font-normal">Q.tà</th>
          <th className="py-1.5 pr-2 text-right font-normal">Prezzo</th>
          <th className="py-1.5 text-right font-normal">Totale</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key} className="border-b border-line/70 align-top">
            <td className="py-1.5 pr-2">
              {l.url ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="block text-prussian underline-offset-2 hover:underline">
                  {l.name}
                </a>
              ) : (
                <span className="block">{l.name}</span>
              )}
              <span className="block text-xs text-muted">
                {l.retailer}
                {l.code ? `, cod. ${l.code}` : ""}
                {showRooms && l.rooms.length ? `, ${l.rooms.join(", ")}` : ""}
              </span>
            </td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{l.quantity}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(l.unitPrice, l.currency)}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{formatMoney(l.total, l.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function QuoteDialog({ onClose }: { onClose: () => void }) {
  const house = useEditor((s) => s.house);
  const quote = useMemo(() => quoteForHouse(house), [house]);
  const [view, setView] = useState<View>("rooms");
  const [busy, setBusy] = useState(false);
  const links = Array.from(new Map(quote.lines.filter((l) => l.url).map((l) => [l.url!, l])).values());

  const openAll = () => {
    let blocked = 0;
    for (const l of links) {
      const w = window.open(l.url, "_blank", "noopener,noreferrer");
      if (!w) blocked++;
    }
    if (blocked) useEditor.getState().notify(`Il browser ha bloccato ${blocked} schede: consenti i popup per questo sito o usa i link nell'elenco`, "warning");
  };

  return (
    <Modal
      title={`Preventivo di ${house.name}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <Button
            className="mr-auto"
            disabled={!links.length}
            onClick={openAll}
            title={links.length ? `Apre ${links.length} pagine prodotto in nuove schede` : "Nessun prodotto ha un link"}
          >
            Apri i link dei prodotti ({links.length})
          </Button>
          <Button disabled={!quote.lines.length} onClick={() => downloadText(quoteToCsv(quote, house.name), `preventivo-${slug(house.name)}.csv`, "text/csv;charset=utf-8")}>
            Esporta CSV
          </Button>
          <Button
            variant="primary"
            disabled={!quote.lines.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await quoteToPdf(quote, house.name, { groupBy: view === "retailers" ? "retailers" : "rooms", multiFloor: house.floors.length > 1 });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creazione PDF…" : "Esporta PDF"}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View>
          label="Raggruppamento"
          value={view}
          onChange={setView}
          options={[
            { value: "rooms", label: "Per stanza" },
            { value: "retailers", label: "Per rivenditore" },
            { value: "list", label: "Lista della spesa" },
          ]}
        />
        <div className="text-right">
          <span className="block text-xs text-muted">Totale casa</span>
          <span className="text-xl font-semibold tabular-nums">{formatTotals(quote.totals, house.settings.currency)}</span>
        </div>
      </div>

      <p className="mt-3 rounded-[5px] border border-warning/40 bg-warning-tint px-3 py-2 text-[12.5px] text-graphite-soft">
        Prezzi indicativi
        {quote.oldestPriceDate ? `, aggiornati dal ${formatPriceDate(quote.oldestPriceDate)} in poi` : ""}: possono essere
        cambiati. {quote.hasDemo ? "Alcuni prodotti sono dati demo e non corrispondono a offerte reali." : ""}
      </p>

      {quote.lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Non ci sono ancora arredi nel progetto: aggiungili dal catalogo.</p>
      ) : view === "rooms" ? (
        <div className="mt-4 flex flex-col gap-6">
          {quote.byRoom.map((r) => (
            <section key={r.roomId}>
              <div className="flex items-baseline justify-between border-b border-line-strong pb-1">
                <h3 className="font-semibold">
                  {r.roomName}
                  {house.floors.length > 1 && <span className="ml-1.5 text-xs font-normal text-muted">{r.floorName}</span>}
                </h3>
                <span className="font-semibold tabular-nums">{formatTotals(r.totals)}</span>
              </div>
              <LinesTable lines={r.lines} />
            </section>
          ))}
        </div>
      ) : view === "retailers" ? (
        <div className="mt-4 flex flex-col gap-6">
          {quote.byRetailer.map((r) => (
            <section key={r.retailer}>
              <div className="flex items-baseline justify-between border-b border-line-strong pb-1">
                <h3 className="font-semibold">{r.retailer}</h3>
                <span className="font-semibold tabular-nums">{formatTotals(r.totals)}</span>
              </div>
              <LinesTable lines={r.lines} showRooms />
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <LinesTable lines={quote.lines} showRooms />
          <p className="mt-2 text-right text-sm text-muted">{quote.itemCount} pezzi in totale</p>
        </div>
      )}
    </Modal>
  );
}
