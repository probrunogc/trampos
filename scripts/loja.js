/**
 * Empório GO — Loja Online
 * SPA de delivery com Firebase Firestore + WhatsApp checkout
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore, collection, getDocs, query, orderBy,
  addDoc, serverTimestamp, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { productImage } from './product-art.js';

/* ─── Firebase ─────────────────────────────────────────────── */
const fbApp = initializeApp(firebaseConfig, 'loja');
const db    = getFirestore(fbApp);

/* ─── Categories definition ─────────────────────────────────── */
const CATS = [
  { id: 'Cerveja',      label: 'Cervejas',      emoji: '🍺' },
  { id: 'Destilado',    label: 'Destilados',     emoji: '🥃' },
  { id: 'Energético',   label: 'Energéticos',    emoji: '⚡' },
  { id: 'Refrigerante', label: 'Refrigerantes',  emoji: '🥤' },
  { id: 'Água',         label: 'Águas',          emoji: '💧' },
  { id: 'Vinho',        label: 'Vinhos',         emoji: '🍷' },
  { id: 'Gelo',         label: 'Gelo',           emoji: '🧊' },
  { id: 'Carvão',       label: 'Carvão',         emoji: '🔥' },
  { id: 'Dose',         label: 'Doses',          emoji: '🍸' },
  { id: 'Combo',        label: 'Combos',         emoji: '🎁' },
  { id: 'Conveniência', label: 'Conveniência',   emoji: '🛍️' },
  { id: 'Outros',       label: 'Outros',         emoji: '🛒' },
];

/* ─── App state ──────────────────────────────────────────────── */
const S = {
  products:  [],
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
  lastOrderId: null,
};

/* ─── Cart helpers ───────────────────────────────────────────── */
function loadCart() {
  try { S.cart = JSON.parse(localStorage.getItem('eg:cart') || '[]'); }
  catch { S.cart = []; }
}
function saveCart() { localStorage.setItem('eg:cart', JSON.stringify(S.cart)); }
function cartCount() { return S.cart.reduce((n, i) => n + i.qty, 0); }
function cartTotal() { return S.cart.reduce((n, i) => n + i.price * i.qty, 0); }

