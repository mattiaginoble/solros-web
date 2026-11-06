import { create } from "zustand";

/** Contatore incrementato quando il catalogo cambia (import, nuovi prodotti): il pannello ricarica i risultati. */
export const useCatalogVersion = create<{ version: number; bump: () => void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
