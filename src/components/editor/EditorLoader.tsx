"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { safeParseHouse } from "@/domain/schema";
import { useEditor } from "@/store/editor";
import { clearBackup, readBackup, startAutosave } from "@/store/persistence";
import { Button } from "@/components/ui/controls";
import { Editor } from "./Editor";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" }
  | { status: "recover"; backupAt: number };

export function EditorLoader({ id, action }: { id: string; action?: string | null }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { project } = await api.getProject(id);
        if (cancelled) return;
        useEditor.getState().load(project.data, { projectId: project.id, readOnly: project.readOnly });
        const backup = project.readOnly ? null : readBackup(project.id);
        if (backup && backup.savedAt > new Date(project.updatedAt).getTime() + 1000) {
          setState({ status: "recover", backupAt: backup.savedAt });
        } else {
          if (backup) clearBackup(project.id);
          setState({ status: "ready" });
        }
        stop = startAutosave();
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            err instanceof ApiError && err.status === 404
              ? "Questo progetto non esiste o è stato eliminato."
              : err instanceof ApiError && err.status === 403
                ? "Non hai accesso a questo progetto."
                : "Impossibile aprire il progetto. Controlla la connessione e riprova.",
        });
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [id]);

  if (state.status === "loading")
    return <div className="paper-grid flex h-dvh items-center justify-center text-sm text-muted">Apertura del progetto…</div>;
  if (state.status === "error")
    return (
      <div className="paper-grid flex h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-[8px] border border-line-strong bg-panel p-6">
          <p className="font-semibold">{state.message}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-prussian underline">
            Torna ai progetti
          </Link>
        </div>
      </div>
    );
  if (state.status === "recover")
    return (
      <div className="paper-grid flex h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-[8px] border border-line-strong bg-panel p-6">
          <p className="font-semibold">Ci sono modifiche non salvate su questo dispositivo</p>
          <p className="mt-1 text-sm text-muted">
            Copia locale del {new Date(state.backupAt).toLocaleString("it-IT")}, più recente della versione sul server.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const b = readBackup(id);
                const parsed = b ? safeParseHouse(b.house) : null;
                if (parsed?.success) useEditor.getState().apply(() => parsed.data);
                setState({ status: "ready" });
              }}
            >
              Ripristina le modifiche
            </Button>
            <Button
              onClick={() => {
                clearBackup(id);
                setState({ status: "ready" });
              }}
            >
              Usa la versione salvata
            </Button>
          </div>
        </div>
      </div>
    );
  return <Editor initialAction={action} />;
}