function addToCart(product, qty = 1) {
  const existing = S.cart.find(i => i.id === product.id);
  if (existing) { existing.qty += qty; }
  else {
    S.cart.push({
      id:    product.id,
      name:  product.name,
      brand: product.brand  || '',
      price: product.price,
      unit:  product.unit   || 'un',
      art:   product.art    || '',
      image: product.image  || '',
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
  return (S.settings.lojaWhatsApp || S.settings.phone || '').replace(/\D/g, '');
}

function buildOrderMessage() {
  const d = S.checkout;
  const fee = S.settings.deliveryFee || 0;
  const total = cartTotal() + fee;
  const payLabel = { pix:'PIX', credito:'Cartão de Crédito', debito:'Cartão de Débito', dinheiro:'Dinheiro' };
  const items = S.cart.map(i => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`).join('\n');

  let msg = `*Pedido — Empório GO*\n\n`;
  msg += `*Itens:*\n${items}\n\n`;
  if (fee > 0) msg += `Entrega: ${brl(fee)}\n`;
  msg += `*Total: ${brl(total)}*\n\n`;
  msg += `*Dados:*\n`;
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

/* ─── Navigation ─────────────────────────────────────────────── */
function go(view, params = {}, back = false) {
  const root  = document.getElementById('view-root');
  const prev  = root.querySelector('#current-view');

  if (back) {
    S.navStack.pop();
  } else {
    S.navStack.push({ view: S.view, params: S.viewParams });
  }
  S.view       = view;
  S.viewParams = params;
  if (view === 'product') S.qty = 1;

  const div = document.createElement('div');
  div.className = 'view-page';
  div.id = 'current-view';
  div.innerHTML = renderView(view, params);

  if (prev) {
    if (back) {
      prev.classList.add('slide-bk-out');
      div.classList.add('slide-bk-in');
    } else {
      prev.classList.add('slide-out');
      div.classList.add('slide-in');
    }
    root.appendChild(div);
    setTimeout(() => prev.remove(), 300);
  } else {
    root.appendChild(div);
  }

  updateBottomNav(view);
  updateCartBadge();
  wireView(view, params, div);

  div.scrollTop = 0;
}

function goBack() {
  if (S.navStack.length === 0) return;
  const prev = S.navStack[S.navStack.length - 1];
  go(prev.view, prev.params, true);
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
      <span>Cardápio</span>
    </button>
    <button class="nav-btn" id="nav-cart" data-view="cart">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
      </svg>
      <span>Carrinho<span id="nav-cart-badge" class="cart-badge" style="display:none"></span></span>
    </button>
    <button class="nav-btn" id="nav-wa">
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      <span>WhatsApp</span>
    </button>
  `;
  nav.querySelector('#nav-home').onclick      = () => go('home');
  nav.querySelector('#nav-categories').onclick = () => go('categories');
  nav.querySelector('#nav-cart').onclick      = () => go('cart');
  nav.querySelector('#nav-wa').onclick        = () => openWhatsApp('Olá! Quero fazer um pedido no Empório GO.');
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
    default:           return renderHome();
  }
}

/* HOME */
function renderHome() {
  const cfg = S.settings;
  const isOpen = cfg.lojaOpen !== false;
  const fee    = cfg.deliveryFee || 0;
  const time   = cfg.lojaDeliveryTime || '30–45 min';
  const activeCats = CATS.filter(c => S.products.some(p => p.category === c.id));
  const featured   = S.products.slice(0, 6);

  return `
    <div class="home-header">
      <div class="home-header-row">
        <div class="home-logo-row">
          <img src="assets/logo.png" alt="" />
          <div>
            <span class="brand-text">EMPÓRIO GO</span>
            <span class="brand-sub">Delivery de bebidas</span>
          </div>
        </div>
        <div class="store-status">
          <div class="store-status-dot ${isOpen ? '' : 'closed'}"></div>
          <span>${isOpen ? 'Aberto' : 'Fechado'}</span>
        </div>
      </div>
      <div class="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="search" id="home-search" placeholder="Buscar bebidas…" />
      </div>
    </div>

    <div class="banners">
      <div class="banner-card">
        <div class="banner-text">
          <h3>🔥 Promoções do dia</h3>
          <p>Cerveja gelada, entrega rápida</p>
        </div>
        <div class="banner-emoji">🍺</div>
      </div>
    </div>

    <div class="delivery-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 5v3h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
      <div class="delivery-bar-info">
        <h4>${fee === 0 ? 'Entrega grátis' : 'Entrega ' + brl(fee)} · ${time}</h4>
        <p>${cfg.address || 'Presidente Figueiredo — AM'}</p>
      </div>
    </div>

    <div class="section-header">
      <h3>Categorias</h3>
      <button id="btn-see-all">Ver todas →</button>
    </div>
    <div class="cat-scroll" id="cat-scroll">
      ${activeCats.map(c => `
        <button class="cat-chip" data-catid="${esc(c.id)}">
          <div class="cat-chip-icon">${c.emoji}</div>
          <span>${c.label}</span>
        </button>
      `).join('')}
    </div>

    <div class="section-header" id="featured-header">
      <h3>Destaques</h3>
    </div>
    <div class="products-grid" id="products-grid">
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
    <div class="view-header">
      <div class="view-header-title">
        <h2>Cardápio</h2>
        <p>Escolha uma categoria</p>
      </div>
    </div>
    <div class="cat-grid">
      ${activeCats.map(c => {
        const n = S.products.filter(p => p.category === c.id).length;
        return `
          <div class="cat-card" data-catid="${esc(c.id)}">
            <div class="cat-card-icon">${c.emoji}</div>
            <div class="cat-card-info">
              <h4>${c.label}</h4>
              <p>${n} produto${n !== 1 ? 's' : ''}</p>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

/* PRODUCT LIST */
function renderProductList(catId) {
  const cat   = CATS.find(c => c.id === catId) || { label: catId, emoji: '🛒' };
  const prods = S.products.filter(p => p.category === catId);
  return `
    <div class="view-header">
      <button class="btn-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="view-header-title">
        <h2>${cat.emoji} ${cat.label}</h2>
        <p>${prods.length} produto${prods.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
    ${prods.length > 0
      ? `<div class="products-grid">${prods.map(renderProductCard).join('')}</div>`
      : `<div class="empty-state">
           <div class="empty-state-icon">${cat.emoji}</div>
           <h4>Sem produtos disponíveis</h4>
           <p>Esta categoria não tem produtos no momento.</p>
         </div>`
    }
  `;
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
  const cat = CATS.find(c => c.id === p.category) || { emoji: '🛒', label: p.category || '' };
  const inStock = (p.stock ?? 1) > 0;
  const priceLabel = brl(p.price * S.qty);
  return `
    <div class="product-detail-hero">
      <div class="product-hero-topbar">
        <button class="btn-back" id="btn-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div style="width:36px"></div>
      </div>
      <div class="product-hero-img">${productImage(p)}</div>
    </div>
    <div class="product-detail-body">
      <span class="product-category-chip">${cat.emoji} ${cat.label}</span>
      <h2 class="product-detail-name">${esc(p.name)}</h2>
      ${p.brand ? `<p class="product-detail-brand">${esc(p.brand)}</p>` : ''}
      <div class="product-detail-price">${brl(p.price)}</div>
      ${p.description ? `<p class="product-detail-desc">${esc(p.description)}</p>` : ''}
      ${inStock ? `
        <div class="qty-row">
          <label>Quantidade</label>
          <div class="qty-ctrl">
            <button class="qty-btn" id="qty-minus" ${S.qty <= 1 ? 'disabled' : ''}>−</button>
            <span class="qty-val" id="qty-val">${S.qty}</span>
            <button class="qty-btn" id="qty-plus">+</button>
          </div>
        </div>
        <button class="btn-add-cart" id="btn-add-to-cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
          </svg>
          <span id="btn-add-label">Adicionar — ${priceLabel}</span>
        </button>
      ` : `
        <div class="empty-state" style="padding:24px 0">
          <h4>Produto esgotado</h4>
          <p>Não disponível no momento.</p>
        </div>
      `}
    </div>
  `;
}

/* CART */
function renderCart() {
  const fee   = S.settings.deliveryFee || 0;
  const sub   = cartTotal();
  const total = sub + fee;
  return `
    <div class="view-header">
      <div class="view-header-title">
        <h2>Carrinho</h2>
        <p>${S.cart.length === 0 ? 'Vazio' : `${cartCount()} ${cartCount() === 1 ? 'item' : 'itens'}`}</p>
      </div>
    </div>
    ${S.cart.length === 0 ? `
      <div class="empty-state" style="margin-top:40px">
        <div class="empty-state-icon">🛒</div>
        <h4>Carrinho vazio</h4>
        <p>Adicione produtos para fazer seu pedido.</p>
      </div>
    ` : `
      <div class="cart-list">
        ${S.cart.map(renderCartItem).join('')}
      </div>
      <div class="cart-summary">
        <div class="cart-summary-row">
          <span>Subtotal</span><span>${brl(sub)}</span>
        </div>
        <div class="cart-summary-row">
          <span>Taxa de entrega</span>
          <span>${fee === 0 ? '<strong style="color:var(--c-green)">Grátis</strong>' : brl(fee)}</span>
        </div>
        <div class="cart-summary-row total">
          <span>Total</span><span>${brl(total)}</span>
        </div>
      </div>
      <div class="cart-actions">
        <button class="btn-whatsapp" id="btn-wa-cart">
          ${waIcon(20)} Pedir pelo WhatsApp
        </button>
        <button class="btn-checkout" id="btn-go-checkout">
          Confirmar pedido →
        </button>
      </div>
    `}
  `;
}

function renderCartItem(item) {
  return `
    <div class="cart-item-card">
      <div class="cart-item-thumb">${productImage({ art: item.art, image: item.image, category: item.category, name: item.name })}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-unit">${brl(item.price)} / ${item.unit || 'un'}</div>
        <div class="cart-item-subtotal">${brl(item.price * item.qty)}</div>
      </div>
      <div class="cart-item-right">
        <div class="cart-qty-ctrl">
          <button class="cart-qty-btn" data-cid="${esc(item.id)}" data-delta="-1">−</button>
          <span class="cart-qty-val">${item.qty}</span>
          <button class="cart-qty-btn" data-cid="${esc(item.id)}" data-delta="1">+</button>
        </div>
        <button class="btn-cart-remove" data-cid="${esc(item.id)}">Remover</button>
      </div>
    </div>`;
}

/* CHECKOUT */
function renderCheckout() {
  const d   = S.checkout;
  const fee = S.settings.deliveryFee || 0;
  const total = cartTotal() + fee;
  const enabledPays = S.settings.lojaPayments || ['pix', 'credito', 'debito', 'dinheiro'];
  const PAY_OPTS = [
    { id: 'pix',      label: 'PIX',     icon: '📱' },
    { id: 'credito',  label: 'Crédito', icon: '💳' },
    { id: 'debito',   label: 'Débito',  icon: '💳' },
    { id: 'dinheiro', label: 'Dinheiro',icon: '💵' },
  ].filter(p => enabledPays.includes(p.id));

  return `
    <div class="view-header">
      <button class="btn-back" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="view-header-title">
        <h2>Finalizar pedido</h2>
        <p>Total: ${brl(total)}</p>
      </div>
    </div>
    <div class="checkout-form">
      <div class="checkout-section">
        <div class="checkout-section-title">Seus dados</div>
        <div class="form-field">
          <label>Nome completo *</label>
          <input type="text" id="co-name" placeholder="Ex.: João Silva" value="${esc(d.name)}" autocomplete="name" />
        </div>
        <div class="form-field">
          <label>WhatsApp *</label>
          <input type="tel" id="co-phone" placeholder="(92) 9 9999-9999" value="${esc(d.phone)}" autocomplete="tel" />
        </div>
      </div>

      <div class="checkout-section">
        <div class="checkout-section-title">Endereço de entrega</div>
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

      <div class="checkout-section">
        <div class="checkout-section-title">Forma de pagamento</div>
        <div class="payment-grid">
          ${PAY_OPTS.map(p => `
            <div class="payment-option${d.payment === p.id ? ' selected' : ''}" data-pay="${p.id}">
              <div class="payment-option-icon">${p.icon}</div>
              <div class="payment-option-label">${p.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="checkout-section">
        <div class="checkout-section-title">Observações (opcional)</div>
        <div class="form-field">
          <textarea id="co-notes" placeholder="Troco, observações sobre o pedido…">${esc(d.notes)}</textarea>
        </div>
      </div>

      <div class="checkout-section">
        <div class="cart-summary-row"><span>Subtotal</span><span>${brl(cartTotal())}</span></div>
        <div class="cart-summary-row">
          <span>Entrega</span>
          <span>${fee === 0 ? '<strong style="color:var(--c-green)">Grátis</strong>' : brl(fee)}</span>
        </div>
        <div class="cart-summary-row total"><span>Total</span><span>${brl(total)}</span></div>
      </div>

      <button class="btn-confirm" id="btn-confirm">Confirmar pedido</button>
    </div>
  `;
}

/* SUCCESS */
function renderSuccess() {
  const phone = getWAPhone();
  return `
    <div class="success-view">
      <div class="success-icon">✅</div>
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
  if (view === 'products')   wireProductCards(c);
  if (view === 'product')    wireProductDetail(c, params.product);
  if (view === 'cart')       wireCart(c);
  if (view === 'checkout')   wireCheckout(c);
  if (view === 'success')    wireSuccess(c);
}

function wireHome(c) {
  c.querySelector('#btn-see-all')?.addEventListener('click', () => go('categories'));

  c.querySelectorAll('.cat-chip').forEach(chip =>
    chip.addEventListener('click', () => go('products', { catId: chip.dataset.catid }))
  );

  const grid = c.querySelector('#products-grid');
  if (grid) wireProductCards(grid);

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
  c.querySelectorAll('.cat-card').forEach(card =>
    card.addEventListener('click', () => go('products', { catId: card.dataset.catid }))
  );
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

function wireProductDetail(c, product) {
  const btnMinus = c.querySelector('#qty-minus');
  const btnPlus  = c.querySelector('#qty-plus');
  const qtyVal   = c.querySelector('#qty-val');
  const addLabel = c.querySelector('#btn-add-label');
  const btnAdd   = c.querySelector('#btn-add-to-cart');

  function syncQty() {
    if (qtyVal)   qtyVal.textContent = S.qty;
    if (btnMinus) btnMinus.disabled  = S.qty <= 1;
    if (addLabel) addLabel.textContent = `Adicionar — ${brl(product.price * S.qty)}`;
  }

  btnMinus?.addEventListener('click', () => { if (S.qty > 1) { S.qty--; syncQty(); } });
  btnPlus?.addEventListener('click',  () => { S.qty++; syncQty(); });
  btnAdd?.addEventListener('click', () => {
    addToCart(product, S.qty);
    if (btnAdd) {
      btnAdd.innerHTML = '✓ Adicionado!';
      btnAdd.style.cssText = 'background:var(--c-green);color:white';
    }
    setTimeout(() => go('cart'), 750);
  });
}

function wireCart(c) {
  c.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid   = btn.dataset.cid;
      const delta = parseInt(btn.dataset.delta, 10);
      const item  = S.cart.find(i => i.id === cid);
      if (item) { setCartQty(cid, item.qty + delta); go('cart'); }
    });
  });
  c.querySelectorAll('.btn-cart-remove').forEach(btn => {
    btn.addEventListener('click', () => { removeFromCart(btn.dataset.cid); go('cart'); });
  });
  c.querySelector('#btn-wa-cart')?.addEventListener('click', () => {
    openWhatsApp(buildOrderMessage());
  });
  c.querySelector('#btn-go-checkout')?.addEventListener('click', () => {
    if (S.cart.length > 0) go('checkout');
  });
}

function wireCheckout(c) {
  c.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      S.checkout.payment = opt.dataset.pay;
      c.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  c.querySelector('#btn-confirm')?.addEventListener('click', async () => {
    const d = S.checkout;
    d.name       = c.querySelector('#co-name')?.value.trim()       || '';
    d.phone      = c.querySelector('#co-phone')?.value.trim()      || '';
    d.address    = c.querySelector('#co-address')?.value.trim()    || '';
    d.number     = c.querySelector('#co-number')?.value.trim()     || '';
    d.complement = c.querySelector('#co-complement')?.value.trim() || '';
    d.notes      = c.querySelector('#co-notes')?.value.trim()      || '';

    if (!d.name)    { alert('Informe seu nome completo.'); return; }
    if (!d.phone)   { alert('Informe seu número de WhatsApp.'); return; }
    if (!d.address) { alert('Informe o endereço de entrega.'); return; }

    const btn = c.querySelector('#btn-confirm');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      const fee = S.settings.deliveryFee || 0;
      S.lastOrderId = await createOrder({
        customer: {
          name: d.name,
          phone: d.phone.replace(/\D/g, ''),
          address: d.address,
          number: d.number,
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
      });
      S.cart = [];
      saveCart();
      updateCartBadge();
      S.navStack = [];
      go('success');
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = 'Confirmar pedido';
      alert('Erro ao enviar. Tente novamente ou use o botão do WhatsApp.');
    }
  });
}

function wireSuccess(c) {
  c.querySelector('#btn-wa-success')?.addEventListener('click', () => {
    const code = (S.lastOrderId || '').slice(-6).toUpperCase();
    openWhatsApp(`Olá! Acabei de fazer um pedido no app Empório GO. Código: #${code}`);
  });
  c.querySelector('#btn-keep-shopping')?.addEventListener('click', () => {
    S.navStack = [];
    go('home');
  });
}

/* ─── Init ───────────────────────────────────────────────────── */
async function init() {
  loadCart();
  await Promise.all([loadProducts(), loadSettings()]);

  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  splash.style.transition = 'opacity .4s';
  splash.style.opacity    = '0';
  setTimeout(() => splash.remove(), 420);
  app.classList.remove('hidden');

  renderBottomNav();
  go('home');
}

init().catch(console.error);
