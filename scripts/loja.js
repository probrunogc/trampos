/**
 * Empório GO — Loja Online
 * SPA de delivery com Firebase Firestore + WhatsApp checkout
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore, collection, getDocs, query, orderBy, where,
  addDoc, serverTimestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { productImage } from './product-art.js';

/* ─── Firebase ─────────────────────────────────────────────── */
const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

/* ─── Categories definition ─────────────────────────────────── */
const CATS = [
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

const ICON_COMPACT = `<svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><rect x="1" y="1" width="3.5" height="3.5" rx=".6"/><rect x="6.25" y="1" width="3.5" height="3.5" rx=".6"/><rect x="11.5" y="1" width="3.5" height="3.5" rx=".6"/><rect x="1" y="6.25" width="3.5" height="3.5" rx=".6"/><rect x="6.25" y="6.25" width="3.5" height="3.5" rx=".6"/><rect x="11.5" y="6.25" width="3.5" height="3.5" rx=".6"/><rect x="1" y="11.5" width="3.5" height="3.5" rx=".6"/><rect x="6.25" y="11.5" width="3.5" height="3.5" rx=".6"/><rect x="11.5" y="11.5" width="3.5" height="3.5" rx=".6"/></svg>`;
const ICON_EXPAND  = `<svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><rect x="1" y="1" width="6.5" height="6.5" rx="1"/><rect x="8.5" y="1" width="6.5" height="6.5" rx="1"/><rect x="1" y="8.5" width="6.5" height="6.5" rx="1"/><rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1"/></svg>`;

function catThumb(catId) {
  const prod = S.products.find(p => p.category === catId && p.image);
  if (prod?.image) return `<img src="${esc(prod.image)}" alt="" loading="lazy" />`;
  const cat = CATS.find(c => c.id === catId);
  return `<span class="cat-thumb-letter" style="background:${cat?.color || '#8B5CF6'}">${(catId[0] || '?').toUpperCase()}</span>`;
}

function buildFilters(catId, prods) {
  const fs = [{ id: 'all', label: 'Todos' }];
  if (catId === 'Cerveja') {
    if (prods.some(p => /lata/i.test(p.name)))               fs.push({ id: 'lata',    label: 'Latas' });
    if (prods.some(p => /garrafa|long.?neck/i.test(p.name))) fs.push({ id: 'garrafa', label: 'Garrafas' });
  } else {
    const brands = [...new Set(prods.map(p => p.brand).filter(Boolean))];
    if (brands.length > 1 && brands.length <= 4)
      brands.forEach(b => fs.push({ id: b.toLowerCase().replace(/[^a-z0-9]/g, ''), label: b }));
  }
  return fs.length > 1 ? fs : [];
}

/* ─── App state ──────────────────────────────────────────────── */
const S = {
  products:  [],
  banners:   [],
  settings:  {},
  cart:      [],
  view:      'home',
  viewParams:{},
  navStack:  [],
  qty:       1,
  checkout: {
    name: '', phone: '', address: '',
    number: '', complement: '', payment: 'pix', notes: ''
  },
  customer:    {},
  orders:      [],
  lastOrderId: null,
  layout: parseInt(localStorage.getItem('eg:layout') || '2', 10),
  imgTimer: null,
};

/* ─── Cart helpers ───────────────────────────────────────────── */
function loadCart() {
  try { S.cart = JSON.parse(localStorage.getItem('eg:cart') || '[]'); }
  catch { S.cart = []; }
}
function saveCart() { localStorage.setItem('eg:cart', JSON.stringify(S.cart)); }

function loadCustomer() {
  try { S.customer = JSON.parse(localStorage.getItem('eg:customer') || 'null') || {}; }
  catch { S.customer = {}; }
  // Pre-fill checkout with saved customer data
  const c = S.customer;
  if (c.name)       S.checkout.name       = c.name;
  if (c.phone)      S.checkout.phone      = c.phone;
  if (c.address)    S.checkout.address    = c.address;
  if (c.number)     S.checkout.number     = c.number;
  if (c.complement) S.checkout.complement = c.complement;
}
function saveCustomer(d) {
  S.customer = { name: d.name, phone: d.phone, address: d.address, number: d.number || '', complement: d.complement || '' };
  localStorage.setItem('eg:customer', JSON.stringify(S.customer));
}

function loadOrders() {
  try { S.orders = JSON.parse(localStorage.getItem('eg:orders') || '[]'); }
  catch { S.orders = []; }
}
function saveLocalOrder(o) {
  S.orders.unshift({ ...o, id: Date.now().toString(36), date: new Date().toISOString() });
  S.orders = S.orders.slice(0, 30);
  localStorage.setItem('eg:orders', JSON.stringify(S.orders));
}

function formatOrderDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
const PAY_LABELS = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro' };
function cartCount() { return S.cart.reduce((n, i) => n + i.qty, 0); }
function cartTotal() { return S.cart.reduce((n, i) => n + i.price * i.qty, 0); }

function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images.filter(Boolean);
  if (p.image) return [p.image];
  return [];
}

function addToCart(product, qty = 1) {
  const existing = S.cart.find(i => i.id === product.id);
  if (existing) { existing.qty += qty; }
  else {
    const imgs = getProductImages(product);
    S.cart.push({
      id:    product.id,
      name:  product.name,
      brand: product.brand  || '',
      price: product.price,
      unit:  product.unit   || 'un',
      art:   product.art    || '',
      image: imgs[0]        || '',
      category: product.category || '',
      qty,
    });
  }
  saveCart();
  updateCartBadge();
}

function removeFromCart(pid) {
  S.cart = S.cart.filter(i => i.id !== pid);
  saveCart();
  updateCartBadge();
}

function setCartQty(pid, qty) {
  if (qty <= 0) { removeFromCart(pid); return; }
  const item = S.cart.find(i => i.id === pid);
  if (item) { item.qty = qty; saveCart(); updateCartBadge(); }
}

function updateCartBadge() {
  const badge = document.getElementById('nav-cart-badge');
  if (!badge) return;
  const n = cartCount();
  badge.textContent = n;
  badge.style.display = n > 0 ? '' : 'none';
}

/* ─── Formatting ─────────────────────────────────────────────── */
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ─── Data loading ───────────────────────────────────────────── */
async function loadProducts() {
  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    S.products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.active !== false);
  } catch (e) {
    console.error('loadProducts:', e);
    S.products = [];
  }
}

async function loadBanners() {
  try {
    const snap = await getDocs(query(
      collection(db, 'settings'),
      where('_type', '==', 'banner')
    ));
    S.banners = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch { S.banners = []; }
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'company'));
    S.settings = snap.exists() ? snap.data() : {};
  } catch { S.settings = {}; }
}

