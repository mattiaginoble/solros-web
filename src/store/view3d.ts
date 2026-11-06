import { create } from "zustand";

export type CameraMode = "orbit" | "walk" | "top";

export interface View3DState {
  mode: CameraMode;
  showCeilings: boolean;
  /** Mostra solo i piani fino a quello attivo (nasconde i piani superiori). */
  hideUpperFloors: boolean;
  setMode: (m: CameraMode) => void;
  toggleCeilings: () => void;
  toggleUpperFloors: () => void;
}

export const useView3D = create<View3DState>()((set) => ({
  mode: "orbit",
  showCeilings: false,
  hideUpperFloors: true,
  // In camminata i soffitti si vedono; dall'esterno vengono nascosti per guardare dentro.
  setMode: (mode) => set({ mode, showCeilings: mode === "walk" }),
  toggleCeilings: () => set((s) => ({ showCeilings: !s.showCeilings })),
  toggleUpperFloors: () => set((s) => ({ hideUpperFloors: !s.hideUpperFloors })),
}));
