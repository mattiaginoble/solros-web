"use client";
import { useEffect, useRef, useState } from "react";
import { IconLayers, IconPlus } from "@/components/ui/icons";
import { addFloor, fitToFloor } from "@/store/actions";
import { useEditor } from "@/store/editor";

/** Selettore del piano attivo, con aggiunta di piani sopra e sotto. */
export function FloorSelector() {
  const floors = useEditor((s) => s.house.floors);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const setActiveFloor = useEditor((s) => s.setActiveFloor);
  const readOnly = useEditor((s) => s.readOnly);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = floors.find((f) => f.id === activeFloorId) ?? floors[0];
  const sorted = [...floors].sort((a, b) => b.level - a.level);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-[5px] border border-line-strong px-2.5 text-[13px] font-medium hover:border-graphite-soft"
        title="Piani della casa"
      >
        <IconLayers size={17} />
        <span className="max-w-28 truncate">{active.name}</span>
        {floors.length > 1 && <span className="text-xs text-muted">{floors.length}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-60 rounded-[6px] border border-line-strong bg-panel p-1 shadow-[0_12px_30px_-12px_rgba(35,39,43,0.4)]">
          {sorted.map((f) => (
            <button
              key={f.id}
              role="menuitemradio"
              aria-checked={f.id === active.id}
              type="button"
              onClick={() => {
                setActiveFloor(f.id);
                setOpen(false);
                requestAnimationFrame(() => fitToFloor());
              }}
              className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-2 text-left text-sm ${
                f.id === active.id ? "bg-prussian-tint text-prussian" : "hover:bg-panel-sunk"
              }`}
            >
              <span>{f.name}</span>
              <span className="text-xs text-muted">
                {f.rooms.length} {f.rooms.length === 1 ? "stanza" : "stanze"}
              </span>
            </button>
          ))}
          {!readOnly && (
            <>
              <div className="my-1 h-px bg-line" />
              <button type="button" role="menuitem" onClick={() => { addFloor("above"); setOpen(false); }} className="flex w-full items-center gap-2 rounded-[4px] px-2.5 py-2 text-left text-sm hover:bg-panel-sunk">
                <IconPlus size={16} /> Aggiungi piano sopra
              </button>
              <button type="button" role="menuitem" onClick={() => { addFloor("below"); setOpen(false); }} className="flex w-full items-center gap-2 rounded-[4px] px-2.5 py-2 text-left text-sm hover:bg-panel-sunk">
                <IconPlus size={16} /> Aggiungi piano sotto
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
