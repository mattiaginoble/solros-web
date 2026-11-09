"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, NumberField, SelectField, Segmented, TextField } from "@/components/ui/controls";
import { SymbolSvg } from "@/components/items/ProductThumb";
import { headersOf, rowsFromFeedText } from "@/catalog/feedRows";
import { IMPORT_FIELDS, autoDetectMapping, mapRows, normalizeLink, type ColumnMapping } from "@/catalog/importMapping";
import type { LinkMetadata } from "@/catalog/linkMetadata";
import { ShapeSchema, type MountType, type Shape } from "@/domain/schema";
import { api, type ImportBatch } from "@/lib/client/api";
import { FEATURES } from "@/lib/client/mode";
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
      await api.saveProduct(product);
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
          <TextField live label="Nome" value={d.name} onChange={(name) => set({ name })} className="col-span-2" />
          <TextField live label="Rivenditore" value={d.retailer} onChange={(retailer) => set({ retailer })} />
          <TextField live label="Codice articolo" value={d.code} onChange={(code) => set({ code })} />
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
        <TextField live label="Colore" value={d.color} onChange={(color) => set({ color })} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Tinta per pianta e 3D</span>
          <input type="color" value={d.colorHex} onChange={(e) => set({ colorHex: e.target.value })} className="h-9 w-full rounded border border-line-strong" />
        </label>
        <TextField live label="Link alla pagina del prodotto" value={d.url} onChange={(url) => set({ url })} />
        <TextField live label="Immagine (URL)" value={d.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
        <TextField live label="Modello 3D glTF (URL, facoltativo)" value={d.modelUrl} onChange={(modelUrl) => set({ modelUrl })} className="sm:col-span-2" />
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
      const { metadata } = await api.readProductLink(url);
      setMeta(metadata);
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
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  // Feed da indirizzo: le righe sono un'anteprima, il server scarica e aggiorna il feed completo.
  const [feedUrl, setFeedUrl] = useState("");
  const [feedSource, setFeedSource] = useState<string | null>(null);
  const [feedTotal, setFeedTotal] = useState(0);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const loadBatches = () =>
    api
      .listImportBatches()
      .then((b) => setBatches(b.batches))
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
      const parsedRows = rowsFromFeedText(await file.text(), file.name);
      const hs = headersOf(parsedRows);
      setHeaders(hs);
      setMapping(autoDetectMapping(hs));
      setRows(parsedRows);
      setFeedSource(null);
      setBatch(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "File non leggibile");
    }
  };

  const readFeed = async () => {
    const url = normalizeLink(feedUrl);
    if (!url) {
      setError("Indirizzo del feed non valido: usa un indirizzo http o https");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preview = await api.fetchFeed(url);
      setHeaders(preview.headers);
      setMapping(autoDetectMapping(preview.headers));
      setRows(preview.rows);
      setFeedTotal(preview.total);
      setFeedSource(url);
      setBatch(new URL(url).hostname.replace(/^www\./, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feed non leggibile");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!result?.products.length) return;
    setBusy(true);
    setError(null);
    try {
      if (feedSource) {
        const run = await api.saveFeed({
          name: batch || "feed",
          url: feedSource,
          mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) as Record<string, string>,
          unit,
          retailer: retailer || "Importato",
          currency: "EUR",
        });
        useEditor.getState().notify(`${run.status}. Il feed si aggiornerà da solo ogni giorno.`);
        setRows(null);
        void loadBatches();
        onSaved();
        return;
      }
      const { imported } = await api.importProducts(batch || "import", result.products);
      useEditor.getState().notify(`Importati ${imported} prodotti nel catalogo`);
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
            Carica un catalogo o un feed in formato CSV (separatore virgola o punto e virgola, con intestazione), JSON (un elenco di
            prodotti) oppure XML (feed Google Merchant o delle reti di affiliazione). Le colonne vengono riconosciute dal nome e si
            possono correggere prima dell’import.
          </p>
          <label className="paper-grid flex cursor-pointer flex-col items-center gap-2 rounded-[6px] border-2 border-dashed border-line-strong px-6 py-8 text-center">
            <span className="text-[15px] font-medium">Scegli un file CSV, JSON o XML</span>
            <span className="text-sm text-muted">Servono almeno nome, prezzo e misure</span>
            <input type="file" accept=".csv,.json,.xml,.txt,text/csv,application/json,application/xml,text/xml" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {FEATURES.feeds && (
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void readFeed();
              }}
            >
              <div className="flex items-end gap-2">
                <TextField live label="Oppure l'indirizzo di un feed (si aggiornerà ogni giorno)" value={feedUrl} onChange={setFeedUrl} className="flex-1" />
                <Button type="submit" disabled={busy || !feedUrl.trim()}>
                  {busy ? "Lettura…" : "Leggi feed"}
                </Button>
              </div>
              <p className="text-xs text-muted">
                Usa solo feed forniti dal rivenditore o dal tuo programma di affiliazione (CSV, JSON o XML, anche compressi .gz, fino a
                20 MB e 5000 prodotti).
              </p>
            </form>
          )}
          {batches.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Cataloghi già importati</h3>
              <ul className="divide-y divide-line rounded-[5px] border border-line">
                {batches.map((b) => (
                  <li key={b.batch} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      {b.batch} <span className="text-muted">({b.count} prodotti)</span>
                      {b.feed && (
                        <span className="block truncate text-xs text-muted">
                          Feed aggiornato {b.feed.lastRunAt ? `il ${new Date(b.feed.lastRunAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : "mai"}
                          {b.feed.lastStatus ? ` · ${b.feed.lastStatus}` : ""}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-2">
                      {b.feed && (
                        <Button
                          size="sm"
                          disabled={refreshing === b.feed.id}
                          onClick={async () => {
                            const id = b.feed!.id;
                            setRefreshing(id);
                            try {
                              const run = await api.refreshFeed(id);
                              useEditor.getState().notify(run.status);
                              onSaved();
                            } catch (e) {
                              useEditor.getState().notify(e instanceof Error ? e.message : "Aggiornamento non riuscito", "warning");
                            } finally {
                              setRefreshing(null);
                              void loadBatches();
                            }
                          }}
                        >
                          {refreshing === b.feed.id ? "Aggiornamento…" : "Aggiorna ora"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          if (!confirm(`Eliminare i ${b.count} prodotti di «${b.batch}» dal catalogo${b.feed ? " e il feed che li aggiorna" : ""}?`)) return;
                          await api.deleteImportBatch(b.batch).catch(() => {});
                          void loadBatches();
                          onSaved();
                        }}
                      >
                        Elimina
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField live label="Nome del catalogo" value={batch} onChange={setBatch} />
            <TextField live label="Rivenditore (se manca la colonna)" value={retailer} onChange={setRetailer} placeholder="Importato" />
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
                {feedSource && feedTotal > rows.length ? ` (anteprima delle prime ${rows.length} righe su ${feedTotal})` : ""}
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
            <Button onClick={() => setRows(null)}>{feedSource ? "Indietro" : "Scegli un altro file"}</Button>
            <Button variant="primary" disabled={busy || !result?.products.length} onClick={() => void doImport()}>
              {busy ? "Import in corso…" : feedSource ? "Salva il feed e importa" : `Importa ${result?.products.length ?? 0} prodotti`}
            </Button>
          </div>
        </>
      )}
      {error && !rows && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function AddProductsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(FEATURES.productLink ? "link" : "file");
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
            ...(FEATURES.productLink ? [{ value: "link" as const, label: "Da link" }] : []),
            { value: "file", label: "Da file CSV, JSON o XML" },
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