async function createOrder(data) {
  const ref = await addDoc(collection(db, 'orders'), {
    ...data,
    status:    'novo',
    channel:   'loja',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/* ─── WhatsApp ───────────────────────────────────────────────── */
function getWAPhone() {
  return (S.settings.lojaWhatsApp || S.settings.phone || '92991392485').replace(/\D/g, '');
}

/* Mensagem rápida do carrinho — sem dados do cliente (ele informa no chat) */
function buildCartMessage() {
  const fee   = S.settings.deliveryFee || 0;
  const total = cartTotal() + fee;
  const items = S.cart.map(i => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`).join('\n');
  let msg = `*Pedido — Empório GO* 🍺\n\n`;
  msg += `*Itens:*\n${items}\n\n`;
  if (fee > 0) msg += `Taxa de entrega: ${brl(fee)}\n`;
  msg += `*Total: ${brl(total)}*\n\n`;
  msg += `Olá! Gostaria de fazer este pedido. Pode confirmar disponibilidade e me passar o endereço de entrega? 😊`;
  return msg;
}

/* Mensagem completa após checkout com dados do cliente */
function buildOrderMessage() {
  const d = S.checkout;
  const fee = S.settings.deliveryFee || 0;
  const total = cartTotal() + fee;
  const payLabel = { pix:'PIX', credito:'Cartão de Crédito', debito:'Cartão de Débito', dinheiro:'Dinheiro' };
  const items = S.cart.map(i => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`).join('\n');

  let msg = `*Pedido — Empório GO* 🍺\n\n`;
  msg += `*Itens:*\n${items}\n\n`;
  if (fee > 0) msg += `Entrega: ${brl(fee)}\n`;
  msg += `*Total: ${brl(total)}*\n\n`;
  msg += `*Dados do cliente:*\n`;
  msg += `Nome: ${d.name}\n`;
  msg += `WhatsApp: ${d.phone}\n`;
  msg += `Endereço: ${d.address}${d.number ? ', nº ' + d.number : ''}`;
  if (d.complement) msg += ` (${d.complement})`;
  msg += `\nPagamento: ${payLabel[d.payment] || d.payment}`;
  if (d.notes) msg += `\nObs: ${d.notes}`;
  return msg;
}

function openWhatsApp(message) {
  const phone = getWAPhone();
  if (!phone) {
    alert('Número de WhatsApp não configurado ainda. Tente novamente mais tarde.');
    return;
  }
  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

/* ─── Image shimmer while loading ───────────────────────────── */
function shimmerImages(container) {
  container.querySelectorAll('.banner-art img, .product-card-img img, .cat-chip-icon img, .pd-img-section img').forEach(img => {
    if (img.complete && img.naturalWidth) return;

    const imgWrap = img.closest('.banner-art, .product-card-img, .cat-chip-icon, .pd-img-section');

    img.style.opacity = '0';
    img.style.transition = 'opacity .3s';
    if (imgWrap) imgWrap.classList.add('img-loading');

    const done = () => {
      img.style.opacity = '1';
      if (imgWrap) imgWrap.classList.remove('img-loading');
    };
    img.addEventListener('load',  done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

/* ─── Page cache ─────────────────────────────────────────────── */
const PAGE_CACHE = new Map();

function pageCacheKey(view, params) {
  if (view === 'home')       return 'home';
  if (view === 'categories') return 'categories';
  if (view === 'products' && params.catId) return `products:${params.catId}`;
  return null;
}

// Update only the dynamic parts (cart badge) on a cached home page
function refreshCachedPage(div, view) {
  if (view !== 'home') return;
  const cnt = cartCount();
  const btn = div.querySelector('#btn-header-cart');
  if (!btn) return;
  let badge = btn.querySelector('.header-cart-badge');
  if (cnt > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'header-cart-badge'; btn.appendChild(badge); }
    badge.textContent = cnt;
  } else {
    badge?.remove();
  }
}

// Kick off image loading in background right after data is ready
function preloadImages() {
  const urls = new Set();
  S.products.slice(0, 24).forEach(p => { const imgs = getProductImages(p); if (imgs[0]) urls.add(imgs[0]); });
  S.banners.forEach(b => { if (b.imageUrl) urls.add(b.imageUrl); });
  urls.forEach(url => { (new Image()).src = url; });
}

/* ─── GSAP entrance animations ──────────────────────────────── */
function animatePageIn(div, view) {
  const g = window.gsap;
  if (!g) return;
  // One frame delay — ensures CSS page-enter transitions don't conflict
  requestAnimationFrame(() => {
    const q = s => Array.from(div.querySelectorAll(s));
    const f = s => div.querySelector(s);
    const base = { ease: 'power2.out', clearProps: 'all' };

    if (view === 'home') {
      const banner = f('.banner-wrap') || f('.banner-card');
      if (banner) g.from(banner, { ...base, opacity: 0, y: 18, duration: 0.45 });
      const chips = q('.cat-chip');
      if (chips.length) g.from(chips, { ...base, opacity: 0, y: 12, duration: 0.35, stagger: 0.05, delay: 0.07 });
      const cards = q('.product-card');
      if (cards.length) g.from(cards, { ...base, opacity: 0, y: 16, duration: 0.38, stagger: 0.055, delay: 0.14 });
    }

    if (view === 'categories') {
      const banners = q('.cat-banner-card');
      if (banners.length) g.from(banners, { ...base, opacity: 0, x: -14, duration: 0.32, stagger: 0.06 });
    }

    if (view === 'products') {
      const cards = q('.product-card');
      if (cards.length) g.from(cards, { ...base, opacity: 0, y: 14, duration: 0.32, stagger: 0.05 });
    }

    if (view === 'product') {
      const hero = f('.pd2-img-wrap');
      const info = f('.pd2-info');
      const btn  = f('.pd2-add-btn');
      if (hero) g.from(hero, { ...base, opacity: 0, scale: 0.97, duration: 0.42, ease: 'power3.out' });
      if (info) g.from(info, { ...base, opacity: 0, y: 18, duration: 0.35, delay: 0.09 });
      if (btn)  g.from(btn,  { ...base, opacity: 0, y: 10, duration: 0.3,  delay: 0.18 });
    }

    if (view === 'cart') {
      const items = q('.cart2-item');
      if (items.length) g.from(items, { ...base, opacity: 0, x: -12, duration: 0.28, stagger: 0.055 });
      const summary = f('.cart2-footer');
      if (summary) g.from(summary, { ...base, opacity: 0, y: 12, duration: 0.28, delay: items.length * 0.055 });
    }
  });
}

/* ─── Navigation ─────────────────────────────────────────────── */
// type: 'push' (slide in) | 'back' (slide back) | 'tab' (fade) | 'replace' (instant)
function go(view, params = {}, type = 'push') {
  const root = document.getElementById('view-root');

  // Se já está na mesma view (tab), só garante scroll no topo — sem re-render
  if (type === 'tab' && view === S.view) {
    const cur = document.getElementById('current-view');
    if (cur) cur.scrollTop = 0;
    updateBottomNav(view);
    return;
  }

  const prev = root.querySelector('#current-view');

  // Save outgoing page to cache before leaving (never save skeleton via 'replace')
  if (prev && type !== 'replace') {
    const key = pageCacheKey(S.view, S.viewParams);
    if (key) {
      prev._savedScrollTop = prev.scrollTop;
      prev.removeAttribute('id');
      PAGE_CACHE.set(key, prev);
    }
  }

  if (type === 'back') {
    S.navStack.pop();
  } else if (type === 'push') {
    S.navStack.push({ view: S.view, params: S.viewParams });
  } else {
    S.navStack = [];
  }
  clearInterval(S.imgTimer);
  S.imgTimer = null;
  S.view       = view;
  S.viewParams = params;
  if (view === 'product') S.qty = 1;

  // Restore from cache or render fresh
  const key    = pageCacheKey(view, params);
  const cached = key ? PAGE_CACHE.get(key) : null;
  let div;

  if (cached) {
    div = cached;
    div.id = 'current-view';
    div.classList.remove('slide-in', 'slide-out', 'slide-bk-in', 'slide-bk-out', 'fade-in');
    const cachedGrid = div.querySelector('.products-grid');
    if (cachedGrid) {
      cachedGrid.classList.toggle('compact', S.layout === 4);
      const toggleBtn = div.querySelector('#btn-layout-toggle');
      if (toggleBtn) toggleBtn.innerHTML = S.layout === 2 ? ICON_COMPACT : ICON_EXPAND;
    }
  } else {
    div = document.createElement('div');
    div.className = 'view-page';
    div.id = 'current-view';
    div.innerHTML = renderView(view, params);
  }

  if (prev) {
    root.appendChild(div);
    const removePrev = prev;
    if (type === 'replace') {
      removePrev.remove();
    } else {
      requestAnimationFrame(() => {
        if (removePrev.parentNode && removePrev.id !== 'current-view') removePrev.remove();
      });
    }
  } else {
    root.appendChild(div);
  }

  updateBottomNav(view);
  updateCartBadge();

  if (cached) {
    refreshCachedPage(div, view);
  } else {
    shimmerImages(div);
    wireView(view, params, div);
    animatePageIn(div, view);
  }

  div.scrollTop = div._savedScrollTop || 0;
}

function goBack() {
  if (S.navStack.length === 0) return;
  const prev = S.navStack[S.navStack.length - 1];
  go(prev.view, prev.params, 'back');
}

/* ─── Bottom nav ─────────────────────────────────────────────── */
function renderBottomNav() {
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = `
    <button class="nav-btn" id="nav-home" data-view="home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
      <span>Início</span>
    </button>
    <button class="nav-btn" id="nav-categories" data-view="categories">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>Categorias</span>
    </button>
    <button class="nav-btn" id="nav-cart" data-view="cart">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
      </svg>
      <span>Carrinho<span id="nav-cart-badge" class="cart-badge" style="display:none"></span></span>
    </button>
    <button class="nav-btn" id="nav-orders" data-view="orders">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <line x1="9" y1="7" x2="15" y2="7"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
        <line x1="9" y1="15" x2="12" y2="15"/>
      </svg>
      <span>Pedidos</span>
    </button>
    <button class="nav-btn" id="nav-account" data-view="account">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <span>Conta</span>
    </button>
  `;
  nav.querySelector('#nav-home').onclick       = () => go('home',       {}, 'tab');
  nav.querySelector('#nav-categories').onclick = () => go('categories', {}, 'tab');
  nav.querySelector('#nav-cart').onclick       = () => go('cart',       {}, 'tab');
  nav.querySelector('#nav-orders').onclick     = () => go('orders',     {}, 'tab');
  nav.querySelector('#nav-account').onclick    = () => go('account',    {}, 'tab');
}

function updateBottomNav(view) {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

/* ─── View renderers ─────────────────────────────────────────── */
function renderView(view, params) {
  switch (view) {
    case 'home':       return renderHome();
    case 'categories': return renderCategories();
    case 'products':   return renderProductList(params.catId);
    case 'product':    return renderProductDetail(params.product);
    case 'cart':       return renderCart();
    case 'checkout':   return renderCheckout();
    case 'success':    return renderSuccess();
    case 'orders':     return renderOrders();
    case 'account':    return renderAccount();
    default:           return renderHome();
  }
}

/* HOME */
function renderHome() {
  const cfg = S.settings;
  const isOpen = cfg.lojaOpen !== false;
  const fee    = cfg.deliveryFee || 0;
  const time   = cfg.lojaDeliveryTime || '30–45 min';
  const addr   = cfg.lojaAddress || cfg.address || 'Rua das Bebidas, 123';
  const cnt    = cartCount();
  const activeCats = CATS.filter(c => S.products.some(p => p.category === c.id));
  const featured    = S.products.slice(0, 6);
  const banners     = S.banners;

  return `
    <div class="home-header">
      <div class="home-address-bar">
        <div class="home-address-left">
          <svg class="location-pin-icon" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <div class="home-address-text">
            <span class="home-address-label">Entregar em</span>
            <span class="home-address-street">${esc(addr)}</span>
          </div>
          <svg class="home-address-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="home-header-icons">
          <button class="home-icon-btn" id="btn-home-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button class="home-icon-btn" id="btn-header-cart" style="position:relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
            </svg>
            ${cnt > 0 ? `<span class="header-cart-badge">${cnt}</span>` : ''}
          </button>
        </div>
      </div>
    </div>

    <div class="banners">
      ${banners.length > 0 ? `
        <div class="banner-wrap">
          <div class="banner-track" id="banner-track">
            ${banners.map(b => `
              <div class="banner-slide" data-pid="${esc(b.productId || '')}">
                <div class="banner-art">
                  <img src="${esc(b.imageUrl)}" alt="${esc(b.title || '')}" />
                </div>
              </div>`).join('')}
          </div>
          ${banners.length > 1 ? `
            <div class="banner-dots" id="banner-dots">
              ${banners.map((_, i) => `<span class="banner-dot${i === 0 ? ' active' : ''}"></span>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : `
        <div class="banner-card">
          <div class="banner-text">
            <span class="banner-tag">Delivery rápido</span>
            <h3>Bebidas geladas<br>na sua porta</h3>
            <p>${time} · ${fee === 0 ? 'Grátis' : brl(fee)}</p>
          </div>
          <div class="banner-img-wrap"></div>
        </div>
      `}
    </div>


    <div class="section-header">
      <h3>Categorias</h3>
      <button id="btn-see-all">Ver todas →</button>
    </div>
    <div class="cat-scroll" id="cat-scroll">
      ${activeCats.map(c => `
        <button class="cat-chip" data-catid="${esc(c.id)}">
          <div class="cat-chip-icon">${catThumb(c.id)}</div>
          <span>${c.label}</span>
        </button>
      `).join('')}
    </div>

    <div class="section-header" id="featured-header">
      <h3>Destaques</h3>
      <button class="layout-toggle-btn" id="btn-layout-toggle">${S.layout === 2 ? ICON_COMPACT : ICON_EXPAND}</button>
    </div>
    <div class="products-grid${S.layout === 4 ? ' compact' : ''}" id="products-grid">
      ${featured.length > 0
        ? featured.map(renderProductCard).join('')
        : `<div style="grid-column:span 2"><div class="loading-state">Carregando produtos…</div></div>`
      }
    </div>
  `;
}

/* CATEGORIES */
function renderCategories() {
  const activeCats = CATS.filter(c => S.products.some(p => p.category === c.id));
  return `
    <div class="cat-page-header">
      <button class="btn-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h2>CATEGORIAS</h2>
      <button class="cat-page-search" id="btn-cat-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
    </div>
    <div class="cat-banner-list">
      ${activeCats.map(c => {
        const prod = S.products.find(p => p.category === c.id && p.image);
        const imgHtml = prod?.image
          ? `<img src="${esc(prod.image)}" alt="${esc(c.label)}" class="cat-banner-img" />`
          : `<span class="cat-banner-emoji">${c.emoji || '🛒'}</span>`;
        return `
          <div class="cat-banner-card" data-catid="${esc(c.id)}">
            <div class="cat-banner-text">
              <span class="cat-banner-name">${esc(c.label.toUpperCase())}</span>
              <span class="cat-banner-link">${esc(c.tagline || 'Ver opções')} &rsaquo;</span>
            </div>
            <div class="cat-banner-visual">${imgHtml}</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

/* PRODUCT LIST */
function renderProductList(catId) {
  const cat     = CATS.find(c => c.id === catId) || { label: catId };
  const prods   = S.products.filter(p => p.category === catId);
  const filters = buildFilters(catId, prods);
  return `
    <div class="vhf">
      <button class="vhf-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <span class="vhf-title">${esc(cat.label.toUpperCase())}</span>
      <button class="vhf-icon" id="btn-pl-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
    </div>
    ${filters.length > 0 ? `
      <div class="filter-tabs" id="filter-tabs">
        ${filters.map((f, i) => `<button class="filter-tab${i === 0 ? ' active' : ''}" data-fid="${esc(f.id)}">${esc(f.label)}</button>`).join('')}
      </div>
    ` : ''}
    ${prods.length > 0
      ? `<div class="plist" id="prod-list-grid">${prods.map(renderPLI).join('')}</div>`
      : `<div class="empty-state">
           <div class="empty-state-icon">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
             </svg>
           </div>
           <h4>Sem produtos disponíveis</h4>
           <p>Esta categoria não tem produtos no momento.</p>
         </div>`
    }
  `;
}

/* PRODUCT LIST ITEM (new list layout) */
function renderPLI(p) {
  const inStock = (p.stock ?? 1) > 0;
  return `
    <div class="pli" data-pid="${esc(p.id)}">
      <div class="pli-thumb">${productImage(p)}</div>
      <div class="pli-info">
        <div class="pli-name">${esc(p.name)}</div>
        ${p.brand ? `<div class="pli-var">${esc(p.brand)}</div>` : ''}
        <div class="pli-price">${brl(p.price)}</div>
      </div>
      ${inStock
        ? `<button class="pli-add" data-pid="${esc(p.id)}">+</button>`
        : `<span class="pli-out">Esgotado</span>`}
    </div>`;
}

/* PRODUCT CARD */
function renderProductCard(p) {
  const inStock = (p.stock ?? 1) > 0;
  return `
    <div class="product-card" data-pid="${esc(p.id)}">
      <div class="product-card-img">${productImage(p)}</div>
      <div class="product-card-body">
        <div class="product-card-name">${esc(p.name)}</div>
        ${p.brand ? `<div class="product-card-brand">${esc(p.brand)}</div>` : ''}
        <div class="product-card-divider"></div>
        <div class="product-card-footer">
          <span class="product-card-price">${brl(p.price)}</span>
          ${inStock
            ? `<button class="btn-add-card" data-pid="${esc(p.id)}">+</button>`
            : `<span class="product-out-badge">Esgotado</span>`}
        </div>
      </div>
    </div>`;
}

/* PRODUCT DETAIL */
function renderProductDetail(p) {
  const inStock  = (p.stock ?? 1) > 0;
  const images   = getProductImages(p);
  const firstImg = images[0] || '';

  return `
    <div class="pd2-page">
      <button class="pd2-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div class="pd2-img-wrap">
        ${firstImg
          ? `<img id="pd-main-img" src="${esc(firstImg)}" alt="${esc(p.name)}" loading="eager" />`
          : productImage(p)
        }
      </div>

      <div class="pd2-info">
        ${p.brand ? `<p class="pd2-var">${esc(p.brand)}</p>` : ''}
        <h2 class="pd2-name">${esc(p.name)}</h2>
        <p class="pd2-price">${brl(p.price)}</p>

        ${inStock ? `
          <div class="pd2-qty-pill">
            <button class="pd2-qty-btn" id="qty-minus" ${S.qty <= 1 ? 'disabled' : ''}>−</button>
            <span class="pd2-qty-val" id="qty-val">${S.qty}</span>
            <button class="pd2-qty-btn" id="qty-plus">+</button>
          </div>
        ` : `<p class="pd2-out">Esgotado</p>`}
      </div>

      ${inStock ? `
        <button class="pd2-add-btn" id="btn-add-to-cart">ADICIONAR AO CARRINHO</button>
      ` : ''}

      <div class="pd2-sections">
        ${p.description ? `
          <div class="pd2-section">
            <p class="pd2-sec-label">DESCRIÇÃO</p>
            <p class="pd2-sec-body">${esc(p.description)}</p>
          </div>
        ` : ''}
        ${p.teor ? `
          <div class="pd2-section">
            <p class="pd2-sec-label">TEOR ALCOÓLICO</p>
            <p class="pd2-sec-body">${esc(p.teor)}</p>
          </div>
        ` : ''}
        ${p.origem ? `
          <div class="pd2-section">
            <p class="pd2-sec-label">ORIGEM</p>
            <p class="pd2-sec-body">${esc(p.origem)}</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/* CART */
function renderCart() {
  const fee   = S.settings.deliveryFee || 0;
  const sub   = cartTotal();
  const total = sub + fee;
  return `
    <div class="vhf">
      <button class="vhf-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <span class="vhf-title">MEU CARRINHO</span>
      <button class="vhf-icon" id="btn-clear-cart-header" title="Limpar carrinho">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
    </div>
    ${S.cart.length === 0 ? `
      <div class="empty-state" style="margin-top:40px">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
          </svg>
        </div>
        <h4>Carrinho vazio</h4>
        <p>Adicione produtos para fazer seu pedido.</p>
      </div>
    ` : `
      <div class="cart2-list" id="cart2-list">
        ${S.cart.map(renderCartItem).join('')}
      </div>
      <div class="cart2-footer">
        <div class="cart2-summary">
          <div class="cart2-row">
            <span>Subtotal</span><span>${brl(sub)}</span>
          </div>
          ${fee > 0 ? `
          <div class="cart2-row">
            <span>Taxa de entrega</span><span>${brl(fee)}</span>
          </div>` : ''}
          <div class="cart2-row cart2-total">
            <span>TOTAL</span><span>${brl(total)}</span>
          </div>
        </div>
        <button class="btn-primary-yellow" id="btn-go-checkout">FINALIZAR PEDIDO</button>
      </div>
    `}
  `;
}

function renderCartItem(item) {
  return `
    <div class="cart2-item" data-cid="${esc(item.id)}">
      <div class="cart2-thumb">${productImage({ art: item.art, image: item.image, category: item.category, name: item.name })}</div>
      <div class="cart2-info">
        <div class="cart2-name">${esc(item.name)}</div>
        ${item.brand ? `<div class="cart2-var">${esc(item.brand)}</div>` : ''}
        <div class="cart2-qty-ctrl">
          <button class="cart2-qty-btn" data-cid="${esc(item.id)}" data-delta="-1">−</button>
          <span class="cart2-qty-val">${item.qty}</span>
          <button class="cart2-qty-btn" data-cid="${esc(item.id)}" data-delta="1">+</button>
        </div>
      </div>
      <div class="cart2-price">${brl(item.price * item.qty)}</div>
    </div>`;
}

/* CHECKOUT */
function renderCheckout() {
  const d   = S.checkout;
  const fee = S.settings.deliveryFee || 0;
  const sub   = cartTotal();
  const total = sub + fee;
  const enabledPays = S.settings.lojaPayments || ['pix', 'credito', 'debito', 'dinheiro'];
  const PAY_OPTS = [
    { id: 'pix',      label: 'PIX' },
    { id: 'credito',  label: 'Cartão de Crédito' },
    { id: 'debito',   label: 'Cartão de Débito' },
    { id: 'dinheiro', label: 'Dinheiro' },
  ].filter(p => enabledPays.includes(p.id));

  // Determine if we have a saved address to show card vs form
  const hasAddr = !!(d.address);

  return `
    <div class="vhf">
      <button class="vhf-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <span class="vhf-title">FINALIZAR PEDIDO</span>
      <span class="vhf-icon"></span>
    </div>

    <div class="co2-body">

      <!-- Dados do cliente -->
      <div class="co2-sec-title">DADOS DO CLIENTE</div>
      <div class="checkout-section">
        <div class="form-field">
          <label>Nome completo *</label>
          <input type="text" id="co-name" placeholder="Ex.: João Silva" value="${esc(d.name)}" autocomplete="name" />
        </div>
        <div class="form-field">
          <label>WhatsApp *</label>
          <input type="tel" id="co-phone" placeholder="(92) 9 9999-9999" value="${esc(d.phone)}" autocomplete="tel" />
        </div>
      </div>

      <!-- Endereço de entrega -->
      <div class="co2-sec-title">ENDEREÇO DE ENTREGA</div>

      ${hasAddr ? `
        <div class="co2-addr-card" id="co2-addr-card">
          <div class="co2-addr-info">
            <div class="co2-addr-street">${esc(d.address)}${d.number ? ', ' + esc(d.number) : ''}</div>
            ${d.complement ? `<div class="co2-addr-compl">${esc(d.complement)}</div>` : ''}
          </div>
          <button class="co2-addr-change" id="btn-addr-change">Alterar</button>
        </div>
      ` : ''}

      <div class="co2-addr-form${hasAddr ? ' hidden' : ''}" id="co2-addr-form">
        <div class="checkout-section">
          <div class="form-field">
            <label>Rua / Avenida *</label>
            <input type="text" id="co-address" placeholder="Ex.: Rua das Acácias" value="${esc(d.address)}" autocomplete="street-address" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Número</label>
              <input type="text" id="co-number" placeholder="123" value="${esc(d.number)}" />
            </div>
            <div class="form-field">
              <label>Complemento</label>
              <input type="text" id="co-complement" placeholder="Apto, Bairro…" value="${esc(d.complement)}" />
            </div>
          </div>
        </div>
      </div>

      <!-- Forma de pagamento -->
      <div class="co2-sec-title">FORMA DE PAGAMENTO</div>
      <div class="checkout-section">
        <div class="co2-pay-list">
          ${PAY_OPTS.map(p => `
            <label class="co2-pay-opt">
              <span class="co2-pay-radio${d.payment === p.id ? ' checked' : ''}" data-pay="${esc(p.id)}"></span>
              <span class="co2-pay-label">${esc(p.label)}</span>
              <input type="radio" name="co-payment" value="${esc(p.id)}" ${d.payment === p.id ? 'checked' : ''} style="display:none" />
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Resumo do pedido -->
      <div class="co2-sec-title">RESUMO DO PEDIDO</div>
      <div class="checkout-section">
        <div class="co2-summary">
          <div class="co2-sum-row"><span>Subtotal</span><span>${brl(sub)}</span></div>
          ${fee > 0 ? `<div class="co2-sum-row"><span>Taxa de entrega</span><span>${brl(fee)}</span></div>` : ''}
          <div class="co2-sum-row co2-sum-total"><span>TOTAL</span><span>${brl(total)}</span></div>
        </div>
      </div>

      <!-- Observações -->
      <div class="co2-sec-title">OBSERVAÇÕES (OPCIONAL)</div>
      <div class="checkout-section">
        <div class="form-field co2-notes">
          <textarea id="co-notes" placeholder="Troco, observações sobre o pedido…">${esc(d.notes)}</textarea>
        </div>
      </div>

      <button class="btn-primary-yellow" id="btn-confirm">CONFIRMAR PEDIDO</button>
    </div>
  `;
}

/* SUCCESS */
function renderSuccess() {
  const phone = getWAPhone();
  return `
    <div class="success-view">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="42" height="42">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <h2 class="success-title">Pedido confirmado!</h2>
      <p class="success-sub">Recebemos o seu pedido. Entraremos em contato pelo WhatsApp para confirmar a entrega.</p>
      ${S.lastOrderId ? `<div class="success-order-id"># ${S.lastOrderId.slice(-6).toUpperCase()}</div>` : ''}
      <div class="success-btns">
        ${phone ? `
          <button class="btn-whatsapp" id="btn-wa-success">
            ${waIcon(20)} Acompanhar no WhatsApp
          </button>
        ` : ''}
        <button class="btn-checkout" id="btn-keep-shopping">Continuar comprando</button>
      </div>
    </div>
  `;
}

/* WA icon helper */
function waIcon(size = 20) {
  return `<svg viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
}

/* ─── Event wiring ───────────────────────────────────────────── */
function wireView(view, params, c) {
  c.querySelector('#btn-back')?.addEventListener('click', goBack);

  if (view === 'home')       wireHome(c);
  if (view === 'categories') wireCats(c);
  if (view === 'products')   wireProductList(c, params.catId);
  if (view === 'product')    wireProductDetail(c, params.product);
  if (view === 'cart')       wireCart(c);
  if (view === 'checkout')   wireCheckout(c);
  if (view === 'success')    wireSuccess(c);
  if (view === 'orders')     wireOrders(c);
  if (view === 'account')    wireAccount(c);
}

function wireHome(c) {
  c.querySelector('#btn-see-all')?.addEventListener('click', () => go('categories'));
  c.querySelector('#btn-home-search')?.addEventListener('click', () => go('categories'));
  c.querySelector('#btn-header-cart')?.addEventListener('click', () => go('cart'));

  // Swipeable banner com auto-advance
  const banTrack  = c.querySelector('#banner-track');
  const banDotsEl = c.querySelector('#banner-dots');
  if (banTrack) {
    const slides = banTrack.querySelectorAll('.banner-slide');
    const dots   = banDotsEl ? banDotsEl.querySelectorAll('.banner-dot') : [];
    let autoTimer;
    let scrolling = false;

    const slideW = () => slides[0].offsetWidth + 10; // width + gap
    function curIdx() { return Math.round(banTrack.scrollLeft / slideW()); }
    function goTo(idx) {
      banTrack.scrollTo({ left: idx * slideW(), behavior: 'smooth' });
    }

    function syncDots(idx) {
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }

    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        const next = (curIdx() + 1) % slides.length;
        goTo(next);
      }, 2000);
    }

    banTrack.addEventListener('scroll', () => {
      syncDots(curIdx());
      // Restart auto-advance after user swipes
      clearInterval(autoTimer);
      clearTimeout(banTrack._rt);
      banTrack._rt = setTimeout(startAuto, 4000);
    }, { passive: true });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => { goTo(i); startAuto(); });
    });

    // Tap to open product (only if not a swipe)
    slides.forEach(slide => {
      let startX = 0;
      slide.addEventListener('pointerdown', e => { startX = e.clientX; });
      slide.addEventListener('pointerup', e => {
        if (Math.abs(e.clientX - startX) < 10) {
          const product = S.products.find(p => p.id === slide.dataset.pid);
          if (product) go('product', { product });
        }
      });
    });

    startAuto();
  }

  c.querySelectorAll('.cat-chip').forEach(chip =>
    chip.addEventListener('click', () => go('products', { catId: chip.dataset.catid }))
  );

  const grid = c.querySelector('#products-grid');
  if (grid) wireProductCards(grid);
  wireLayoutToggle(c, '#products-grid');

  c.querySelector('#home-search')?.addEventListener('input', e => {
    const val = e.target.value.trim().toLowerCase();
    if (!grid) return;
    const header = c.querySelector('#featured-header h3');
    if (val.length >= 2) {
      const results = S.products.filter(p =>
        p.name.toLowerCase().includes(val) ||
        (p.brand || '').toLowerCase().includes(val)
      );
      if (header) header.textContent = `Resultados (${results.length})`;
      grid.innerHTML = results.length > 0
        ? results.map(renderProductCard).join('')
        : `<div style="grid-column:span 2;padding:24px;text-align:center;color:var(--text-secondary)">Nenhum produto encontrado.</div>`;
    } else {
      if (header) header.textContent = 'Destaques';
      grid.innerHTML = S.products.slice(0, 6).map(renderProductCard).join('');
    }
    wireProductCards(grid);
  });
}

function wireCats(c) {
  c.querySelectorAll('.cat-card, .cat-banner-card').forEach(card =>
    card.addEventListener('click', () => go('products', { catId: card.dataset.catid }))
  );
  c.querySelector('#btn-cat-search')?.addEventListener('click', () => go('home', {}, 'tab'));
}

function wireProductCards(c) {
  c.querySelectorAll('.product-card').forEach(card => {
    const pid = card.dataset.pid;
    const product = S.products.find(p => p.id === pid);
    if (!product) return;
    card.addEventListener('click', e => {
      if (e.target.closest('.btn-add-card')) return;
      go('product', { product });
    });
  });
  c.querySelectorAll('.btn-add-card').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const product = S.products.find(p => p.id === btn.dataset.pid);
      if (!product) return;
      addToCart(product, 1);
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.style.cssText = 'background:var(--c-green);color:white';
      setTimeout(() => { btn.textContent = orig; btn.style.cssText = ''; }, 1200);
    });
  });
}

function wireLayoutToggle(c, gridSel) {
  const btn  = c.querySelector('#btn-layout-toggle');
  const grid = c.querySelector(gridSel);
  if (!btn || !grid) return;
  btn.addEventListener('click', () => {
    S.layout = S.layout === 2 ? 4 : 2;
    localStorage.setItem('eg:layout', String(S.layout));
    grid.classList.toggle('compact', S.layout === 4);
    btn.innerHTML = S.layout === 2 ? ICON_COMPACT : ICON_EXPAND;
  });
}

function wirePLIItems(container, prods) {
  container.querySelectorAll('.pli').forEach(card => {
    const pid = card.dataset.pid;
    const product = S.products.find(p => p.id === pid);
    if (!product) return;
    card.addEventListener('click', e => {
      if (e.target.closest('.pli-add')) return;
      go('product', { product });
    });
  });
  container.querySelectorAll('.pli-add').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const product = S.products.find(p => p.id === btn.dataset.pid);
      if (!product) return;
      addToCart(product, 1);
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.style.cssText = 'background:var(--c-green);color:white';
      setTimeout(() => { btn.textContent = orig; btn.style.cssText = ''; }, 1200);
    });
  });
}

