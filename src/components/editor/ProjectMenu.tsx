"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/components/ui/controls";
import { IconShare } from "@/components/ui/icons";
import { api } from "@/lib/client/api";
import { BASE_PATH, editorHref, FEATURES } from "@/lib/client/mode";
import { downloadText, slug } from "@/lib/pricing/exportPdf";
import { useEditor } from "@/store/editor";
import { saveNow } from "@/store/persistence";

export const PROJECT_FILE_FORMAT = "configuratore-casa";

/** Esporta il progetto in JSON (riutilizzabile con "Importa progetto"). */
export function exportProjectJson() {
  const house = useEditor.getState().house;
  const payload = { format: PROJECT_FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), house };
  downloadText(JSON.stringify(payload, null, 2), `${slug(house.name)}.casa.json`, "application/json");
}

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const projectId = useEditor((s) => s.projectId);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    api
      .getProject(projectId)
      .then(({ project }) => setToken(project.shareToken ?? null))
      .catch(() => setError("Impossibile leggere lo stato della condivisione"));
  }, [projectId]);
  const url = token ? `${window.location.origin}${BASE_PATH}/share/${token}` : "";
  return (
    <Modal title="Condividi in sola lettura" onClose={onClose}>
      <p className="text-sm text-graphite-soft">
        Chi ha il link può vedere pianta, 3D e preventivo, ma non può modificare il progetto. Puoi disattivarlo in qualsiasi momento.
      </p>
      {token ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-[5px] border border-line-strong bg-panel-sunk px-3 text-sm" />
            <Button
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Copiato" : "Copia link"}
            </Button>
          </div>
          <div>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!projectId) return;
                await api.unshareProject(projectId);
                setToken(null);
              }}
            >
              Disattiva il link
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            variant="primary"
            disabled={!projectId}
            onClick={async () => {
              if (!projectId) return;
              try {
                await saveNow();
                const r = await api.shareProject(projectId);
                setToken(r.token);
              } catch {
                setError("Impossibile creare il link");
              }
            }}
          >
            Crea il link di condivisione
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

/** Menu del progetto nella barra in alto. */
export function ProjectMenu() {
  const router = useRouter();
  const projectId = useEditor((s) => s.projectId);
  const readOnly = useEditor((s) => s.readOnly);
  const openDialog = useEditor((s) => s.openDialog);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full items-center rounded-[4px] px-2.5 py-2 text-left text-sm hover:bg-panel-sunk disabled:opacity-40";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Progetto: condividi, esporta, duplica"
        className="flex h-9 items-center gap-1.5 rounded-[5px] border border-line-strong px-2.5 text-[13px] font-medium hover:border-graphite-soft"
      >
        <IconShare size={16} />
        <span className="hidden xl:inline">Progetto</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-64 rounded-[6px] border border-line-strong bg-panel p-1 shadow-[0_12px_30px_-12px_rgba(35,39,43,0.4)]">
          {FEATURES.sharing && (
            <button type="button" role="menuitem" className={item} disabled={!projectId || readOnly} onClick={() => { setOpen(false); openDialog("share"); }}>
              Condividi in sola lettura
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); openDialog("quote"); }}>
            Preventivo ed export PDF/CSV
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); exportProjectJson(); }}>
            Esporta progetto (JSON)
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            disabled={!projectId}
            onClick={async () => {
              setOpen(false);
              if (!projectId) return;
              if (!readOnly) await saveNow();
              const { project } = await api.duplicateProject(projectId);
              router.push(editorHref(project.id));
            }}
          >
            {readOnly ? "Crea una copia modificabile" : "Duplica progetto"}
          </button>
        </div>
      )}
    </div>
  );
}
