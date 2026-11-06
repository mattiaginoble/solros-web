"use client";
import type { ReactNode } from "react";
import { OPENING_DND_TYPE } from "@/components/editor2d/dnd";
import { IconDoor, IconDraw, IconPassage, IconRect, IconSelect, IconTemplate, IconWindow } from "@/components/ui/icons";
import { useEditor, type Tool } from "@/store/editor";

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
  dragKind,
  disabled,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  dragKind?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      draggable={!!dragKind && !disabled}
      onDragStart={(e) => {
        if (!dragKind) return;
        e.dataTransfer.setData(OPENING_DND_TYPE, dragKind);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onClick}
      className={`group flex w-full flex-col items-center gap-0.5 rounded-[6px] border px-1 py-1.5 text-[11px] leading-tight transition-colors disabled:opacity-40 ${
        active
          ? "border-prussian bg-prussian-tint text-prussian"
          : "border-transparent text-graphite-soft hover:bg-panel-sunk hover:text-graphite"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const openDialog = useEditor((s) => s.openDialog);
  const readOnly = useEditor((s) => s.readOnly);
  const view = useEditor((s) => s.view);
  const toggle = (t: Tool) => setTool(tool === t ? "select" : t);
  const disabled = readOnly || view === "3d";

  return (
    <nav
      aria-label="Strumenti"
      className="flex w-[68px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-panel px-1.5 py-2"
    >
      <ToolButton label="Seleziona" shortcut="V" active={tool === "select"} onClick={() => setTool("select")}>
        <IconSelect />
      </ToolButton>
      <ToolButton label="Disegna" shortcut="D" active={tool === "draw"} onClick={() => toggle("draw")} disabled={disabled}>
        <IconDraw />
      </ToolButton>
      <ToolButton label="Rettangolo" onClick={() => openDialog("rect")} disabled={disabled}>
        <IconRect />
      </ToolButton>
      <ToolButton label="Modelli" onClick={() => openDialog("templates")} disabled={disabled}>
        <IconTemplate />
      </ToolButton>
      <div className="mx-2 my-1 h-px bg-line" />
      <ToolButton label="Porta" shortcut="P" active={tool === "door"} onClick={() => toggle("door")} dragKind="door" disabled={disabled}>
        <IconDoor />
      </ToolButton>
      <ToolButton label="Finestra" shortcut="F" active={tool === "window"} onClick={() => toggle("window")} dragKind="window" disabled={disabled}>
        <IconWindow />
      </ToolButton>
      <ToolButton label="Passaggio" active={tool === "passage"} onClick={() => toggle("passage")} dragKind="passage" disabled={disabled}>
        <IconPassage />
      </ToolButton>
    </nav>
  );
}