function wireProductList(c, catId) {
  const prods = S.products.filter(p => p.category === catId);
  const grid  = c.querySelector('#prod-list-grid');

  c.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      c.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const fid = tab.dataset.fid;
      let filtered = prods;
      if (fid !== 'all') {
        if      (fid === 'lata')    filtered = prods.filter(p => /lata/i.test(p.name));
        else if (fid === 'garrafa') filtered = prods.filter(p => /garrafa|long.?neck/i.test(p.name));
        else    filtered = prods.filter(p => (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '') === fid);
      }
      if (grid) {
        grid.innerHTML = filtered.length > 0
          ? filtered.map(renderPLI).join('')
          : `<div style="padding:32px;text-align:center;color:var(--text-secondary)">Nenhum produto encontrado.</div>`;
        wirePLIItems(grid, filtered);
      }
    });
  });

  if (grid) wirePLIItems(grid, prods);
}

function wireProductDetail(c, product) {
  // Bounce animation between multiple product images
  const images = getProductImages(product);
  if (images.length > 1) {
    const imgEl = c.querySelector('#pd-main-img');
    let idx = 0;
    S.imgTimer = setInterval(() => {
      if (!imgEl) return;
      idx = (idx + 1) % images.length;
      imgEl.classList.remove('pd-img-bounce');
      void imgEl.offsetWidth; // force reflow to restart animation
      imgEl.src = images[idx];
      imgEl.classList.add('pd-img-bounce');
    }, 2800);
  }

  const btnMinus = c.querySelector('#qty-minus');
  const btnPlus  = c.querySelector('#qty-plus');
  const qtyVal   = c.querySelector('#qty-val');
  const addBtn   = c.querySelector('#btn-add-to-cart');

  function syncQty() {
    if (qtyVal)   qtyVal.textContent = S.qty;
    if (btnMinus) btnMinus.disabled  = S.qty <= 1;
  }

  btnMinus?.addEventListener('click', () => { if (S.qty > 1) { S.qty--; syncQty(); } });
  btnPlus?.addEventListener('click',  () => { S.qty++; syncQty(); });

  addBtn?.addEventListener('click', () => {
    addToCart(product, S.qty);
    addBtn.textContent = '✓ Adicionado!';
    addBtn.style.background = 'var(--c-green)';
    addBtn.style.color = 'white';
    if (window.gsap) {
      window.gsap.fromTo(addBtn,
        { scale: 0.94 },
        { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' }
      );
      const badge = document.getElementById('nav-cart-badge');
      if (badge) window.gsap.fromTo(badge, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
    }
    // Só vai pro carrinho se o usuário ainda estiver nesta tela de produto
    const pid = product.id;
    setTimeout(() => {
      if (S.view === 'product' && S.viewParams?.product?.id === pid) go('cart');
    }, 750);
  });
}

function wireCart(c) {
  function sync() {
    if (S.cart.length === 0) {
      c.innerHTML = renderCart();
      wireCart(c);
      return;
    }

    const fee   = S.settings.deliveryFee || 0;
    const sub   = cartTotal();
    const total = sub + fee;

    const listEl = c.querySelector('#cart2-list');
    if (listEl) { listEl.innerHTML = S.cart.map(renderCartItem).join(''); bindItems(); }

    // Update summary rows
    const rows = c.querySelectorAll('.cart2-row');
    if (rows.length) {
      rows[0].querySelector('span:last-child').textContent = brl(sub);
      if (fee > 0 && rows[1]) rows[1].querySelector('span:last-child').textContent = brl(fee);
      const totalRow = c.querySelector('.cart2-total');
      if (totalRow) totalRow.querySelector('span:last-child').textContent = brl(total);
    }

    updateCartBadge();
  }

  function bindItems() {
    c.querySelectorAll('.cart2-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid   = btn.dataset.cid;
        const delta = parseInt(btn.dataset.delta, 10);
        const item  = S.cart.find(i => i.id === cid);
        if (item) { setCartQty(cid, item.qty + delta); sync(); }
      });
    });
  }

  bindItems();
  c.querySelector('#btn-clear-cart-header')?.addEventListener('click', () => {
    if (S.cart.length > 0 && confirm('Limpar carrinho?')) {
      S.cart = []; saveCart(); updateCartBadge();
      c.innerHTML = renderCart();
      wireCart(c);
    }
  });
  c.querySelector('#btn-go-checkout')?.addEventListener('click', () => {
    if (S.cart.length > 0) go('checkout');
  });
}

