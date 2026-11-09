"use client";
/**
 * Carrello nel browser (localStorage): resta sul dispositivo anche senza
 * server, quindi funziona pure nella versione statica.
 */
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Product } from "@/domain/schema";
import { addItems, type CartItem } from "@/lib/cart/cart";

interface CartState {
  items: CartItem[];
  add: (product: Product, quantity?: number) => void;
  addMany: (items: CartItem[]) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, quantity = 1) => set((s) => ({ items: addItems(s.items, [{ product, quantity }]) })),
      addMany: (added) => set((s) => ({ items: addItems(s.items, added) })),
      setQuantity: (productId, quantity) =>
        set((s) => ({
          items: s.items
            .map((it) => (it.product.id === productId ? { ...it, quantity: Math.max(0, Math.min(999, Math.round(quantity))) } : it))
            .filter((it) => it.quantity > 0),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((it) => it.product.id !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "configuratore-carrello",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Ripristino dopo il montaggio: evita differenze con l'HTML generato dal server.
      skipHydration: true,
    },
  ),
);

/** Vero quando il carrello salvato è stato caricato dal browser. */
export function useCartHydrated(): boolean {
  useEffect(() => {
    if (!useCart.persist.hasHydrated()) void useCart.persist.rehydrate();
  }, []);
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}

/** Numero di pezzi nel carrello (0 finché non è caricato). */
export function useCartCount(): number {
  const hydrated = useCartHydrated();
  const count = useCart((s) => s.items.reduce((n, it) => n + it.quantity, 0));
  return hydrated ? count : 0;
}

/**
 * Modifica il carrello dopo averlo caricato dal browser: senza questa attesa
 * un'aggiunta fatta prima del caricamento sovrascriverebbe il carrello salvato.
 */
export async function updateCart(fn: (state: CartState) => void): Promise<void> {
  if (!useCart.persist.hasHydrated()) await useCart.persist.rehydrate();
  fn(useCart.getState());
}
