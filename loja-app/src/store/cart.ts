/**
 * Store do carrinho — persistido via AsyncStorage.
 * Equivalente a S.cart + load/saveCart() do loja.js.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Product } from '../types';
import { firstProductImage } from '../utils/format';

interface CartState {
  items: CartItem[];
  add: (p: Product, qty?: number) => void;
  remove: (pid: string) => void;
  setQty: (pid: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (p, qty = 1) => {
        const items = [...get().items];
        const existing = items.find((i) => i.id === p.id);
        if (existing) {
          existing.qty += qty;
        } else {
          items.push({
            id: p.id,
            name: p.name,
            brand: p.brand || '',
            price: p.price,
            unit: p.unit || 'un',
            art: p.art || '',
            image: firstProductImage(p) || '',
            category: p.category || '',
            qty,
          });
        }
        set({ items });
      },

      remove: (pid) => set({ items: get().items.filter((i) => i.id !== pid) }),

      setQty: (pid, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.id !== pid) });
          return;
        }
        const items = get().items.map((i) => (i.id === pid ? { ...i, qty } : i));
        set({ items });
      },

      clear: () => set({ items: [] }),

      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      total: () => get().items.reduce((n, i) => n + i.price * i.qty, 0),
    }),
    {
      name: 'eg:cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
