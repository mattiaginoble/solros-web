/**
 * Stato dell'editor (Zustand).
 *
 * - `house` è il documento immutabile; ogni modifica passa da `apply` (ricette
 *   Immer) o `updateRoom` (funzioni pure) e finisce nella cronologia undo/redo.
 * - Le interazioni continue (trascinamenti) aprono una transazione con `begin()`
 *   e la chiudono con `commit()`: l'intero gesto diventa un solo passo di undo.
 * - Selezione, strumento, modalità e vista non fanno parte della cronologia.
 */
import { create } from "zustand";
import { produce } from "immer";
import type { Floor, House, Room } from "@/domain/schema";
import { createHouse } from "@/domain/factory";

export type Selection =
  | { kind: "room"; roomId: string }
  | { kind: "wall"; roomId: string; wallId: string }
  | { kind: "vertex"; roomId: string; index: number }
  | { kind: "opening"; roomId: string; openingId: string }
  | { kind: "item"; roomId: string; itemId: string }
  | null;

export type Tool = "select" | "draw" | "door" | "window" | "passage" | "calibrate";
export type EditorMode = "house" | "room";
export type ViewKind = "2d" | "3d";
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type DialogKind =
  | null
  | "rect"
  | "templates"
  | "import"
  | "quote"
  | "kitchen"
  | "project"
  | "share"
  | "help";

const HISTORY_LIMIT = 150;

export interface EditorState {
  projectId: string | null;
  readOnly: boolean;
  house: House;
  past: House[];
  future: House[];
  txBase: House | null;
  /** Incrementato a ogni modifica del documento (per l'autosalvataggio). */
  revision: number;

  activeFloorId: string;
  mode: EditorMode;
  focusedRoomId: string | null;
  selection: Selection;
  tool: Tool;
  view: ViewKind;
  dialog: DialogKind;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  notice: { id: number; text: string; tone: "info" | "warning" | "error" } | null;

  load: (house: House, opts?: { projectId?: string | null; readOnly?: boolean }) => void;
  /** Applica una ricetta Immer; se la ricetta restituisce una casa, sostituisce il documento. */
  apply: (recipe: (draft: House) => void | House) => void;
  updateRoom: (roomId: string, fn: (room: Room) => Room) => void;
  begin: () => void;
  commit: () => void;
  cancel: () => void;
  undo: () => void;
  redo: () => void;

  select: (sel: Selection) => void;
  setTool: (tool: Tool) => void;
  setMode: (mode: EditorMode) => void;
  focusRoom: (roomId: string | null) => void;
  setView: (view: ViewKind) => void;
  setActiveFloor: (floorId: string) => void;
  openDialog: (d: DialogKind) => void;
  setSaveStatus: (s: SaveStatus, at?: number) => void;
  notify: (text: string, tone?: "info" | "warning" | "error") => void;
}

let noticeSeq = 0;

