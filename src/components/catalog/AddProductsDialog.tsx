"use client";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, NumberField, SelectField, Segmented, TextField } from "@/components/ui/controls";
import { SymbolSvg } from "@/components/items/ProductThumb";
import { IMPORT_FIELDS, autoDetectMapping, mapRows, normalizeLink, rowsFromJson, type ColumnMapping } from "@/catalog/importMapping";
import type { LinkMetadata } from "@/catalog/linkMetadata";
import { ShapeSchema, type MountType, type Shape } from "@/domain/schema";
import { formatMoney } from "@/lib/pricing/quote";
import { useEditor } from "@/store/editor";
import { useCatalogVersion } from "./catalogVersion";

type Tab = "link" | "file" | "manual";

const CATEGORIES = ["Soggiorno", "Camera", "Sala da pranzo", "Cucina", "Bagno", "Ufficio", "Illuminazione", "Elettrodomestici", "Decorazioni", "Altro"];

const SHAPE_LABELS: Partial<Record<Shape, string>> = {
  box: "Generico",
  sofa: "Divano",
  armchair: "Poltrona",
  bed: "Letto",
  table: "Tavolo",
  chair: "Sedia",
  desk: "Scrivania",
  wardrobe: "Armadio",
  cabinet: "Mobile",
  shelf: "Libreria",
  nightstand: "Comodino",
  "tv-unit": "Mobile TV",
  fridge: "Frigorifero",
  oven: "Forno",
  dishwasher: "Lavastoviglie",
  washer: "Lavatrice",
  cooktop: "Piano cottura",
  hood: "Cappa",
  sink: "Lavello",
  washbasin: "Lavabo",
  toilet: "WC",
  bidet: "Bidet",
  shower: "Doccia",
  bathtub: "Vasca",
  mirror: "Specchio",
  "lamp-floor": "Lampada da terra",
  "lamp-ceiling": "Lampada a soffitto",
  "lamp-wall": "Applique",
  rug: "Tappeto",
  plant: "Pianta",
  stairs: "Scala",
};

interface Draft {
  name: string;
  retailer: string;
  code: string;
  category: string;
  subcategory: string;
  width: number;
  depth: number;
  height: number;
  price: number;
  currency: string;
  color: string;
  colorHex: string;
  imageUrl: string;
  url: string;
  mount: MountType;
  elevation: number;
  clearanceFront: number;
  shape: Shape;
  modelUrl: string;
}

const EMPTY: Draft = {
  name: "",
  retailer: "",
  code: "",
  category: "Soggiorno",
  subcategory: "",
  width: 100,
  depth: 50,
  height: 80,
  price: 0,
  currency: "EUR",
  color: "",
  colorHex: "#cfcac2",
  imageUrl: "",
  url: "",
  mount: "floor",
  elevation: 0,
  clearanceFront: 0,
  shape: "box",
  modelUrl: "",
};

function draftFromMetadata(m: LinkMetadata): Draft {
  return {
    ...EMPTY,
    name: m.name ?? "",
    retailer: m.retailer ?? "",
    code: m.code ?? "",
    category: m.category ?? "Altro",
    width: Math.round(m.width ?? 0),
    depth: Math.round(m.depth ?? 0),
    height: Math.round(m.height ?? 0),
    price: m.price ?? 0,
    currency: m.currency ?? "EUR",
    color: m.color ?? "",
    imageUrl: m.imageUrl ?? "",
    url: m.url,
    shape: (ShapeSchema.safeParse(m.shape).success ? m.shape : "box") as Shape,
    mount: (m.mount as MountType) ?? "floor",
  };
}

