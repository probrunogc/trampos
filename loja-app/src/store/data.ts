/**
 * Store de dados do Firestore — produtos, banners, settings.
 * Equivalente a S.products, S.banners, S.settings do loja.js.
 */
import { create } from 'zustand';
import {
  collection, query, orderBy, where, getDocs, getDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Product, Banner, Settings } from '../types';

interface DataState {
  products: Product[];
  banners: Banner[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  loadAll: () => Promise<void>;
}

export const useData = create<DataState>((set) => ({
  products: [],
  banners: [],
  settings: {},
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const [productsSnap, bannersSnap, settingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('name'))),
        getDocs(query(collection(db, 'settings'), where('_type', '==', 'banner'))),
        getDoc(doc(db, 'settings', 'company')),
      ]);

      const products = productsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Product)
        .filter((p) => p.active !== false);

      const banners = bannersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Banner)
        .filter((b) => b.active !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const settings = (settingsSnap.exists() ? settingsSnap.data() : {}) as Settings;

      set({ products, banners, settings, loading: false });
    } catch (e: any) {
      console.error('loadAll:', e);
      set({ error: e?.message || 'Erro ao carregar dados', loading: false });
    }
  },
}));