export const useEditor = create<EditorState>()((set, get) => {
  const initial = createHouse();
  return {
    projectId: null,
    readOnly: false,
    house: initial,
    past: [],
    future: [],
    txBase: null,
    revision: 0,
    activeFloorId: initial.floors[0].id,
    mode: "house",
    focusedRoomId: null,
    selection: null,
    tool: "select",
    view: "2d",
    dialog: null,
    saveStatus: "idle",
    lastSavedAt: null,
    notice: null,

    load: (house, opts = {}) =>
      set({
        house,
        projectId: opts.projectId ?? null,
        readOnly: opts.readOnly ?? false,
        past: [],
        future: [],
        txBase: null,
        revision: 0,
        activeFloorId: house.floors[0]?.id ?? "",
        mode: "house",
        focusedRoomId: null,
        selection: null,
        tool: "select",
        saveStatus: "saved",
      }),

    apply: (recipe) => {
      const { house, txBase, readOnly } = get();
      if (readOnly) return;
      const next = produce(house, recipe as (draft: House) => House);
      if (next === house) return;
      if (txBase) {
        set((s) => ({ house: next, revision: s.revision + 1 }));
        return;
      }
      set((s) => ({
        house: next,
        past: [...s.past.slice(-HISTORY_LIMIT + 1), house],
        future: [],
        revision: s.revision + 1,
      }));
    },

    updateRoom: (roomId, fn) => {
      const loc = findRoom(get().house, roomId);
      if (!loc) return;
      const updated = fn(loc.room);
      if (updated === loc.room) return;
      get().apply((h) => {
        h.floors[loc.floorIndex].rooms[loc.roomIndex] = updated;
      });
    },

    begin: () => {
      if (!get().txBase) set({ txBase: get().house });
    },
    commit: () => {
      const { txBase, house } = get();
      if (!txBase) return;
      if (txBase === house) {
        set({ txBase: null });
        return;
      }
      set((s) => ({ txBase: null, past: [...s.past.slice(-HISTORY_LIMIT + 1), txBase], future: [] }));
    },
    cancel: () => {
      const { txBase } = get();
      if (!txBase) return;
      set((s) => ({ house: txBase, txBase: null, revision: s.revision + 1 }));
    },

    undo: () => {
      const { past, house, future, txBase } = get();
      if (txBase || past.length === 0) return;
      const prev = past[past.length - 1];
      set((s) => ({
        house: prev,
        past: past.slice(0, -1),
        future: [house, ...future].slice(0, HISTORY_LIMIT),
        revision: s.revision + 1,
      }));
      sanitizeSelection();
    },
    redo: () => {
      const { past, house, future, txBase } = get();
      if (txBase || future.length === 0) return;
      const next = future[0];
      set((s) => ({
        house: next,
        past: [...past, house].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        revision: s.revision + 1,
      }));
      sanitizeSelection();
    },

    select: (selection) => set({ selection }),
    setTool: (tool) => set({ tool }),
    setMode: (mode) => {
      if (mode === "house") set({ mode, focusedRoomId: null });
      else {
        const sel = get().selection;
        const roomId = sel && "roomId" in sel ? sel.roomId : (activeFloor(get())?.rooms[0]?.id ?? null);
        set({ mode: roomId ? "room" : "house", focusedRoomId: roomId, selection: roomId ? sel ?? { kind: "room", roomId } : null });
      }
    },
    focusRoom: (roomId) =>
      set(
        roomId
          ? { mode: "room", focusedRoomId: roomId, selection: { kind: "room", roomId } }
          : { mode: "house", focusedRoomId: null },
      ),
    setView: (view) => set({ view }),
    setActiveFloor: (activeFloorId) =>
      set({ activeFloorId, selection: null, focusedRoomId: null, mode: "house" }),
    openDialog: (dialog) => set({ dialog }),
    setSaveStatus: (saveStatus, at) => set(at ? { saveStatus, lastSavedAt: at } : { saveStatus }),
    notify: (text, tone = "info") => set({ notice: { id: ++noticeSeq, text, tone } }),
  };
});

export interface RoomLocation {
  floor: Floor;
  floorIndex: number;
  room: Room;
  roomIndex: number;
}

export function findRoom(house: House, roomId: string): RoomLocation | null {
  for (let fi = 0; fi < house.floors.length; fi++) {
    const floor = house.floors[fi];
    const ri = floor.rooms.findIndex((r) => r.id === roomId);
    if (ri >= 0) return { floor, floorIndex: fi, room: floor.rooms[ri], roomIndex: ri };
  }
  return null;
}

export function activeFloor(s: Pick<EditorState, "house" | "activeFloorId">): Floor {
  return s.house.floors.find((f) => f.id === s.activeFloorId) ?? s.house.floors[0];
}

/** Dopo undo/redo rimuove la selezione se l'elemento non esiste più. */
function sanitizeSelection() {
  const s = useEditor.getState();
  const fix: Partial<EditorState> = {};
  if (!s.house.floors.some((f) => f.id === s.activeFloorId)) fix.activeFloorId = s.house.floors[0].id;
  const sel = s.selection;
  if (sel) {
    const loc = findRoom(s.house, sel.roomId);
    let ok = !!loc;
    if (loc && sel.kind === "wall") ok = loc.room.walls.some((w) => w.id === sel.wallId);
    if (loc && sel.kind === "vertex") ok = sel.index < loc.room.polygon.length;
    if (loc && sel.kind === "opening") ok = loc.room.openings.some((o) => o.id === sel.openingId);
    if (loc && sel.kind === "item") ok = loc.room.items.some((i) => i.id === sel.itemId);
    if (!ok) fix.selection = null;
  }
  if (s.focusedRoomId && !findRoom(s.house, s.focusedRoomId)) {
    fix.focusedRoomId = null;
    fix.mode = "house";
  }
  if (Object.keys(fix).length) useEditor.setState(fix);
}

/** Hook di comodo: piano attivo. */
export const useActiveFloor = () => useEditor((s) => activeFloor(s));
