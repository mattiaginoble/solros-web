/**
 * Salvataggio automatico: a ogni modifica del documento (revision) parte un
 * salvataggio ritardato sul server; una copia di sicurezza resta in localStorage
 * così da poter recuperare il lavoro anche se il server non risponde.
 */
import { api } from "@/lib/client/api";
import type { House } from "@/domain/schema";
import { useEditor } from "./editor";

const DEBOUNCE_MS = 900;
const backupKey = (id: string) => `configuratore-casa:backup:${id}`;

export function readBackup(projectId: string): { house: House; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(backupKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearBackup(projectId: string) {
  try {
    localStorage.removeItem(backupKey(projectId));
  } catch {
    /* storage non disponibile */
  }
}

function writeBackup(projectId: string, house: House) {
  try {
    localStorage.setItem(backupKey(projectId), JSON.stringify({ house, savedAt: Date.now() }));
  } catch {
    /* quota piena o storage disabilitato: si prosegue senza copia locale */
  }
}

/** Avvia l'autosalvataggio; restituisce la funzione di arresto. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let pending = false;

  const flush = async (keepalive = false) => {
    const { projectId, house, readOnly, txBase } = useEditor.getState();
    if (!projectId || readOnly) return;
    if (txBase && !keepalive) {
      // Durante un trascinamento si aspetta la fine del gesto.
      schedule();
      return;
    }
    if (inFlight) {
      pending = true;
      return;
    }
    inFlight = true;
    const revision = useEditor.getState().revision;
    useEditor.getState().setSaveStatus("saving");
    try {
      await api.saveProject(projectId, house, { keepalive });
      const now = Date.now();
      if (useEditor.getState().revision === revision) {
        useEditor.getState().setSaveStatus("saved", now);
        clearBackup(projectId);
      } else useEditor.getState().setSaveStatus("dirty", now);
    } catch {
      useEditor.getState().setSaveStatus("error");
      writeBackup(projectId, house);
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  };

  let lastRevision = useEditor.getState().revision;
  const unsub = useEditor.subscribe((s) => {
    if (s.revision === lastRevision) return;
    lastRevision = s.revision;
    if (!s.projectId || s.readOnly) return;
    writeBackup(s.projectId, s.house);
    if (s.saveStatus !== "saving") s.setSaveStatus("dirty");
    schedule();
  });

  const onHide = () => {
    if (useEditor.getState().saveStatus === "dirty") void flush(true);
  };
  window.addEventListener("pagehide", onHide);

  return () => {
    unsub();
    window.removeEventListener("pagehide", onHide);
    if (timer) clearTimeout(timer);
    if (useEditor.getState().saveStatus === "dirty") void flush(true);
  };
}

/** Salvataggio immediato (es. pulsante o Ctrl+S). */
export async function saveNow() {
  const { projectId, house, readOnly } = useEditor.getState();
  if (!projectId || readOnly) return;
  useEditor.getState().setSaveStatus("saving");
  try {
    await api.saveProject(projectId, house);
    useEditor.getState().setSaveStatus("saved", Date.now());
    clearBackup(projectId);
  } catch {
    useEditor.getState().setSaveStatus("error");
  }
}
