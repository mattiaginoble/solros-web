import { create } from "zustand";
import type { BBox } from "@/lib/geometry/polygon";
import type { Vec2 } from "@/lib/geometry/vec";
import { clamp } from "@/lib/geometry/vec";

/** Trasformazione della vista 2D: pixel = cm * scale + offset. */
export interface View2DState {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
  showGrid: boolean;
  showDimensions: boolean;
  setViewport: (w: number, h: number) => void;
  setView: (v: Partial<Pick<View2DState, "scale" | "x" | "y">>) => void;
  zoomAt: (pointer: Vec2, factor: number) => void;
  zoomBy: (factor: number) => void;
  fit: (box: BBox, padding?: number) => void;
  toggleGrid: () => void;
  toggleDimensions: () => void;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 8;

export const useView2D = create<View2DState>()((set, get) => ({
  scale: 0.8,
  x: 80,
  y: 80,
  width: 800,
  height: 600,
  showGrid: true,
  showDimensions: true,
  setViewport: (width, height) => set({ width, height }),
  setView: (v) => set(v),
  zoomAt: (pointer, factor) => {
    const { scale, x, y } = get();
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const world = { x: (pointer.x - x) / scale, y: (pointer.y - y) / scale };
    set({ scale: next, x: pointer.x - world.x * next, y: pointer.y - world.y * next });
  },
  zoomBy: (factor) => {
    const { width, height } = get();
    get().zoomAt({ x: width / 2, y: height / 2 }, factor);
  },
  fit: (box, padding = 80) => {
    const { width, height } = get();
    const w = Math.max(box.maxX - box.minX, 100);
    const h = Math.max(box.maxY - box.minY, 100);
    const scale = clamp(Math.min((width - padding * 2) / w, (height - padding * 2) / h), MIN_SCALE, 3);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    set({ scale, x: width / 2 - cx * scale, y: height / 2 - cy * scale });
  },
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
}));

/** Converte una posizione in pixel del contenitore in coordinate di piano (cm). */
export function screenToWorld(p: Vec2): Vec2 {
  const { scale, x, y } = useView2D.getState();
  return { x: (p.x - x) / scale, y: (p.y - y) / scale };
}

export function worldToScreen(p: Vec2): Vec2 {
  const { scale, x, y } = useView2D.getState();
  return { x: p.x * scale + x, y: p.y * scale + y };
}

/** Centro della vista in coordinate di piano. */
export function viewCenterWorld(): Vec2 {
  const { width, height } = useView2D.getState();
  return screenToWorld({ x: width / 2, y: height / 2 });
}
