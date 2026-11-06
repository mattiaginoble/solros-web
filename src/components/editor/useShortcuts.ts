"use client";
import { useEffect } from "react";
import { deleteSelection, duplicateSelection, fitToFloor, fitToRoom, nudgeSelection, rotateSelection } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { saveNow } from "@/store/persistence";
import { useView2D } from "@/store/view2d";

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

/**
 * Scorciatoie da tastiera dell'editor.
 * Canc/Backspace elimina, Ctrl+Z/Ctrl+Maiusc+Z annulla e ripete, R ruota,
 * Ctrl+D duplica, frecce spostano, Esc esce dallo strumento o dalla stanza.
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = useEditor.getState();
      if (s.dialog) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (mod) return;
      // In 3D lettere e frecce servono alla navigazione (camminata): niente scorciatoie di disegno.
      const in3d = s.view === "3d";
      if (in3d && (e.key.startsWith("Arrow") || ["w", "a", "s", "d", "v", "p", "f"].includes(key))) return;

      switch (e.key) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelection();
          return;
        case "Escape":
          if (s.tool !== "select") s.setTool("select");
          else if (s.selection && s.selection.kind !== "room") s.select({ kind: "room", roomId: s.selection.roomId });
          else if (s.mode === "room") s.focusRoom(null);
          else s.select(null);
          return;
        case "Enter":
          if (s.selection?.kind === "room" && s.mode === "house") {
            s.focusRoom(s.selection.roomId);
            fitToRoom(s.selection.roomId);
          }
          return;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          if (!s.selection) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          nudgeSelection(dx, dy);
          return;
        }
        case "+":
        case "=":
          useView2D.getState().zoomBy(1.25);
          return;
        case "-":
          useView2D.getState().zoomBy(1 / 1.25);
          return;
        case "0":
          if (s.tool !== "draw") fitToFloor();
          return;
      }

      switch (key) {
        case "r":
          rotateSelection(e.altKey ? (e.shiftKey ? -15 : 15) : e.shiftKey ? -90 : 90);
          return;
        case "v":
          s.setTool("select");
          return;
        case "d":
          if (!s.readOnly) s.setTool("draw");
          return;
        case "p":
          if (!s.readOnly) s.setTool("door");
          return;
        case "f":
          if (!s.readOnly) s.setTool("window");
          return;
        case "?":
          s.openDialog("help");
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
