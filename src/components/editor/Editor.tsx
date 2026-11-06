"use client";
import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
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
  }, [initialAction]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <TopBar rightSlot={topRight} />
      <div className="flex min-h-0 flex-1">
        {!readOnly && <Toolbar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1" aria-label="Area di disegno">
            {view === "2d" ? <Plan2D /> : <Viewer3D />}
          </main>
          <PropertiesPanel />
        </div>
        <RightPanel extraTabs={[{ id: "catalog", label: "Catalogo", content: <CatalogPanel /> }]} />
      </div>
      <Dialogs />
      <Toast />
    </div>
  );
}