function wireCheckout(c) {
  // Radio payment buttons
  c.querySelectorAll('.co2-pay-radio').forEach(radio => {
    radio.addEventListener('click', () => {
      const pay = radio.dataset.pay;
      S.checkout.payment = pay;
      c.querySelectorAll('.co2-pay-radio').forEach(r => r.classList.remove('checked'));
      radio.classList.add('checked');
      // Sync the hidden <input> too
      c.querySelectorAll('input[name="co-payment"]').forEach(inp => {
        inp.checked = (inp.value === pay);
      });
    });
  });

  // Address card toggle
  c.querySelector('#btn-addr-change')?.addEventListener('click', () => {
    const card = c.querySelector('#co2-addr-card');
    const form = c.querySelector('#co2-addr-form');
    if (card) card.style.display = 'none';
    if (form) form.classList.remove('hidden');
  });

  c.querySelector('#btn-confirm')?.addEventListener('click', () => {
    const d = S.checkout;
    d.name       = c.querySelector('#co-name')?.value.trim()       || '';
    d.phone      = c.querySelector('#co-phone')?.value.trim()      || '';

    // Address: use form input if visible, otherwise keep card's existing address
    const addrForm = c.querySelector('#co2-addr-form');
    const formVisible = addrForm && !addrForm.classList.contains('hidden');
    if (formVisible) {
      d.address    = c.querySelector('#co-address')?.value.trim()    || '';
      d.number     = c.querySelector('#co-number')?.value.trim()     || '';
      d.complement = c.querySelector('#co-complement')?.value.trim() || '';
    }
    d.notes      = c.querySelector('#co-notes')?.value.trim()      || '';

    if (!d.name)    { alert('Informe seu nome completo.'); return; }
    if (!d.phone)   { alert('Informe seu número de WhatsApp.'); return; }
    if (!d.address) { alert('Informe o endereço de entrega.'); return; }

    const fee = S.settings.deliveryFee || 0;
    const orderData = {
      customer: {
        name:       d.name,
        phone:      d.phone.replace(/\D/g, ''),
        address:    d.address,
        number:     d.number,
        complement: d.complement,
      },
      items: S.cart.map(i => ({
        productId: i.id,
        name:      i.name,
        qty:       i.qty,
        price:     i.price,
        subtotal:  i.price * i.qty,
      })),
      subtotal:    cartTotal(),
      deliveryFee: fee,
      total:       cartTotal() + fee,
      payment:     d.payment,
      notes:       d.notes,
    };

    // 1. Save customer for future pre-fill
    saveCustomer(d);
    // 2. Save to local order history and grab generated ID
    saveLocalOrder(orderData);
    S.lastOrderId = S.orders[0].id;
    // 3. Open WhatsApp automatically
    openWhatsApp(buildOrderMessage());
    // 4. Clear cart and go to success
    S.cart = [];
    saveCart();
    updateCartBadge();
    S.navStack = [];
    go('success');
    // 5. Fire-and-forget Firestore save (non-blocking)
    createOrder(orderData).catch(err => console.warn('Firestore save failed:', err));
  });
}

