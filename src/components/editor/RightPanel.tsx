"use client";
import { useState, type ReactNode } from "react";
import { PlanPreview } from "@/components/ui/PlanPreview";
import { ROOM_TYPE_LABEL } from "@/domain/constants";
import { roomStats } from "@/domain/roomOps";
import { ROOM_TEMPLATES } from "@/domain/templates";
import { formatNumber } from "@/components/ui/controls";
import { addRoom, fitToRoom } from "@/store/actions";
import { activeFloor, useEditor } from "@/store/editor";

export type RightTab = "rooms" | "templates";

export function RightPanel({ extraTabs }: { extraTabs?: { id: string; label: string; content: ReactNode }[] }) {
  const tabs = [
    ...(extraTabs ?? []),
    { id: "rooms", label: "Stanze", content: <RoomsList /> },
    { id: "templates", label: "Modelli", content: <TemplatesList /> },
  ];
  const [tab, setTab] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-line bg-panel max-lg:w-[280px]" aria-label="Pannello laterale">
      <div role="tablist" className="flex gap-1 border-b border-line px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === current.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-[5px] border px-3 py-2 text-[13px] font-medium ${
              t.id === current.id
                ? "border-line border-b-panel bg-panel text-graphite"
                : "border-transparent text-muted hover:text-graphite"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{current.content}</div>
    </aside>
  );
}

function RoomsList() {
  const house = useEditor((s) => s.house);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const focusRoom = useEditor((s) => s.focusRoom);
  const floor = activeFloor({ house, activeFloorId });
  if (floor.rooms.length === 0)
    return <p className="p-4 text-sm text-muted">Nessuna stanza su questo piano. Disegnane una o aggiungi un modello.</p>;
  const total = floor.rooms.reduce((a, r) => a + roomStats(r).areaM2, 0);
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col p-2">
        {floor.rooms.map((r) => {
          const active = selection?.roomId === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => select({ kind: "room", roomId: r.id })}
                onDoubleClick={() => {
                  focusRoom(r.id);
                  fitToRoom(r.id);
                }}
                className={`flex w-full items-center gap-3 rounded-[5px] px-2 py-2 text-left ${active ? "bg-prussian-tint" : "hover:bg-panel-sunk"}`}
              >
                <span className="h-7 w-7 shrink-0 rounded-[3px] border border-line-strong" style={{ background: r.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">{ROOM_TYPE_LABEL[r.type]}</span>
                </span>
                <span className="text-sm tabular-nums text-graphite-soft">{formatNumber(roomStats(r).areaM2, 1)} m²</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex justify-between border-t border-line px-4 py-3 text-sm">
        <span className="text-muted">Totale netto</span>
        <span className="font-semibold tabular-nums">{formatNumber(total, 1)} m²</span>
      </div>
    </div>
  );
}

export function TemplatesList({ onPicked }: { onPicked?: () => void }) {
  const readOnly = useEditor((s) => s.readOnly);
  return (
    <ul className="grid grid-cols-2 gap-2 p-3">
      {ROOM_TEMPLATES.map((t) => {
        const room = t.build();
        return (
          <li key={t.id}>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => {
                addRoom(t.build(), { place: "auto" });
                onPicked?.();
              }}
              className="flex w-full flex-col gap-1.5 rounded-[6px] border border-line p-2 text-left hover:border-prussian disabled:opacity-50"
            >
              <span className="paper-grid flex h-20 items-center justify-center rounded-[3px] border border-line">
                <PlanPreview shapes={[{ points: room.polygon, color: room.color }]} className="h-16 w-full" wall={10} />
              </span>
              <span className="text-[13px] font-medium leading-tight">{t.name}</span>
              <span className="text-[11px] leading-tight text-muted">{t.description}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
