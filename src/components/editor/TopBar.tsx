"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatTotals, quoteForHouse } from "@/lib/pricing/quote";
import { IconButton, Segmented } from "@/components/ui/controls";
import { IconCube, IconHelp, IconHome, IconPlan, IconReceipt, IconRedo, IconUndo } from "@/components/ui/icons";
import { fitToFloor, fitToRoom } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { saveNow } from "@/store/persistence";
import { FloorSelector } from "./FloorSelector";
import { ProjectMenu } from "./ProjectMenu";

function SaveStatus() {
  const status = useEditor((s) => s.saveStatus);
  const readOnly = useEditor((s) => s.readOnly);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (readOnly) return <span className="text-xs text-muted">Sola lettura</span>;
  const label =
    status === "saving"
      ? "Salvataggio…"
      : status === "dirty"
        ? "Modifiche non salvate"
        : status === "error"
          ? "Non salvato: riprova"
          : lastSavedAt
            ? `Salvato alle ${new Date(lastSavedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
            : "Salvato";
  return (
    <button
      type="button"
      onClick={() => void saveNow()}
      title="Salva ora (Ctrl+S)"
      className={`hidden rounded px-1.5 text-xs md:inline ${status === "error" ? "text-danger underline" : "text-muted hover:text-graphite"}`}
    >
      {label}
    </button>
  );
}

function ProjectName() {
  const name = useEditor((s) => s.house.name);
  const readOnly = useEditor((s) => s.readOnly);
  const apply = useEditor((s) => s.apply);
  const [text, setText] = useState(name);
  const [prev, setPrev] = useState(name);
  if (prev !== name) {
    setPrev(name);
    setText(name);
  }
  return (
    <input
      aria-label="Nome del progetto"
      value={text}
      readOnly={readOnly}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== name)
          apply((h) => {
            h.name = t.slice(0, 120);
          });
        else setText(name);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setText(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-40 min-w-0 truncate rounded-[4px] border border-transparent bg-transparent px-1.5 text-[15px] font-semibold outline-none hover:border-line focus:border-prussian sm:w-56"
    />
  );
}

function QuoteButton() {
  const house = useEditor((s) => s.house);
  const openDialog = useEditor((s) => s.openDialog);
  const quote = useMemo(() => quoteForHouse(house), [house]);
  return (
    <button
      type="button"
      onClick={() => openDialog("quote")}
      title="Apri il preventivo"
      className="flex h-9 items-center gap-1.5 rounded-[5px] border border-line-strong px-2.5 text-sm hover:border-graphite-soft"
    >
      <IconReceipt size={17} />
      <span className="font-semibold tabular-nums">{formatTotals(quote.totals, house.settings.currency)}</span>
    </button>
  );
}

export function TopBar({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const mode = useEditor((s) => s.mode);
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const setMode = useEditor((s) => s.setMode);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const openDialog = useEditor((s) => s.openDialog);
  const readOnly = useEditor((s) => s.readOnly);

  return (
    <header className="flex h-14 items-center gap-2 border-b border-line bg-panel px-2 sm:gap-3 sm:px-3">
      <Link
        href="/"
        className="flex h-9 items-center gap-2 rounded-[5px] px-1.5 text-graphite hover:bg-panel-sunk"
        title="Torna ai progetti"
      >
        <IconHome size={20} />
        <span className="hidden text-sm font-semibold lg:inline">Configuratore Casa</span>
      </Link>
      <span className="hidden h-6 w-px bg-line sm:block" />
      <ProjectName />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <FloorSelector />
        <Segmented
          label="Vista di lavoro"
          value={mode}
          onChange={(m) => {
            setMode(m);
            const s = useEditor.getState();
            if (m === "room" && s.focusedRoomId) fitToRoom(s.focusedRoomId);
            if (m === "house") fitToFloor();
          }}
          options={[
            { value: "house", label: "Casa", title: "Componi le stanze della casa" },
            { value: "room", label: "Stanza", title: "Modifica forma, muri e aperture della stanza selezionata" },
          ]}
        />
        <Segmented
          label="Tipo di vista"
          value={view}
          onChange={setView}
          options={[
            { value: "2d", label: "2D", icon: <IconPlan size={16} /> },
            { value: "3d", label: "3D", icon: <IconCube size={16} /> },
          ]}
        />
      </div>
      <div className="flex items-center gap-1">
        {!readOnly && (
          <>
            <IconButton label="Annulla (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
              <IconUndo size={18} />
            </IconButton>
            <IconButton label="Ripeti (Ctrl+Maiusc+Z)" disabled={!canRedo} onClick={redo}>
              <IconRedo size={18} />
            </IconButton>
          </>
        )}
        <SaveStatus />
        <QuoteButton />
        <ProjectMenu />
        {rightSlot}
        <IconButton label="Scorciatoie e aiuto" onClick={() => openDialog("help")}>
          <IconHelp size={18} />
        </IconButton>
      </div>
    </header>
  );
}
