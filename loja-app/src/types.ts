/**
 * Tipos do domínio — Firestore documents do projeto adegas-pf.
 * Estrutura espelhada do scripts/loja.js (state S).
 */

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  unit?: string;
  stock?: number;
  image?: string;
  images?: string[];
  art?: string;
  active?: boolean;
  description?: string;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  productId?: string;
  order?: number;
  active?: boolean;
  _type?: 'banner';
}

export interface Settings {
  lojaAddress?: string;
  address?: string;
  lojaWhatsApp?: string;
  phone?: string;
  deliveryFee?: number;
  deliveryTime?: string;
  storeName?: string;
  [key: string]: any;
}

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  unit: string;
  art: string;
  image: string;
  category: string;
  qty: number;
}

export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro';

export interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  number: string;
  complement: string;
  payment: PaymentMethod;
  notes: string;
}