function wireSuccess(c) {
  c.querySelector('#btn-wa-success')?.addEventListener('click', () => {
    const code = (S.lastOrderId || '').slice(-6).toUpperCase();
    openWhatsApp(`Olá! Acabei de fazer um pedido no app Empório GO. Código: #${code}`);
  });
  c.querySelector('#btn-keep-shopping')?.addEventListener('click', () => go('home', {}, 'tab'));
}

/* ─── Init ───────────────────────────────────────────────────── */
/* ORDERS */
function renderOrderCard(order) {
  const total   = order.total || ((order.subtotal || 0) + (order.deliveryFee || 0));
  const items   = order.items || [];
  const preview = items.slice(0, 2).map(i => `${i.qty}x ${i.name}`).join(', ');
  const extra   = items.length > 2 ? ` +${items.length - 2} iten${items.length - 2 > 1 ? 's' : ''}` : '';
  const shortId = (order.id || '').slice(-6).toUpperCase();
  const dateStr = formatOrderDate(order.date);
  const payLabel = PAY_LABELS[order.payment] || order.payment || '';
  return `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-card-id">#${shortId}</span>
        <span class="order-card-date">${esc(dateStr)}</span>
      </div>
      <div class="order-card-items">${esc(preview + extra)}</div>
      <div class="order-card-footer">
        <span class="order-card-pay">${esc(payLabel)}</span>
        <span class="order-card-total">${brl(total)}</span>
      </div>
    </div>`;
}

