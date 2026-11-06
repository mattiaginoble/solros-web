"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/components/ui/controls";
import { IconUpload } from "@/components/ui/icons";
import { availableAnalyzers, type AnalyzerInfo } from "@/floorplan/client";
import { loadFloorplanFile } from "@/floorplan/load";
import { fitToFloor } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { placeFloorplan, recognizeFloorplan } from "@/store/floorplan";

/** Passo 1: scelta del file (PNG, JPG o PDF). */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await loadFloorplanFile(file);
      onClose();
      placeFloorplan(img);
      useEditor.getState().notify("Planimetria caricata: ora imposta la scala cliccando due punti di cui conosci la distanza");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile leggere il file");
      setBusy(false);
    }
  };

  return (
    <Modal title="Carica una planimetria" onClose={onClose}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={`paper-grid flex flex-col items-center justify-center gap-3 rounded-[6px] border-2 border-dashed px-6 py-10 text-center ${
          drag ? "border-prussian" : "border-line-strong"
        }`}
      >
        <IconUpload size={28} className="text-prussian" />
        <p className="text-[15px] font-medium">Trascina qui il file della planimetria</p>
        <p className="text-sm text-muted">PNG, JPG o PDF (viene usata la prima pagina)</p>
        <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Lettura del file…" : "Scegli un file"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <ol className="mt-4 flex flex-col gap-1 text-sm text-graphite-soft">
        <li>1. La planimetria viene messa come sfondo semitrasparente del piano.</li>
        <li>2. Clicca due punti di cui conosci la distanza reale per impostare la scala.</li>
        <li>3. Ricalca le stanze con lo snap ai muri, oppure lascia che vengano riconosciute.</li>
      </ol>
    </Modal>
  );
}

/** Passo 3: ricalco manuale o riconoscimento automatico. */
export function ImportNextDialog({ onClose }: { onClose: () => void }) {
  const [analyzers, setAnalyzers] = useState<AnalyzerInfo[]>([{ id: "local", label: "Riconoscimento locale", available: true }]);
  const [choice, setChoice] = useState<"local" | "claude">("local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    availableAnalyzers().then((r) => {
      setAnalyzers(r.analyzers);
      setChoice(r.default);
    });
  }, []);

  const recognize = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await recognizeFloorplan(choice);
      onClose();
      requestAnimationFrame(() => fitToFloor());
      const notes = res.notes.length ? ` ${res.notes.join(" ")}` : "";
      useEditor
        .getState()
        .notify(
          res.rooms
            ? `Riconosciute ${res.rooms} stanze e ${res.openings} aperture: è una bozza, controlla e correggi.${notes}`
            : `Nessuna stanza riconosciuta.${notes} Prova a ricalcare a mano.`,
          res.rooms ? "info" : "warning",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Riconoscimento non riuscito");
      setBusy(false);
    }
  };

  return (
    <Modal title="Come vuoi creare le stanze?" onClose={onClose} width="max-w-xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-[6px] border border-line-strong p-4">
          <h3 className="font-semibold">Ricalca a mano</h3>
          <p className="flex-1 text-sm text-graphite-soft">
            Disegna i muri sopra la planimetria: i punti si agganciano alle facce dei muri riconosciute nell’immagine.
          </p>
          <Button
            onClick={() => {
              onClose();
              useEditor.getState().setTool("draw");
            }}
          >
            Inizia a ricalcare
          </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-[6px] border border-line-strong p-4">
          <h3 className="font-semibold">Riconosci automaticamente</h3>
          <p className="flex-1 text-sm text-graphite-soft">
            Stanze, porte e finestre vengono create come bozza, tutte modificabili.
          </p>
          {analyzers.filter((a) => a.available).length > 1 && (
            <select
              aria-label="Metodo di riconoscimento"
              value={choice}
              onChange={(e) => setChoice(e.target.value as "local" | "claude")}
              className="h-9 rounded-[5px] border border-line-strong bg-panel px-2 text-sm"
            >
              {analyzers
                .filter((a) => a.available)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
            </select>
          )}
          <Button variant="primary" disabled={busy} onClick={() => void recognize()}>
            {busy ? "Analisi in corso…" : "Riconosci stanze"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
