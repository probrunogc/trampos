/**
 * Mesma lista do scripts/loja.js — portada para TS.
 * Os IDs precisam bater com o campo `category` dos produtos no Firestore.
 */
export interface Category {
  id: string;
  label: string;
  tagline: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'Cerveja',      label: 'Cervejas',      tagline: 'Gelada garantida',      emoji: '🍺', color: '#F5A623' },
  { id: 'Destilado',    label: 'Destilados',     tagline: 'Pra ocasião certa',     emoji: '🥃', color: '#8B5CF6' },
  { id: 'Energético',   label: 'Energéticos',    tagline: 'Liga o modo turbo',     emoji: '⚡', color: '#EF4444' },
  { id: 'Refrigerante', label: 'Refrigerantes',  tagline: 'Refrescante e gelado',  emoji: '🥤', color: '#06B6D4' },
  { id: 'Água',         label: 'Águas',          tagline: 'Hidratação na hora',    emoji: '💧', color: '#3B82F6' },
  { id: 'Vinho',        label: 'Vinhos',         tagline: 'Brinde especial',       emoji: '🍷', color: '#7C3AED' },
  { id: 'Gelo',         label: 'Gelo',           tagline: 'Deixa tudo mais frio',  emoji: '🧊', color: '#93C5FD' },
  { id: 'Carvão',       label: 'Carvão',         tagline: 'Churrasco perfeito',    emoji: '🔥', color: '#374151' },
  { id: 'Dose',         label: 'Doses',          tagline: 'Dose certa pra você',   emoji: '🍸', color: '#EC4899' },
  { id: 'Combo',        label: 'Combos',         tagline: 'Mais por menos',        emoji: '🎁', color: '#10B981' },
  { id: 'Conveniência', label: 'Conveniência',   tagline: 'Tudo que você precisa', emoji: '🛍️', color: '#F59E0B' },
  { id: 'Outros',       label: 'Outros',         tagline: 'Completa seu pedido',   emoji: '🛒', color: '#6B7280' },
];