function renderOrders() {
  const phone = getWAPhone();
  if (S.orders.length === 0) {
    return `
      <div class="view-header">
        <div class="view-header-title">
          <h2>Meus Pedidos</h2>
          <p>Histórico de pedidos</p>
        </div>
      </div>
      <div class="empty-state" style="margin-top:48px">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="9" y1="7" x2="15" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
            <line x1="9" y1="15" x2="12" y2="15"/>
          </svg>
        </div>
        <h4>Nenhum pedido ainda</h4>
        <p>Seus pedidos aparecerão aqui após a confirmação.</p>
        ${phone ? `<button class="btn-whatsapp" style="margin-top:24px" id="btn-wa-orders">${waIcon(20)} Falar no WhatsApp</button>` : ''}
      </div>
    `;
  }
  return `
    <div class="view-header">
      <div class="view-header-title">
        <h2>Meus Pedidos</h2>
        <p>${S.orders.length} pedido${S.orders.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
    <div class="orders-list">
      ${S.orders.map(renderOrderCard).join('')}
    </div>
  `;
}

/* ACCOUNT */
function renderAccount() {
  const cfg        = S.settings;
  const phone      = getWAPhone();
  const cu         = S.customer;
  const hasProfile = !!cu.name;
  const initial    = hasProfile ? cu.name.trim().charAt(0).toUpperCase() : '?';
  return `
    <div class="view-header">
      <div class="view-header-title"><h2>Minha Conta</h2></div>
    </div>
    <div class="account-body">
      <div class="account-profile-card">
        <div class="account-avatar">${initial}</div>
        <div class="account-profile-info">
          ${hasProfile ? `
            <div class="account-profile-name">${esc(cu.name)}</div>
            ${cu.phone ? `<div class="account-profile-phone">${esc(cu.phone)}</div>` : ''}
            ${cu.address ? `<div class="account-profile-addr">${esc(cu.address)}${cu.number ? ', ' + cu.number : ''}</div>` : ''}
          ` : `
            <div class="account-profile-name">Olá! Faça seu cadastro</div>
            <div class="account-profile-phone">Seus dados ficam salvos para próximos pedidos</div>
          `}
        </div>
        <button class="account-edit-btn" id="btn-edit-profile" title="Editar perfil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      <div id="profile-form" class="profile-form hidden">
        <div class="profile-form-inner">
          <div class="checkout-section-title">Editar perfil</div>
          <div class="form-field">
            <label>Nome completo</label>
            <input type="text" id="pf-name" value="${esc(cu.name || '')}" placeholder="Ex.: João Silva" autocomplete="name" />
          </div>
          <div class="form-field">
            <label>WhatsApp</label>
            <input type="tel" id="pf-phone" value="${esc(cu.phone || '')}" placeholder="(92) 9 9999-9999" autocomplete="tel" />
          </div>
          <div class="form-field">
            <label>Rua / Avenida</label>
            <input type="text" id="pf-address" value="${esc(cu.address || '')}" placeholder="Ex.: Rua das Acácias" autocomplete="street-address" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Número</label>
              <input type="text" id="pf-number" value="${esc(cu.number || '')}" placeholder="123" />
            </div>
            <div class="form-field">
              <label>Complemento</label>
              <input type="text" id="pf-complement" value="${esc(cu.complement || '')}" placeholder="Apto, Bloco…" />
            </div>
          </div>
          <div class="profile-form-btns">
            <button class="btn-profile-cancel" id="btn-profile-cancel">Cancelar</button>
            <button class="btn-profile-save" id="btn-profile-save">Salvar</button>
          </div>
        </div>
      </div>

      <div class="account-menu">
        ${phone ? `
          <button class="account-menu-item" id="btn-wa-account">
            <span class="account-menu-icon">${waIcon(22)}</span>
            <span>Falar no WhatsApp</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ` : ''}
        <button class="account-menu-item" id="btn-clear-cart">
          <span class="account-menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </span>
          <span>Limpar carrinho</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        ${hasProfile ? `
          <button class="account-menu-item account-menu-danger" id="btn-clear-profile">
            <span class="account-menu-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
              </svg>
            </span>
            <span>Apagar dados do perfil</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function wireOrders(c) {
  c.querySelector('#btn-wa-orders')?.addEventListener('click', () => openWhatsApp('Olá! Gostaria de verificar meu pedido.'));
}

function wireAccount(c) {
  c.querySelector('#btn-wa-account')?.addEventListener('click', () => openWhatsApp('Olá! Gostaria de falar com o Empório GO.'));
  c.querySelector('#btn-clear-cart')?.addEventListener('click', () => {
    if (confirm('Limpar carrinho?')) { S.cart = []; saveCart(); updateCartBadge(); go('home', {}, 'tab'); }
  });
  c.querySelector('#btn-clear-profile')?.addEventListener('click', () => {
    if (confirm('Apagar seus dados de cadastro?')) {
      S.customer = {};
      localStorage.removeItem('eg:customer');
      go('account', {}, 'tab');
    }
  });

  const editBtn     = c.querySelector('#btn-edit-profile');
  const profileForm = c.querySelector('#profile-form');
  editBtn?.addEventListener('click', () => {
    profileForm?.classList.toggle('hidden');
    if (!profileForm?.classList.contains('hidden')) {
      profileForm.querySelector('#pf-name')?.focus();
    }
  });

  c.querySelector('#btn-profile-cancel')?.addEventListener('click', () => {
    profileForm?.classList.add('hidden');
  });

  c.querySelector('#btn-profile-save')?.addEventListener('click', () => {
    const name       = c.querySelector('#pf-name')?.value.trim()       || '';
    const phone      = c.querySelector('#pf-phone')?.value.trim()      || '';
    const address    = c.querySelector('#pf-address')?.value.trim()    || '';
    const number     = c.querySelector('#pf-number')?.value.trim()     || '';
    const complement = c.querySelector('#pf-complement')?.value.trim() || '';
    if (!name) { alert('Informe seu nome.'); return; }
    saveCustomer({ name, phone, address, number, complement });
    go('account', {}, 'tab');
  });
}

function renderSkeleton() {
  return `
    <div class="home-header">
      <div class="home-address-bar">
        <div class="home-address-left">
          <svg class="location-pin-icon" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <div class="home-address-text">
            <span class="home-address-label">Entregar em</span>
            <span class="home-address-street skel-pulse" style="display:block;width:160px;height:14px;border-radius:6px;background:rgba(0,0,0,0.08)"></span>
          </div>
        </div>
        <div class="home-header-icons">
          <div class="home-icon-btn"></div>
          <div class="home-icon-btn"></div>
        </div>
      </div>
    </div>
    <div class="skel-banner skel-pulse"></div>
    <div class="skel-cats-row">
      ${[1,2,3,4].map(() => `<div class="skel-cat skel-pulse"></div>`).join('')}
    </div>
    <div class="skel-section-title skel-pulse"></div>
    <div class="skel-products-grid">
      ${[1,2,3,4,5,6].map(() => `
        <div class="skel-card skel-pulse">
          <div class="skel-card-img"></div>
          <div class="skel-card-line skel-pulse"></div>
          <div class="skel-card-line short skel-pulse"></div>
        </div>`).join('')}
    </div>
  `;
}

async function init() {
  loadCart();
  loadCustomer();
  loadOrders();

  // Mostra o app shell com skeleton imediatamente
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  splash.style.transition = 'opacity .25s';
  splash.style.opacity    = '0';
  setTimeout(() => splash.remove(), 280);
  app.classList.remove('hidden');
  renderBottomNav();

  const root = document.getElementById('view-root');
  const skelDiv = document.createElement('div');
  skelDiv.className = 'view-page';
  skelDiv.id = 'current-view';
  skelDiv.innerHTML = renderSkeleton();
  root.appendChild(skelDiv);

  // Carrega dados em paralelo
  await Promise.all([loadProducts(), loadBanners(), loadSettings()]);

  // Pré-carrega imagens em background para que fiquem em cache do browser
  preloadImages();

  // Fade-out do skeleton via callback (sem await — evita race condition com a nav)
  const launchHome = () => go('home', {}, 'replace');
  if (window.gsap) {
    window.gsap.to(skelDiv, { opacity: 0, duration: 0.18, ease: 'power1.in', onComplete: launchHome });
  } else {
    skelDiv.style.transition = 'opacity 0.18s';
    skelDiv.style.opacity = '0';
    setTimeout(launchHome, 180);
  }
}

init().catch(console.error);

// Elimina qualquer seleção de texto no instante em que ela é criada
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.toString().length > 0) sel.removeAllRanges();
});
