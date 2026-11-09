"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { CatalogPanel } from "@/components/catalog/CatalogPanel";
import { Dialogs } from "./Dialogs";
import { PropertiesPanel } from "./PropertiesPanel";
import { RightPanel } from "./RightPanel";
import { Toast } from "./Toast";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { useShortcuts } from "./useShortcuts";

const Plan2D = dynamic(() => import("@/components/editor2d/Plan2D"), {
  ssr: false,
  loading: () => <CanvasLoading label="Preparazione della pianta…" />,
});

const Viewer3D = dynamic(() => import("@/components/viewer3d/Viewer3D"), {
  ssr: false,
  loading: () => <CanvasLoading label="Preparazione della vista 3D…" />,
});

function CanvasLoading({ label }: { label: string }) {
  return <div className="paper-grid flex h-full items-center justify-center text-sm text-muted">{label}</div>;
}

export interface EditorProps {
  /** Azione iniziale richiesta dall'onboarding (es. ?azione=rettangolo). */
  initialAction?: string | null;
  topRight?: ReactNode;
}

export function Editor({ initialAction, topRight }: EditorProps) {
  useShortcuts();
  const view = useEditor((s) => s.view);
  const readOnly = useEditor((s) => s.readOnly);
  // Sotto i 1024 px (tablet in verticale) il pannello laterale si apre a richiesta.
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    // Accesso agli store dalla console e dai test end-to-end, solo in sviluppo.
    if (process.env.NODE_ENV !== "production") {
      Object.assign(window, { __casa: { editor: useEditor, view: useView2D } });
    }
  }, []);

  useEffect(() => {
    const s = useEditor.getState();
    if (!initialAction || s.readOnly) return;
    if (initialAction === "rettangolo") s.openDialog("rect");
    else if (initialAction === "disegna") s.setTool("draw");
    else if (initialAction === "modelli") s.openDialog("templates");
    else if (initialAction === "planimetria") s.openDialog("import");
    // L'azione vale solo all'arrivo dalla home: tolta dall'indirizzo, non si ripete ricaricando la pagina.
    const url = new URL(window.location.href);
    if (url.searchParams.has("azione")) {
      url.searchParams.delete("azione");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [initialAction]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-paper">
      <TopBar rightSlot={topRight} />
      <div className="flex min-h-0 flex-1">
        {!readOnly && <Toolbar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1" aria-label="Area di disegno">
            {view === "2d" ? <Plan2D /> : <Viewer3D />}
          </main>
          <PropertiesPanel />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className={`absolute top-[68px] z-20 rounded-[6px] border border-line-strong bg-panel px-3 py-2 text-[13px] font-medium shadow-[0_8px_20px_-12px_rgba(35,39,43,0.5)] lg:hidden ${
            panelOpen ? "right-[292px]" : "right-3"
          }`}
        >
          {panelOpen ? "Chiudi pannello" : "Catalogo e stanze"}
        </button>
        <div
          className={`max-lg:absolute max-lg:bottom-0 max-lg:right-0 max-lg:top-14 max-lg:z-10 max-lg:shadow-[-12px_0_30px_-18px_rgba(35,39,43,0.5)] ${
            panelOpen ? "flex" : "max-lg:hidden"
          } lg:flex`}
        >
          <RightPanel extraTabs={[{ id: "catalog", label: "Catalogo", content: <CatalogPanel /> }]} />
        </div>
      </div>
      <Dialogs />
      <Toast />
    </div>
  );
}