function ProductForm({ initial, source, onSaved, note }: { initial: Draft; source: "link" | "manual"; onSaved: () => void; note?: string }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const missing = !d.name.trim() || d.width <= 0 || d.depth <= 0 || d.height <= 0;

  const save = async () => {
    const links = { url: normalizeLink(d.url), imageUrl: normalizeLink(d.imageUrl), modelUrl: normalizeLink(d.modelUrl) };
    const invalid = (["url", "imageUrl", "modelUrl"] as const).find((k) => d[k].trim() && !links[k]);
    if (invalid) {
      const label = { url: "Il link alla pagina del prodotto", imageUrl: "L'indirizzo dell'immagine", modelUrl: "L'indirizzo del modello 3D" }[invalid];
      setError(`${label} non è valido: usa un indirizzo che inizia con http:// o https://`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const product = {
        source,
        name: d.name.trim(),
        retailer: d.retailer.trim() || "Personalizzato",
        code: d.code.trim() || undefined,
        category: d.category,
        subcategory: d.subcategory.trim() || undefined,
        width: d.width,
        depth: d.depth,
        height: d.height,
        price: d.price,
        currency: d.currency.trim().toUpperCase() || "EUR",
        color: d.color.trim() || undefined,
        colorHex: d.colorHex,
        imageUrl: links.imageUrl,
        url: links.url,
        mount: d.mount,
        elevation: d.mount !== "floor" ? d.elevation : undefined,
        clearance: { front: d.clearanceFront, sides: 0 },
        shape: d.shape,
        modelUrl: links.modelUrl,
      };
      const res = await fetch("/api/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Salvataggio non riuscito");
      useEditor.getState().notify(`«${product.name}» aggiunto al catalogo`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {note && <p className="rounded-[5px] border border-warning/40 bg-warning-tint px-3 py-2 text-[12.5px] text-graphite-soft">{note}</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nome" value={d.name} onChange={(name) => set({ name })} className="col-span-2" />
          <TextField label="Rivenditore" value={d.retailer} onChange={(retailer) => set({ retailer })} />
          <TextField label="Codice articolo" value={d.code} onChange={(code) => set({ code })} />
          <SelectField label="Categoria" value={d.category} options={[...new Set([...CATEGORIES, d.category])].map((c) => ({ value: c, label: c }))} onChange={(category) => set({ category })} />
          <SelectField
            label="Forma (per pianta e 3D)"
            value={d.shape}
            options={ShapeSchema.options.filter((s) => SHAPE_LABELS[s]).map((s) => ({ value: s, label: SHAPE_LABELS[s]! }))}
            onChange={(shape) => set({ shape })}
          />
        </div>
        <div className="paper-grid flex h-[120px] items-center justify-center rounded-[5px] border border-line">
          {d.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.imageUrl} alt="" referrerPolicy="no-referrer" className="max-h-28 max-w-28 object-contain" />
          ) : (
            <SymbolSvg product={{ shape: d.shape, width: Math.max(d.width, 1), depth: Math.max(d.depth, 1), colorHex: d.colorHex }} className="h-24 w-24" />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <NumberField label="Larghezza" value={d.width} min={1} max={2000} onChange={(width) => set({ width })} width="w-16" />
        <NumberField label="Profondità" value={d.depth} min={1} max={2000} onChange={(depth) => set({ depth })} width="w-16" />
        <NumberField label="Altezza" value={d.height} min={1} max={1000} onChange={(height) => set({ height })} width="w-16" />
        <NumberField label="Prezzo" unit={d.currency} value={d.price} min={0} max={1_000_000} decimals={2} onChange={(price) => set({ price })} width="w-20" />
        <SelectField
          label="Montaggio"
          value={d.mount}
          options={[
            { value: "floor", label: "A pavimento" },
            { value: "wall", label: "A parete" },
            { value: "ceiling", label: "A soffitto" },
          ]}
          onChange={(mount) => set({ mount })}
        />
        {d.mount === "wall" && <NumberField label="Altezza da terra" value={d.elevation} min={0} max={400} onChange={(elevation) => set({ elevation })} width="w-16" />}
        <NumberField label="Spazio apertura" value={d.clearanceFront} min={0} max={200} onChange={(clearanceFront) => set({ clearanceFront })} width="w-16" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Colore" value={d.color} onChange={(color) => set({ color })} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Tinta per pianta e 3D</span>
          <input type="color" value={d.colorHex} onChange={(e) => set({ colorHex: e.target.value })} className="h-9 w-full rounded border border-line-strong" />
        </label>
        <TextField label="Link alla pagina del prodotto" value={d.url} onChange={(url) => set({ url })} />
        <TextField label="Immagine (URL)" value={d.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
        <TextField label="Modello 3D glTF (URL, facoltativo)" value={d.modelUrl} onChange={(modelUrl) => set({ modelUrl })} className="sm:col-span-2" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {missing && <span className="text-sm text-muted">Servono nome e misure</span>}
        <Button variant="primary" disabled={busy || missing} onClick={() => void save()}>
          {busy ? "Salvataggio…" : "Salva nel catalogo"}
        </Button>
      </div>
    </div>
  );
}

function LinkTab({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<LinkMetadata | null>(null);
  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Lettura non riuscita");
      setMeta(body.metadata);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lettura non riuscita");
    } finally {
      setBusy(false);
    }
  };
  if (meta) {
    const found = meta.found.length ? `Dati letti dalla pagina: ${meta.found.join(", ")}.` : "La pagina non contiene dati strutturati.";
    return (
      <ProductForm
        key={meta.url}
        initial={draftFromMetadata(meta)}
        source="link"
        onSaved={onSaved}
        note={`${found} Controlla e completa i campi prima di salvare: prezzi e misure possono essere incompleti o cambiare nel tempo.`}
      />
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) void read();
      }}
    >
      <p className="text-sm text-graphite-soft">
        Incolla l’indirizzo della pagina di un prodotto (qualsiasi rivenditore). Vengono letti solo i dati pubblici della pagina
        (JSON-LD, Open Graph) con una singola richiesta, rispettando il robots.txt del sito.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Indirizzo della pagina</span>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="https://www.esempio.it/prodotto/…"
          className="h-10 rounded-[5px] border border-line-strong px-3 text-sm outline-none focus:border-prussian"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
          {busy ? "Lettura della pagina…" : "Leggi la pagina"}
        </Button>
      </div>
    </form>
  );
}

function FileTab({ onSaved }: { onSaved: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [unit, setUnit] = useState<"cm" | "mm" | "m">("cm");
  const [retailer, setRetailer] = useState("");
  const [batch, setBatch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<{ batch: string; count: number }[]>([]);
  const loadBatches = () =>
    fetch("/api/catalog/import")
      .then((r) => r.json())
      .then((b) => setBatches(b.batches ?? []))
      .catch(() => {});
  useEffect(() => {
    void loadBatches();
  }, []);

  const result = useMemo(
    () =>
      rows
        ? mapRows(rows, mapping, { unit, retailer: retailer || "Importato", currency: "EUR", batch: batch || "import", priceDate: new Date().toISOString() })
        : null,
    [rows, mapping, unit, retailer, batch],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const textContent = await file.text();
      let parsedRows: Record<string, unknown>[];
      if (file.name.toLowerCase().endsWith(".json")) parsedRows = rowsFromJson(JSON.parse(textContent));
      else {
        const p = Papa.parse<Record<string, unknown>>(textContent, { header: true, skipEmptyLines: true, dynamicTyping: false });
        parsedRows = p.data;
      }
      if (!parsedRows.length) throw new Error("Il file non contiene righe");
      const hs = Array.from(new Set(parsedRows.flatMap((r) => Object.keys(r))));
      setHeaders(hs);
      setMapping(autoDetectMapping(hs));
      setRows(parsedRows);
      setBatch(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File non leggibile");
    }
  };

  const doImport = async () => {
    if (!result?.products.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: batch || "import", products: result.products }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Import non riuscito");
      useEditor.getState().notify(`Importati ${body.imported} prodotti nel catalogo`);
      setRows(null);
      void loadBatches();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import non riuscito");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!rows ? (
        <>
          <p className="text-sm text-graphite-soft">
            Carica un catalogo o un feed in formato CSV (separatore virgola o punto e virgola, con intestazione) oppure JSON (un elenco
            di prodotti). Le colonne vengono riconosciute dal nome e si possono correggere prima dell’import.
          </p>
          <label className="paper-grid flex cursor-pointer flex-col items-center gap-2 rounded-[6px] border-2 border-dashed border-line-strong px-6 py-8 text-center">
            <span className="text-[15px] font-medium">Scegli un file CSV o JSON</span>
            <span className="text-sm text-muted">Servono almeno nome, prezzo e misure</span>
            <input type="file" accept=".csv,.json,.txt,text/csv,application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {batches.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Cataloghi già importati</h3>
              <ul className="divide-y divide-line rounded-[5px] border border-line">
                {batches.map((b) => (
                  <li key={b.batch} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {b.batch} <span className="text-muted">({b.count} prodotti)</span>
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (!confirm(`Eliminare i ${b.count} prodotti di «${b.batch}» dal catalogo?`)) return;
                        await fetch(`/api/catalog/import?batch=${encodeURIComponent(b.batch)}`, { method: "DELETE" });
                        void loadBatches();
                        onSaved();
                      }}
                    >
                      Elimina
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Nome del catalogo" value={batch} onChange={setBatch} />
            <TextField label="Rivenditore (se manca la colonna)" value={retailer} onChange={setRetailer} placeholder="Importato" />
            <SelectField
              label="Unità delle misure"
              value={unit}
              options={[
                { value: "cm", label: "Centimetri" },
                { value: "mm", label: "Millimetri" },
                { value: "m", label: "Metri" },
              ]}
              onChange={setUnit}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Corrispondenza delle colonne</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.id} className="flex flex-col gap-0.5 text-xs">
                  <span className="text-muted">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  <select
                    value={mapping[f.id] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.id]: e.target.value || undefined })}
                    className="h-8 rounded border border-line-strong bg-panel px-1 text-[13px]"
                  >
                    <option value="">Nessuna</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
          {result && (
            <div className="rounded-[5px] border border-line">
              <p className="border-b border-line px-3 py-2 text-sm">
                <strong>{result.products.length}</strong> prodotti pronti su {rows.length} righe
                {result.errors.length ? `, ${result.errors.length} righe scartate` : ""}
              </p>
              <ul className="max-h-36 overflow-y-auto text-[12.5px]">
                {result.products.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-line/60 px-3 py-1">
                    <span>
                      {p.name} <span className="text-muted">{p.width}×{p.depth}×{p.height} cm</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(p.price, p.currency)}</span>
                  </li>
                ))}
                {result.errors.slice(0, 8).map((e) => (
                  <li key={`e${e.row}`} className="border-b border-line/60 px-3 py-1 text-danger">
                    Riga {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-between">
            <Button onClick={() => setRows(null)}>Scegli un altro file</Button>
            <Button variant="primary" disabled={busy || !result?.products.length} onClick={() => void doImport()}>
              {busy ? "Import in corso…" : `Importa ${result?.products.length ?? 0} prodotti`}
            </Button>
          </div>
        </>
      )}
      {error && !rows && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function AddProductsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("link");
  const bump = useCatalogVersion((s) => s.bump);
  const saved = () => {
    bump();
    onClose();
  };
  return (
    <Modal title="Aggiungi prodotti al catalogo" onClose={onClose} width="max-w-3xl">
      <div className="mb-4">
        <Segmented<Tab>
          label="Origine dei prodotti"
          value={tab}
          onChange={setTab}
          options={[
            { value: "link", label: "Da link" },
            { value: "file", label: "Da file CSV o JSON" },
            { value: "manual", label: "Inserimento manuale" },
          ]}
        />
      </div>
      {tab === "link" && <LinkTab onSaved={saved} />}
      {tab === "file" && <FileTab onSaved={bump} />}
      {tab === "manual" && <ProductForm initial={EMPTY} source="manual" onSaved={saved} />}
    </Modal>
  );
}
