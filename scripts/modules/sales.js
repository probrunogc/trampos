/**
 * Módulo: Vendas (PDV)
 * Interface de venda rápida: categoria, busca, grade de produtos, carrinho,
 * cliente, finalização com forma de pagamento, geração de nota de entrega.
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';
import { printSaleCupom } from './deliveries.js';
import { productImage } from '../product-art.js';

export const meta = {
  id: 'sales',
  label: 'PDV / Vendas',
  icon: 'sales',
  title: 'PDV — Venda',
  subtitle: 'Registrar nova venda',
  roles: ['admin', 'vendedor']
};

let _modalOpen  = false; // guard contra duplo-scan
let _checkMode  = false; // modo verificação de preço (não adiciona ao carrinho)

let state = {
  products: [],
  customers: [],
  search: '',
  category: 'all',
  cart: [],       // { productId, name, unitPrice, qty, stock }
  customer: null, // { id, name, ... }
  paymentMethod: 'dinheiro',
  received: 0,
  discount: 0,
  deliveryFee: 0,
  needsDelivery: false,
  note: ''
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Cigarro', 'Outros'];
const PAYMENTS = [
  {
    id: 'dinheiro', label: 'Dinheiro', fee: 0,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 5v14M19 5v14"/></svg>`,
  },
  {
    id: 'pix', label: 'PIX', fee: 0,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },
  {
    id: 'debito', label: 'Débito', fee: 1.02,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/></svg>`,
  },
  {
    id: 'credito', label: 'Crédito', fee: 3.29,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><rect x="5" y="13" width="3" height="3" rx="0.5"/></svg>`,
  },
  {
    id: 'fiado', label: 'Fiado', fee: 0,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>`,
  },
];

const CIGARRO_BRANDS = [
  { id: 'lucky-strike',      name: 'Lucky Strike',      price: 10.00 },
  { id: 'dunhill-cereja',    name: 'Dunhill Cereja',    price:  8.00 },
  { id: 'dunhill-melancia',  name: 'Dunhill Melancia',  price:  8.00 },
  { id: 'dunhill-normal',    name: 'Dunhill Normal',    price:  8.00 },
  { id: 'rothmans-normal',   name: 'Rothmans Normal',   price:  8.00 },
  { id: 'rothmans-cereja',   name: 'Rothmans Cereja',   price:  8.00 },
  { id: 'rothmans-melancia', name: 'Rothmans Melancia', price:  8.00 },
  { id: 'black',             name: 'Black',             price: 12.00 },
  { id: '0800',              name: '0800',              price:  7.00 },
  { id: '0800-menta',        name: '0800 Menta',        price:  7.00 },
];

const DOSE_BRANDS = [
  { id: 'skarloff', name: 'Skarloff',          price: 5.00 },
  { id: 'sjb',      name: 'São João da Barra', price: 5.00 },
  { id: '51',       name: '51',                price: 6.00 },
  { id: '51-ouro',  name: '51 Ouro',           price: 8.00 },
  { id: 'polaka',   name: 'Polaka',            price: 5.00 },
];

export async function render(root) {
  clearNode(root);

  // Reset cart on enter
  _checkMode = false;
  state.cart = [];
  state.customer = null;
  state.discount = 0;
  state.deliveryFee = 0;
  state.needsDelivery = false;
  state.note = '';
  state.paymentMethod = 'dinheiro';
  state.received = 0;
  state.caixaId = null;
  state.caixaFundo = 0;

  root.innerHTML = `
    <div class="pdv-layout">
      <!-- Produtos -->
      <div class="pdv-products">
        <div class="pdv-search-bar">
          <div class="search-wrap">
            ${icon('search')}
            <input id="pdv-search" type="search" placeholder="Buscar produto..." autofocus />
          </div>
          <button id="pdv-check-btn" class="btn btn-ghost btn-sm" type="button" title="Verificar preço sem adicionar ao carrinho">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Check
          </button>
        </div>
        <div id="pdv-check-result" style="display:none;padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--line)"></div>
        <div style="display:flex;flex-wrap:nowrap;gap:6px;padding:10px 12px 0">
          <button id="pdv-quick-cigarro" type="button" class="pdv-quick-btn pdv-quick-btn--cigarro">
            <svg class="pdv-quick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="10.5" width="15" height="3" rx="1.5"/>
              <rect x="16" y="10.5" width="4.5" height="3" rx="1" fill="currentColor" opacity=".55" stroke="none"/>
              <line x1="20.5" y1="12" x2="23" y2="12"/>
              <path d="M19 9c0-.9 1.5-.9 1.5-2.2"/>
            </svg>
            <span class="pdv-quick-label">Cigarro</span>
            <span class="pdv-quick-sub">Retalho rapido</span>
          </button>
          <button id="pdv-quick-dose" type="button" class="pdv-quick-btn pdv-quick-btn--dose">
            <svg class="pdv-quick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 4h10l-1.8 12.5H8.8L7 4z"/>
              <line x1="9.5" y1="16.5" x2="14.5" y2="16.5"/>
              <line x1="11" y1="20" x2="13" y2="20"/>
            </svg>
            <span class="pdv-quick-label">Dose</span>
            <span class="pdv-quick-sub">Venda rapida</span>
          </button>
          <button id="pdv-quick-copao" type="button" class="pdv-quick-btn pdv-quick-btn--copao">
            <svg class="pdv-quick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 3h14l-1.5 10H6.5L5 3z"/>
              <path d="M8 21h8M12 17v4"/>
              <line x1="6.5" y1="13" x2="17.5" y2="13"/>
              <path d="M9 7c0 2 3 2 3 4"/>
            </svg>
            <span class="pdv-quick-label">Copão</span>
            <span class="pdv-quick-sub">Montar drink</span>
          </button>
          <button id="pdv-quick-kit" type="button" class="pdv-quick-btn pdv-quick-btn--kit">
            <svg class="pdv-quick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span class="pdv-quick-label">Kit</span>
            <span class="pdv-quick-sub">Combo c/ desconto</span>
          </button>
        </div>
        <div class="pdv-category-bar" id="pdv-cats"></div>
        <div class="pdv-grid" id="pdv-grid"></div>
      </div>

      <!-- Carrinho -->
      <aside class="pdv-cart">
        <div class="pdv-cart-head">
          <h3>${icon('cart', { size: 14 })} Carrinho</h3>
          <div class="pdv-customer-select" id="pdv-customer">
            ${icon('user')}
            <div class="pdv-customer-text">
              <div class="pdv-customer-name">Cliente avulso</div>
              <div class="pdv-customer-sub">Clique para selecionar</div>
            </div>
          </div>
        </div>
        <div class="pdv-cart-items" id="pdv-items"></div>
        <div class="pdv-cart-foot">
          <div class="pdv-totals" id="pdv-totals"></div>
          <div class="pdv-payment-section">
            <div class="pdv-payment-label">Pagamento</div>
            <div class="pdv-pay-grid" id="pdv-pay-grid">
              ${PAYMENTS.map(p => `
                <button type="button" class="pdv-pay-btn${p.id === 'dinheiro' ? ' active' : ''}" data-pay="${p.id}">
                  <span class="pdv-pay-icon">${p.icon}</span>
                  <span class="pdv-pay-label">${p.label}</span>
                </button>`).join('')}
            </div>
            <div id="pdv-troco-wrap" class="pdv-troco-section" style="display:none">
              <div class="pdv-troco-row">
                <span>Recebido</span>
                <input type="number" id="pdv-received" min="0" step="0.01" placeholder="0,00" class="pdv-troco-input" />
              </div>
              <div class="pdv-troco-row pdv-troco-change">
                <span>Troco</span>
                <strong id="pdv-troco-val">R$ 0,00</strong>
              </div>
            </div>
          </div>
          <label class="switch" style="margin-bottom: var(--sp-3)">
            <input type="checkbox" id="pdv-delivery" />
            <span class="switch-knob"></span>
            <span>Gerar nota de entrega</span>
          </label>
          <div class="flex gap-2">
            <button class="btn btn-ghost" id="pdv-clear" type="button">Limpar</button>
            <button class="btn btn-primary btn-block" id="pdv-finish" type="button" disabled>
              Finalizar venda
            </button>
          </div>
          <div class="pdv-caixa-bar">
            <button id="pdv-sangria" type="button" class="pdv-caixa-btn">Sangria</button>
            <span id="pdv-caixa-info" class="pdv-caixa-info">Verificando caixa...</span>
            <button id="pdv-fechar-caixa" type="button" class="pdv-caixa-btn">Fechar caixa</button>
            <button id="pdv-shortcuts-help" type="button" class="pdv-shortcuts-help-btn" title="Atalhos do teclado">?</button>
          </div>
        </div>
      </aside>
    </div>
  `;

  // Carregar dados
  const [products, customers] = await Promise.all([
    db.list('products', { orderBy: 'name' }),
    db.list('customers', { orderBy: 'name' })
  ]);
  state.products = products.filter(p => p.active !== false);
  state.customers = customers;

  // Categorias chips com Swiper (scroll com momentum + snap em telas touch)
  const catBar = document.getElementById('pdv-cats');
  catBar.className = 'swiper pdv-cat-swiper';
  catBar.innerHTML = `<div class="swiper-wrapper">
    <div class="swiper-slide pdv-cat-slide"><div class="pdv-cat-chip active" data-cat="all">Todas</div></div>
    ${CATEGORIES.map(c => `<div class="swiper-slide pdv-cat-slide"><div class="pdv-cat-chip" data-cat="${c}">${c}</div></div>`).join('')}
  </div>`;

  if (window.Swiper) {
    new window.Swiper('#pdv-cats', {
      slidesPerView: 'auto',
      freeMode: true,
      grabCursor: true,
      mousewheel: { forceToAxis: true },
      resistance: true,
      resistanceRatio: 0.7,
    });
  }

  catBar.querySelectorAll('.pdv-cat-chip').forEach(chip => {
    chip.onclick = () => {
      catBar.querySelectorAll('.pdv-cat-chip').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      state.category = chip.dataset.cat;
      paintProducts();
    };
  });

  // Search
  const searchEl = document.getElementById('pdv-search');
  searchEl.oninput = (e) => {
    state.search = e.target.value.toLowerCase();
    paintProducts();
  };
  // Quando o scanner termina de digitar o código, manda Enter — capturamos aqui
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchEl.value.trim();
      if (val) {
        handleScannedBarcode(val);
        searchEl.value = '';
        state.search = '';
      }
    }
  });

  // Botão Check — modo verificação de preço
  const checkBtn = document.getElementById('pdv-check-btn');
  checkBtn.onclick = () => {
    _checkMode = !_checkMode;
    if (_checkMode) {
      checkBtn.style.cssText = 'background:rgba(52,152,219,0.15);border-color:rgba(52,152,219,0.45);color:#7CC5EE;font-weight:700';
      checkBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> CHECK ATIVO`;
      searchEl.placeholder = 'Escaneie para verificar preço…';
      searchEl.focus();
    } else {
      checkBtn.removeAttribute('style');
      checkBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Check`;
      searchEl.placeholder = 'Buscar produto...';
      const panel = document.getElementById('pdv-check-result');
      if (panel) panel.style.display = 'none';
    }
  };

  // Customer
  document.getElementById('pdv-customer').onclick = openCustomerPicker;

  // Payment buttons
  document.getElementById('pdv-pay-grid').querySelectorAll('[data-pay]').forEach(btn => {
    btn.onclick = () => {
      state.paymentMethod = btn.dataset.pay;
      state.received = 0;
      document.getElementById('pdv-pay-grid').querySelectorAll('.pdv-pay-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.pay === state.paymentMethod));
      const recvInput = document.getElementById('pdv-received');
      if (recvInput) recvInput.value = '';
      paintTotals();
    };
  });
  document.getElementById('pdv-received').oninput = e => {
    state.received = parseFloat(e.target.value) || 0;
    paintTroco();
  };
  paintTroco();

  // Quick-add atalhos
  document.getElementById('pdv-quick-cigarro').onclick  = () => openBrandModal(CIGARRO_BRANDS, 'Cigarro — Retalho', { openLabel: 'Abrir carteira', category: 'Cigarro' });
  document.getElementById('pdv-quick-dose').onclick     = () => openBrandModal(DOSE_BRANDS,    'Dose — Venda',       { openLabel: 'Abrir garrafa', category: 'Dose'    });
  document.getElementById('pdv-quick-copao').onclick    = () => openCopaoModal();
  document.getElementById('pdv-quick-kit').onclick      = () => openKitModal();

  // Delivery toggle
  document.getElementById('pdv-delivery').onchange = (e) => {
    state.needsDelivery = e.target.checked;
    if (state.needsDelivery) {
      // Carregar taxa padrão de entrega
      db.get('settings', 'company').then(c => {
        state.deliveryFee = c?.deliveryFee || 0;
        paintTotals();
      });
    } else {
      state.deliveryFee = 0;
      paintTotals();
    }
  };

  // Clear
  document.getElementById('pdv-clear').onclick = async () => {
    if (state.cart.length === 0) return;
    const ok = await ui.confirm({
      title: 'Limpar carrinho?',
      message: 'Todos os itens serão removidos.',
      okText: 'Limpar', danger: true
    });
    if (ok) {
      state.cart = [];
      paintAll();
    }
  };

  // Finish
  document.getElementById('pdv-finish').onclick = finishSale;

  // Caixa operations
  document.getElementById('pdv-sangria').onclick     = openSangriaModal;
  document.getElementById('pdv-fechar-caixa').onclick = openFecharCaixaModal;
  document.getElementById('pdv-shortcuts-help').onclick = openShortcutsHelp;

  // Scanner USB (C3TECH e similares — modo teclado HID)
  // O leitor injeta os dígitos muito rápido (< 50ms/char) e encerra com Enter.
  // Capturamos no document para funcionar mesmo sem o campo de busca focado.
  wireScanner();
  wireShortcuts();

  paintAll();

  // Check / open caixa after page is painted
  checkOrOpenCaixa();
}

/* ─── Caixa (abertura, sangria, fechamento) ──────────────────── */
function _setCaixaInfo(text, clickable = false) {
  const el_ = document.getElementById('pdv-caixa-info');
  if (!el_) return;
  el_.textContent = text;
  el_.style.cursor = clickable ? 'pointer' : '';
  el_.title = clickable ? 'Clique para tentar novamente' : '';
  if (clickable) {
    el_.onclick = () => { el_.onclick = null; el_.style.cursor = ''; el_.title = ''; checkOrOpenCaixa(); };
  } else {
    el_.onclick = null;
  }
}

async function checkOrOpenCaixa(attempt = 1) {
  _setCaixaInfo(attempt > 1 ? `Verificando… (${attempt}/3)` : 'Verificando…');
  try {
    const list = await db.list('caixas', { where: { field: 'status', value: 'open' }, limit: 1 });
    if (list.length > 0) {
      const caixa = list[0];
      state.caixaId = caixa.id;
      state.caixaFundo = caixa.fundo || 0;
      const d = new Date(caixa.openedAt || caixa.createdAt);
      const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      _setCaixaInfo(`Aberto desde ${hm}`);
    } else {
      state.caixaId = null;
      _setCaixaInfo('Caixa fechado');
      promptAbrirCaixa();
    }
  } catch (err) {
    if (attempt < 3) {
      setTimeout(() => checkOrOpenCaixa(attempt + 1), 1200 * attempt);
    } else {
      _setCaixaInfo('↺ Erro — toque para tentar novamente', true);
      console.error('[caixa] checkOrOpenCaixa failed:', err?.message || err);
    }
  }
}

async function promptAbrirCaixa() {
  const body = el('div');
  body.innerHTML = `
    <p style="font-size:.85rem;color:var(--text-2);margin-bottom:var(--sp-3)">
      Nenhum caixa aberto. Informe o fundo inicial (dinheiro ja na gaveta).
    </p>
    <label class="field-label">Fundo de caixa (R$)</label>
    <input type="number" id="ca-fundo" class="field-input" min="0" step="0.01" placeholder="0,00" value="0">
  `;
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Agora nao');
  cancelBtn.onclick = () => { _setCaixaInfo('Caixa fechado'); ui.closeModal(null); };
  const openBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Abrir caixa');
  openBtn.onclick = async () => {
    const fundo = parseFloat(document.getElementById('ca-fundo').value) || 0;
    const user = auth.currentUser();
    openBtn.disabled = true;
    try {
      const caixa = await db.create('caixas', {
        status: 'open',
        openedAt: Date.now(),
        openedBy: user ? { id: user.id || user.uid, name: user.name } : null,
        fundo,
        totalSangrias: 0,
      });
      state.caixaId = caixa.id;
      state.caixaFundo = fundo;
      _setCaixaInfo('Caixa aberto agora');
      ui.closeModal(true);
      ui.toast('Caixa aberto.', 'success');
    } catch (err) {
      openBtn.disabled = false;
      ui.toast('Erro ao abrir caixa: ' + (err.message || 'Tente novamente.'), 'danger');
    }
  };
  ui.modal({ title: 'Abrir caixa', body, footer: [cancelBtn, openBtn], narrow: true });
}

async function openSangriaModal() {
  if (!state.caixaId) { ui.toast('Abra o caixa primeiro.', 'warning'); return; }
  const body = el('div');
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
      <div>
        <label class="field-label">Valor retirado (R$) <span style="color:var(--danger)">*</span></label>
        <input type="number" id="sg-amount" class="field-input" min="0.01" step="0.01" placeholder="0,00" autofocus>
      </div>
      <div>
        <label class="field-label">Motivo <span style="color:var(--danger)">*</span></label>
        <input type="text" id="sg-reason" class="field-input" placeholder="Ex: reforco do cofre, despesa operacional">
      </div>
    </div>
  `;
  body.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); } })
  );
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const confirmBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Continuar');
  confirmBtn.onclick = async () => {
    const amount = parseFloat(body.querySelector('#sg-amount').value) || 0;
    const reason = body.querySelector('#sg-reason').value.trim();
    if (amount <= 0) { ui.toast('Informe um valor maior que zero.', 'warning'); return; }
    if (!reason)     { ui.toast('O motivo e obrigatorio para sangria.', 'warning'); return; }

    // Senha substitui o modal de sangria (singleton) — valores ja capturados no closure
    const ok = await ui.confirmWithPassword({
      title: 'Confirmar sangria',
      message: `Retirada de ${fmt.currency(amount)}: ${reason}`,
      okText: 'Confirmar sangria',
      danger: true,
    });
    if (!ok) return;

    const user = auth.currentUser();
    try {
      await db.create('sangrias', {
        caixaId: state.caixaId,
        amount,
        reason,
        at: Date.now(),
        by: user ? { id: user.id || user.uid, name: user.name } : null,
      });
      const caixa = await db.get('caixas', state.caixaId);
      if (caixa) await db.update('caixas', state.caixaId, { totalSangrias: (caixa.totalSangrias || 0) + amount });
      ui.toast(`Sangria de ${fmt.currency(amount)} registrada.`, 'success');
    } catch (err) {
      ui.toast('Erro ao registrar sangria: ' + (err.message || 'Tente novamente.'), 'danger');
    }
  };
  ui.modal({ title: 'Sangria de caixa', body, footer: [cancelBtn, confirmBtn], narrow: true });
}

async function openFecharCaixaModal() {
  if (!state.caixaId) { ui.toast('Nenhum caixa aberto.', 'warning'); return; }

  const body = el('div');
  body.className = 'fc-wrap';
  body.innerHTML = `<div style="text-align:center;padding:var(--sp-5) 0;color:var(--text-3);font-size:.88rem">Calculando totais...</div>`;

  const cancelBtn  = el('button', { class: 'btn btn-ghost',   type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const printBtn   = el('button', { class: 'btn btn-ghost',   type: 'button' }, '🖨 Imprimir');
  printBtn.disabled = true;
  const fecharBtn  = el('button', { class: 'btn btn-danger',  type: 'button' }, 'Fechar caixa');
  fecharBtn.disabled = true;

  const fcAc = new AbortController();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !fecharBtn.disabled) { e.preventDefault(); fecharBtn.click(); }
  }, { signal: fcAc.signal });
  ui.modal({ title: 'Fechamento de caixa', body, footer: [cancelBtn, printBtn, fecharBtn] })
    .then(() => fcAc.abort());

  let sales, sangrias, caixa;
  try {
    [sales, sangrias, caixa] = await Promise.all([
      db.list('sales', { where: { field: 'caixaId', value: state.caixaId } }),
      db.list('sangrias', { where: { field: 'caixaId', value: state.caixaId } }),
      db.get('caixas', state.caixaId),
    ]);
  } catch (err) {
    body.innerHTML = `<p style="color:var(--danger);padding:var(--sp-3)">Erro ao carregar dados: ${err.message}</p>`;
    return;
  }

  const byMethod = {};
  for (const pm of PAYMENTS) byMethod[pm.id] = 0;
  let totalCount = 0;
  for (const s of sales) {
    if (s.status === 'cancelled') continue;
    byMethod[s.paymentMethod || 'dinheiro'] = (byMethod[s.paymentMethod || 'dinheiro'] || 0) + (s.total || 0);
    totalCount++;
  }
  const grandTotal     = Object.values(byMethod).reduce((a, b) => a + b, 0);
  const totalSangrias  = sangrias.reduce((s, sg) => s + (sg.amount || 0), 0);
  const fundo          = caixa?.fundo || 0;
  const dinheiroVendas = byMethod['dinheiro'] || 0;
  const expectedCash   = fundo + dinheiroVendas - totalSangrias;

  body.innerHTML = `
    <div class="fc-body">
      <div class="fc-section">
        <div class="fc-section-title">Vendas (${totalCount})</div>
        ${PAYMENTS.map(p => `
          <div class="fc-row">
            <span>${p.label}</span>
            <strong>${fmt.currency(byMethod[p.id] || 0)}</strong>
          </div>`).join('')}
        <div class="fc-row fc-row--total">
          <span>Total geral</span>
          <strong>${fmt.currency(grandTotal)}</strong>
        </div>
      </div>
      <div class="fc-section">
        <div class="fc-section-title">Controle de dinheiro</div>
        <div class="fc-row"><span>Fundo inicial</span><span>${fmt.currency(fundo)}</span></div>
        <div class="fc-row"><span>Vendas em dinheiro</span><span>+ ${fmt.currency(dinheiroVendas)}</span></div>
        <div class="fc-row fc-row--sangria"><span>Sangrias</span><span>- ${fmt.currency(totalSangrias)}</span></div>
        <div class="fc-row fc-row--expected"><span>Esperado na gaveta</span><strong>${fmt.currency(expectedCash)}</strong></div>
      </div>
      <div class="fc-section">
        <div class="fc-section-title">Contagem fisica</div>
        <div class="fc-row">
          <label for="fc-counted">Dinheiro contado (R$)</label>
          <input type="number" id="fc-counted" class="fc-counted-input" min="0" step="0.01" placeholder="0,00">
        </div>
        <div class="fc-row fc-row--diff" id="fc-diff" style="display:none">
          <span>Diferenca</span>
          <strong id="fc-diff-val"></strong>
        </div>
      </div>
    </div>
  `;

  fecharBtn.disabled = false;
  printBtn.disabled  = false;

  // Captura os dados para impressão (closure)
  const getPrintData = () => {
    const countedEl = document.getElementById('fc-counted');
    return { sales, sangrias, caixa, byMethod, grandTotal, totalCount, totalSangrias, fundo, expectedCash,
             counted: parseFloat(countedEl?.value) };
  };
  printBtn.onclick = () => printRelatorioFechamento(getPrintData());

  document.getElementById('fc-counted').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !fecharBtn.disabled) { e.preventDefault(); fecharBtn.click(); }
  });
  document.getElementById('fc-counted').oninput = function () {
    const counted = parseFloat(this.value);
    const diffRow = document.getElementById('fc-diff');
    const diffVal = document.getElementById('fc-diff-val');
    if (isNaN(counted)) { diffRow.style.display = 'none'; return; }
    const diff = counted - expectedCash;
    diffRow.style.display = '';
    diffVal.textContent = (diff >= 0 ? '+ ' : '- ') + fmt.currency(Math.abs(diff));
    diffVal.className = diff >= 0 ? 'fc-ok' : 'fc-err';
  };

  fecharBtn.onclick = async () => {
    const countedEl = document.getElementById('fc-counted');
    const counted = parseFloat(countedEl?.value);
    const diff = isNaN(counted) ? null : counted - expectedCash;
    fecharBtn.disabled = true;
    const user = auth.currentUser();
    try {
      await db.update('caixas', state.caixaId, {
        status: 'closed',
        closedAt: Date.now(),
        closedBy: user ? { id: user.id || user.uid, name: user.name } : null,
        summary: { ...byMethod, total: grandTotal, count: totalCount },
        totalSangrias,
        expectedCash,
        countedCash: isNaN(counted) ? null : counted,
        diff,
      });
      state.caixaId = null;
      ui.closeModal(true);
      ui.toast('Caixa fechado.', 'success');
      _setCaixaInfo('Caixa fechado');
      printRelatorioFechamento({ sales, sangrias, caixa, byMethod, grandTotal, totalCount, totalSangrias, fundo, expectedCash, counted });
      setTimeout(() => promptAbrirCaixa(), 3200);
    } catch (err) {
      fecharBtn.disabled = false;
      ui.toast('Erro ao fechar caixa: ' + (err.message || 'Tente novamente.'), 'danger');
    }
  };
}

/* ─── Relatório de Fechamento de Caixa ──────────────────────── */
function printRelatorioFechamento({ sales, sangrias, caixa, byMethod, grandTotal, totalCount, totalSangrias, fundo, expectedCash, counted }) {
  // Agrega por nome (produto mais vendido) e por categoria
  const nameMap = {};
  const catMap  = {};
  let totalItems = 0;

  for (const s of sales) {
    if (s.status === 'cancelled') continue;
    for (const it of (s.items || [])) {
      const qty = it.qty || 1;
      if (!nameMap[it.name]) nameMap[it.name] = 0;
      nameMap[it.name] += qty;
      const cat = it.category || 'Outros';
      catMap[cat] = (catMap[cat] || 0) + qty;
      totalItems += qty;
    }
  }

  const mostSold = Object.entries(nameMap).sort((a, b) => b[1] - a[1])[0];

  const CAT_ORDER = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Cigarro', 'Copão', 'Kit', 'Outros'];
  const catRows = CAT_ORDER
    .filter(c => catMap[c])
    .map(c => `<div class="print-row-indent"><span>${c}</span><span>${catMap[c]} un.</span></div>`)
    .join('');

  const now        = new Date();
  const dateStr    = now.toLocaleDateString('pt-BR');
  const timeStr    = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const openedAt   = caixa?.openedAt ? new Date(caixa.openedAt) : null;
  const openedStr  = openedAt ? openedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const operador   = caixa?.openedBy?.name || '—';
  const diff       = (counted != null && !isNaN(counted)) ? counted - expectedCash : null;

  const methodRows = PAYMENTS
    .map(p => `<div class="print-row"><span>${p.label}</span><span>${fmt.currency(byMethod[p.id] || 0)}</span></div>`)
    .join('');

  const cashCountLine = diff != null
    ? `<div class="print-row"><span>Dinheiro contado</span><span>${fmt.currency(counted)}</span></div>
       <div class="print-row print-strong"><span>Diferença</span><span>${diff >= 0 ? '+' : ''}${fmt.currency(diff)}</span></div>`
    : `<div class="print-row-field"><span>Dinheiro contado</span><span>R$</span></div>
       <div class="print-row-field"><span>Diferença</span><span>R$</span></div>`;

  const host = document.getElementById('print-host');
  host.innerHTML = `
    <div class="print-doc">

      <!-- ── Cabeçalho da marca ── -->
      <div class="print-medallion"><img src="assets/logo.png" alt=""></div>
      <div class="print-brand">EMPÓRIO DAS BEBIDAS</div>
      <div class="print-sub">Presidente Figueiredo — AM</div>
      <div class="print-since">★ &nbsp; SISTEMA GO &nbsp; ★</div>

      <div class="print-doc-title">Fechamento de Caixa</div>

      <!-- ── Informações do turno ── -->
      <div class="rel-infobox">
        <div class="print-row"><span>Data</span><span>${dateStr}</span></div>
        <div class="print-row"><span>Abertura</span><span>${openedStr}</span></div>
        <div class="print-row"><span>Fechamento</span><span>${timeStr}</span></div>
        <div class="print-row"><span>Operador</span><span>${operador}</span></div>
      </div>

      <!-- ── Total geral em destaque ── -->
      <div class="rel-total-box">
        <div class="rel-total-label">Total Geral do Dia</div>
        <div class="rel-total-value">${fmt.currency(grandTotal)}</div>
        <div class="rel-total-count">${totalCount} venda${totalCount !== 1 ? 's' : ''} realizadas</div>
      </div>

      <!-- ── Formas de pagamento ── -->
      <div class="rel-section-title">Formas de Pagamento</div>
      ${methodRows}

      <!-- ── Itens vendidos ── -->
      <div class="rel-section-title">Itens Vendidos</div>
      <div class="print-row-sum"><span>Total de itens</span><span>${totalItems} un.</span></div>
      ${catRows}

      <!-- ── Produto mais vendido ── -->
      ${mostSold ? `
      <div class="rel-highlight">
        <div class="rel-highlight-label">★ &nbsp; Produto Mais Vendido &nbsp; ★</div>
        <div class="rel-highlight-value">${mostSold[0]}</div>
        <div class="rel-highlight-qty">${mostSold[1]} unidades vendidas</div>
      </div>` : ''}

      <!-- ── Controle de caixa ── -->
      <div class="rel-section-title">Controle de Caixa</div>
      <div class="print-row"><span>Fundo inicial</span><span>${fmt.currency(fundo)}</span></div>
      <div class="print-row"><span>+ Dinheiro (vendas)</span><span>${fmt.currency(byMethod['dinheiro'] || 0)}</span></div>
      ${totalSangrias > 0 ? `<div class="print-row"><span>− Sangrias</span><span>− ${fmt.currency(totalSangrias)}</span></div>` : ''}
      <div class="print-row-sum"><span>Esperado na gaveta</span><span>${fmt.currency(expectedCash)}</span></div>
      ${cashCountLine}

      <!-- ── Termo de responsabilidade + assinatura ── -->
      <hr class="print-double-hr" style="margin-top:8pt">
      <div class="rel-sign-block">
        <div style="font-size:8pt;line-height:1.65;text-align:justify">
          Declaro que os valores acima foram devidamente conferidos e que
          o fechamento de caixa foi realizado corretamente nesta data.
        </div>
        <div style="margin-top:10pt;font-size:8.5pt">
          Pres. Figueiredo — AM, ${dateStr}
        </div>
        <div class="rel-sign-line">Assinatura do Operador</div>
        <div class="rel-sign-name">${operador}</div>
      </div>

      <hr class="print-hr" style="margin-top:14pt">
      <div class="print-foot">
        Empório das Bebidas · Sistema GO<br>
        Impresso em ${dateStr} às ${timeStr}
      </div>

    </div>
  `;

  window.print();
  setTimeout(() => { host.innerHTML = ''; }, 3000);
}

/* ─── Scanner USB (HID keyboard emulation) ───────────────────── */
// O leitor manda os dígitos em rajada (< 50ms entre chars) + Enter.
// Acumulamos num buffer e, no Enter ou após 120ms de silêncio, processamos.
let _scanBuf  = '';
let _scanTimer = null;

function wireScanner() {
  // Remove listener anterior se o módulo for re-renderizado
  if (window._scannerHandler) document.removeEventListener('keydown', window._scannerHandler);

  window._scannerHandler = (e) => {
    // Ignora se houver um modal aberto (confirmação de venda, "imprimir cupom?",
    // cadastro rápido etc.) — senão um scan abriria um segundo modal por cima,
    // sobrepondo o conteúdo e travando o fluxo.
    const mh = document.getElementById('modal-host');
    if (mh && !mh.classList.contains('hidden')) { _scanBuf = ''; return; }

    // Ignora se o foco estiver em input/textarea (digitação manual)
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Enter = fim do scan
    if (e.key === 'Enter') {
      if (_scanBuf.length >= 3) handleScannedBarcode(_scanBuf.trim());
      _scanBuf = '';
      clearTimeout(_scanTimer);
      return;
    }

    // Acumula apenas caracteres visíveis (dígitos, letras, traços)
    if (e.key.length === 1) {
      _scanBuf += e.key;
      clearTimeout(_scanTimer);
      // Timeout de segurança: se o leitor não mandar Enter, processa mesmo assim
      _scanTimer = setTimeout(() => {
        if (_scanBuf.length >= 3) handleScannedBarcode(_scanBuf.trim());
        _scanBuf = '';
      }, 120);
    }
  };

  document.addEventListener('keydown', window._scannerHandler);
}

function openShortcutsHelp() {
  const body = el('div');
  body.innerHTML = `
    <table class="shortcuts-table">
      <tbody>
        <tr><td class="sk-key">F1</td><td>Cigarro — Retalho rápido</td></tr>
        <tr><td class="sk-key">F2</td><td>Dose — Venda rápida</td></tr>
        <tr><td class="sk-key">F3</td><td>Finalizar venda</td></tr>
        <tr><td class="sk-key">F4</td><td>Sangria de caixa</td></tr>
        <tr><td class="sk-key">F6</td><td>Fechar caixa</td></tr>
        <tr><td class="sk-key">F8</td><td>Limpar carrinho</td></tr>
      </tbody>
    </table>
    <p style="font-size:.78rem;color:var(--text-3);margin-top:var(--sp-3);text-align:center">
      Atalhos funcionam quando nenhum campo de texto está selecionado.
    </p>
  `;
  const ok = el('button', { class: 'btn btn-primary', type: 'button' }, 'Entendido');
  ok.onclick = () => ui.closeModal(true);
  ui.modal({ title: 'Atalhos do teclado', body, footer: [ok], narrow: true });
}

function wireShortcuts() {
  if (window._pdvShortcutHandler) document.removeEventListener('keydown', window._pdvShortcutHandler);

  const selectPayment = (id) => document.querySelector(`[data-pay="${id}"]`)?.click();

  window._pdvShortcutHandler = (e) => {
    // Não ativa se houver modal aberto ou foco em campo de texto
    const mh = document.getElementById('modal-host');
    if (mh && !mh.classList.contains('hidden')) return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Impede browser back no Backspace
    if (e.key === 'Backspace') { e.preventDefault(); return; }

    if (e.key === 'F1') { e.preventDefault(); document.getElementById('pdv-quick-cigarro')?.click(); }
    if (e.key === 'F2') { e.preventDefault(); document.getElementById('pdv-quick-dose')?.click(); }
    if (e.key === 'F3') { e.preventDefault(); document.getElementById('pdv-finish')?.click(); }
    if (e.key === 'F4') { e.preventDefault(); document.getElementById('pdv-sangria')?.click(); }
    if (e.key === 'F6') { e.preventDefault(); document.getElementById('pdv-fechar-caixa')?.click(); }
    if (e.key === 'F8') { e.preventDefault(); document.getElementById('pdv-clear')?.click(); }

    // Teclas numéricas para método de pagamento
    if (e.key === '1') { e.preventDefault(); selectPayment('dinheiro'); }
    if (e.key === '2') { e.preventDefault(); selectPayment('pix'); }
    if (e.key === '3') { e.preventDefault(); selectPayment('debito'); }
    if (e.key === '4') { e.preventDefault(); selectPayment('credito'); }

    // Setas navegam entre botões de pagamento
    const payBtns = [...(document.getElementById('pdv-pay-grid')?.querySelectorAll('.pdv-pay-btn') || [])];
    if (payBtns.length && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const pi = payBtns.indexOf(document.activeElement);
      if (pi >= 0) {
        e.preventDefault();
        payBtns[(pi + (e.key === 'ArrowRight' ? 1 : -1) + payBtns.length) % payBtns.length].focus();
      }
    }
  };

  document.addEventListener('keydown', window._pdvShortcutHandler);
}

const COSMOS_TOKEN = '82haA2Xclw-x7pepzbU0Yg';

async function cosmosLookup(barcode) {
  try {
    const res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${barcode}.json`, {
      headers: { 'X-Cosmos-Token': COSMOS_TOKEN, 'User-Agent': 'Cosmos/1.0' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function cosmosCat(desc) {
  const d = (desc || '').toLowerCase();
  const map = [
    ['cerveja','Cerveja'],['chopp','Cerveja'],
    ['refrigerante','Refrigerante'],
    ['suco','Suco'],
    ['água','Água'],['agua','Água'],
    ['energético','Energético'],['energy','Energético'],
    ['vodka','Destilado'],['whisky','Destilado'],['whiskey','Destilado'],
    ['gin','Destilado'],['rum','Destilado'],['cachaça','Destilado'],['conhaque','Destilado'],
    ['vinho','Vinho'],
    ['dose','Dose'],
  ];
  return map.find(([k]) => d.includes(k))?.[1] || null;
}

async function openQuickProductForm(prefillBarcode = '') {
  _modalOpen = true;
  const form = el('form', { autocomplete: 'off' });

  // Barcode display (if scanned) or scan input (if opening fresh from PRODUTOS)
  const barcodeHtml = prefillBarcode
    ? `<div style="background:rgba(255,255,255,0.05);border:2px solid var(--gold-400,#d4af37);
                   border-radius:10px;padding:14px 20px;text-align:center;margin-bottom:var(--sp-4)">
         <div style="font-size:.65rem;letter-spacing:3px;color:var(--text-3,#888);text-transform:uppercase;margin-bottom:6px">Código escaneado</div>
         <div style="font-family:monospace;font-size:1.6rem;font-weight:700;letter-spacing:6px">${fmt.escape(prefillBarcode)}</div>
       </div>`
    : `<label class="field" style="margin-bottom:var(--sp-4)">
         <span class="field-label">Código de barras — escaneie ou digite</span>
         <input name="barcode" id="qf-barcode" autocomplete="off"
                placeholder="🔴 Aponte o leitor e escaneie…"
                style="font-size:1.1rem;letter-spacing:3px;text-align:center;font-family:monospace" />
       </label>`;

  form.innerHTML = `
    ${barcodeHtml}
    <label class="field" style="margin-bottom:var(--sp-3)">
      <span class="field-label">Nome do produto *</span>
      <input name="name" id="qf-name" autocomplete="off"
             placeholder="${prefillBarcode ? '🔍 Buscando na Cosmos…' : 'Ex: Heineken Lata 350ml'}"
             ${prefillBarcode ? 'disabled' : ''}
             style="font-size:1rem" />
    </label>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Categoria</span>
        <select name="category" id="qf-cat">
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="field-label">Preço (R$)</span>
        <input name="price" type="number" min="0" step="0.01" placeholder="0,00"
               style="max-width:110px" />
      </label>
    </div>
    <p class="field-hint" style="margin-top:4px;font-size:.75rem;color:var(--text-3,#888)">
      Preço e demais detalhes podem ser completados depois em Produtos.
    </p>
  `;

  const closeAndReset = () => { _modalOpen = false; ui.closeModal(false); };
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: closeAndReset }, 'Cancelar');
  const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Cadastrar produto');

  const doSave = async () => {
    if (saveBtn.disabled) return;
    const nameVal    = form.querySelector('[name="name"]').value.trim();
    const barcodeVal = (prefillBarcode || form.querySelector('[name="barcode"]')?.value || '').trim();

    if (!nameVal) { ui.toast('Informe o nome do produto.', 'warning'); form.querySelector('[name="name"]').focus(); return; }

    if (barcodeVal) {
      const dup = state.products.find(x => x.barcode === barcodeVal);
      if (dup) { ui.toast(`Código já cadastrado: "${dup.name}". Edite-o em Produtos.`, 'warning'); return; }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    try {
      const created = await db.create('products', {
        name:     nameVal,
        category: form.querySelector('[name="category"]').value,
        price:    parseFloat(form.querySelector('[name="price"]').value) || 0,
        stock:    0,
        minStock: 6,
        barcode:  barcodeVal,
        active:   true,
        createdAt: Date.now(),
      });
      state.products.push(created);
      state.products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      paintProducts();
      ui.toast(`✔ "${created.name}" cadastrado!`, 'success');
      _modalOpen = false;
      ui.closeModal(true);
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar.', 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cadastrar produto';
    }
  };

  saveBtn.addEventListener('click', doSave);
  form.addEventListener('submit', e => { e.preventDefault(); doSave(); });

  const modalPromise = ui.modal({
    title: 'Novo produto',
    body: form,
    footer: [cancelBtn, saveBtn],
  });

  if (prefillBarcode) {
    // Cosmos lookup in parallel — fills name + category when found
    cosmosLookup(prefillBarcode).then(data => {
      const nameEl = form.querySelector('#qf-name');
      const catEl  = form.querySelector('#qf-cat');
      if (!nameEl) return;
      nameEl.disabled = false;
      if (data?.description) {
        nameEl.value = data.description;
        if (data.brand?.name) {/* store brand hint for user */}
        const cat = cosmosCat(data.ncm?.description || data.description || '');
        if (cat && catEl) catEl.value = cat;
        ui.toast('✔ Produto encontrado na Cosmos', 'success');
      } else {
        nameEl.placeholder = 'Digite o nome do produto';
        ui.toast('Produto não encontrado — preencha o nome', 'info');
      }
      nameEl.focus();
    });
  } else {
    // Fresh form: focus barcode first, then on Enter go to name
    requestAnimationFrame(() => {
      const bcField = form.querySelector('#qf-barcode');
      if (bcField) {
        bcField.focus();
        bcField.addEventListener('keydown', async e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const code = bcField.value.trim();
          if (!code) return;
          const dup = state.products.find(x => x.barcode === code);
          if (dup) { ui.toast(`Código já cadastrado: "${dup.name}"`, 'warning'); return; }
          const nameEl = form.querySelector('#qf-name');
          nameEl.disabled = true;
          nameEl.placeholder = '🔍 Buscando…';
          const data = await cosmosLookup(code);
          nameEl.disabled = false;
          if (data?.description) {
            nameEl.value = data.description;
            const cat = cosmosCat(data.ncm?.description || data.description || '');
            if (cat) form.querySelector('#qf-cat').value = cat;
            ui.toast('✔ Produto encontrado na Cosmos', 'success');
          } else {
            nameEl.placeholder = 'Digite o nome do produto';
          }
          nameEl.focus();
        });
      }
    });
  }

  await modalPromise;
  _modalOpen = false;
}

async function handleScannedBarcode(code) {
  if (_modalOpen) return; // evita abrir segundo modal enquanto um já está aberto
  // Reforço: se qualquer modal estiver aberto, não processa o scan
  const mh = document.getElementById('modal-host');
  if (mh && !mh.classList.contains('hidden')) return;

  // 1. Tenta encontrar pelo campo barcode
  let product = state.products.find(p => p.barcode === code);

  // Modo verificação — mostra info sem adicionar ao carrinho
  if (_checkMode) {
    showCheckResult(product, code);
    const si = document.getElementById('pdv-search');
    if (si) { si.value = ''; state.search = ''; paintProducts(); }
    return;
  }

  // 2. Se não achou, adiciona ao carrinho com confirmação ou abre cadastro
  if (!product) {
    // Flash visual na barra de busca com o código
    const searchInput = document.getElementById('pdv-search');
    if (searchInput) {
      searchInput.value = code;
      state.search = code;
      paintProducts();
    }

    _modalOpen = true;
    const ok = await ui.confirm({
      title: `Produto não encontrado`,
      message: `Código: <strong style="font-family:monospace;font-size:1.1rem;letter-spacing:2px">${fmt.escape(code)}</strong><br><br>Deseja cadastrar esse produto agora?`,
      okText: 'Cadastrar',
      cancelText: 'Cancelar'
    });
    _modalOpen = false;

    if (ok) await openQuickProductForm(code);

    if (searchInput) { searchInput.value = ''; state.search = ''; paintProducts(); }
    return;
  }

  // 3. Produto encontrado — adiciona ao carrinho com feedback visual
  addToCart(product.id);

  // Limpa a busca para o grid voltar a mostrar todos os produtos
  const si = document.getElementById('pdv-search');
  if (si) { si.value = ''; state.search = ''; paintProducts(); }

  // Flash verde na barra de status
  ui.toast(`✔ ${product.name} adicionado`, 'success');

  // Pisca o card do produto se visível
  const card = document.querySelector(`[data-id="${product.id}"]`);
  if (card) {
    card.classList.add('scanner-hit');
    setTimeout(() => card.classList.remove('scanner-hit'), 600);
  }
}

function showCheckResult(product, code) {
  const panel = document.getElementById('pdv-check-result');
  if (!panel) return;
  panel.style.display = 'block';

  if (!product) {
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
                  background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:8px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <div style="font-weight:700;color:var(--danger);font-size:.95rem">Produto não cadastrado</div>
          <div style="font-family:monospace;font-size:.85rem;color:var(--text-2);margin-top:2px;letter-spacing:2px">${fmt.escape(code)}</div>
        </div>
      </div>`;
    return;
  }

  const hasPrice = product.price > 0;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;
                background:rgba(46,204,113,0.07);border:1px solid rgba(46,204,113,0.22);border-radius:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:1.05rem;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${fmt.escape(product.name)}
        </div>
        <div style="font-size:.76rem;color:var(--text-3);margin-top:3px">
          ${fmt.escape(product.category || '—')} &nbsp;·&nbsp;
          <span style="font-family:monospace">${fmt.escape(product.barcode || '(sem código)')}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:var(--font-brand);font-size:1.8rem;font-weight:700;line-height:1;
                    color:${hasPrice ? 'var(--gold-300)' : 'var(--danger)'}">
          ${hasPrice ? fmt.currency(product.price) : '⚠ SEM PREÇO'}
        </div>
        ${!hasPrice ? `<div style="font-size:.7rem;color:var(--danger);margin-top:3px">Definir preço em Produtos</div>` : ''}
      </div>
    </div>`;
}

function paintAll() { paintProducts(); paintCart(); paintTotals(); }

/* ─── Copão modal ────────────────────────────────────────────── */
function openCopaoModal() {
  const PRICES = [10, 20, 25, 30];
  let selected = null;

  const body = el('div');
  body.innerHTML = `
    <div style="padding:var(--sp-1) 0 var(--sp-2)">
      <div style="text-align:center;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:var(--sp-4)">Toque para selecionar o valor</div>
      <div class="cp-price-grid">
        ${PRICES.map(p => `
          <button class="cp-price-card" data-price="${p}" type="button">
            <span class="cp-price-val">R$&nbsp;${p}</span>
            <span class="cp-price-comma">,00</span>
          </button>`).join('')}
      </div>
    </div>
  `;

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const addBtn = el('button', { class: 'btn btn-primary', type: 'button', disabled: '' }, 'Selecione um valor');

  body.querySelectorAll('.cp-price-card').forEach(card => {
    card.onclick = () => {
      body.querySelectorAll('.cp-price-card').forEach(c => c.classList.remove('cp-price-card--active'));
      card.classList.add('cp-price-card--active');
      selected = parseFloat(card.dataset.price);
      addBtn.disabled = false;
      addBtn.textContent = `Adicionar — R$ ${selected.toFixed(2).replace('.', ',')}`;
    };
  });

  addBtn.onclick = () => {
    if (!selected) return;
    state.cart.push({ productId: null, name: 'Copão', unitPrice: selected, costPrice: 0, qty: 1, stock: null, category: 'Copão' });
    paintCart();
    paintTotals();
    ui.closeModal(true);
    ui.toast(`Copão R$ ${selected.toFixed(2).replace('.', ',')} adicionado.`, 'success');
  };

  const cpAc = new AbortController();
  document.addEventListener('keydown', (e) => {
    const cards = [...body.querySelectorAll('.cp-price-card')];
    const idx   = cards.indexOf(document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); cards[(idx + 1) % cards.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); cards[(idx - 1 + cards.length) % cards.length]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0) { cards[idx].click(); }
      else if (selected !== null && !addBtn.disabled) { addBtn.click(); }
    }
  }, { signal: cpAc.signal });
  ui.modal({ title: 'Copão', body, footer: [cancelBtn, addBtn], narrow: true })
    .then(() => cpAc.abort());
}

/* ─── Kit modal ──────────────────────────────────────────────── */
function openKitModal() {
  // energéticos 2L; fallback para todos se não houver
  let energeticos = state.products.filter(p => p.category === 'Energético' && /2\s?l(itro)?s?/i.test(p.name));
  if (!energeticos.length) energeticos = state.products.filter(p => p.category === 'Energético');
  const destilados = state.products.filter(p => p.category === 'Destilado');
  const gelos      = state.products.filter(p => p.name.toLowerCase().includes('gelo'));

  // closure state — evita leitura constante do DOM
  const qtys = { energetico: 1, destilado: 1, gelo: 6 };
  const sels = {
    energetico: energeticos[0]?.id || '',
    destilado:  destilados[0]?.id  || '',
    gelo:       gelos[0]?.id       || '',
  };

  const mkOpts = (list, selId) => list.map(p =>
    `<option value="${p.id}" data-price="${p.price}"${p.id === selId ? ' selected' : ''}>${fmt.escape(p.name)} — ${fmt.currency(p.price)}</option>`
  ).join('');

  const body = el('div');
  body.className = 'kt-body';

  const rows = [
    { key: 'energetico', label: 'Energético', list: energeticos },
    { key: 'destilado',  label: 'Destilado',  list: destilados  },
    { key: 'gelo',       label: 'Gelo',        list: gelos       },
  ];

  body.innerHTML = `
    <div class="kt-rows">
      ${rows.map(({ key, label, list }) => `
        <div class="kt-row">
          <div class="kt-row-top">
            <span class="kt-row-label">${label}</span>
            <div class="kt-stepper">
              <button class="kt-step-btn" data-key="${key}" data-dir="-1" type="button">−</button>
              <span class="kt-step-val" id="kt-qty-${key}">${qtys[key]}</span>
              <button class="kt-step-btn" data-key="${key}" data-dir="1" type="button">+</button>
            </div>
          </div>
          <select id="kt-${key}" class="field-input kt-select">
            <option value="">— nenhum —</option>
            ${mkOpts(list, sels[key])}
          </select>
        </div>`).join('')}

      <div class="kt-discount-row">
        <span class="kt-row-label">Desconto do kit</span>
        <div class="kt-disc-input-wrap">
          <input type="number" id="kt-discount" class="field-input" value="0" min="0" max="100" step="5" style="width:60px;text-align:center;padding:6px 8px">
          <span style="font-size:.85rem;color:var(--text-2)">%</span>
        </div>
      </div>
    </div>

    <div class="kt-summary">
      <div class="kt-summary-row">
        <span>Valor cheio</span>
        <span id="kt-subtotal">R$ 0,00</span>
      </div>
      <div class="kt-summary-saving" id="kt-saving-row" style="display:none">
        <span id="kt-saving-label">Desconto</span>
        <span id="kt-saving-val" style="color:var(--success)">− R$ 0,00</span>
      </div>
      <div class="kt-summary-total">
        <span>Preço do kit</span>
        <span id="kt-final">R$ 0,00</span>
      </div>
    </div>
  `;

  const getCompVal = (key, list) => {
    const qty = qtys[key] || 0;
    if (!sels[key] || !qty) return 0;
    return (list.find(p => p.id === sels[key])?.price || 0) * qty;
  };

  const repaint = () => {
    const subtotal =
      getCompVal('energetico', energeticos) +
      getCompVal('destilado',  destilados)  +
      getCompVal('gelo',       gelos);
    const disc   = parseFloat(body.querySelector('#kt-discount')?.value) || 0;
    const saving = subtotal * disc / 100;
    const final  = subtotal - saving;
    body.querySelector('#kt-subtotal').textContent   = fmt.currency(subtotal);
    body.querySelector('#kt-final').textContent      = fmt.currency(final);
    const savRow = body.querySelector('#kt-saving-row');
    savRow.style.display = disc > 0 ? '' : 'none';
    if (disc > 0) {
      body.querySelector('#kt-saving-label').textContent = `Desconto ${disc}%`;
      body.querySelector('#kt-saving-val').textContent   = `− ${fmt.currency(saving)}`;
    }
  };

  // Stepper buttons
  body.querySelectorAll('.kt-step-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      qtys[key] = Math.max(0, (qtys[key] || 0) + parseInt(btn.dataset.dir));
      body.querySelector(`#kt-qty-${key}`).textContent = qtys[key];
      repaint();
    };
  });

  // Select changes
  rows.forEach(({ key }) => {
    body.querySelector(`#kt-${key}`)?.addEventListener('change', e => {
      sels[key] = e.target.value;
      repaint();
    });
  });

  body.querySelector('#kt-discount')?.addEventListener('input', repaint);
  repaint();

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Adicionar ao carrinho');
  addBtn.onclick = () => {
    const disc = parseFloat(body.querySelector('#kt-discount').value) || 0;

    const comps = rows.map(({ key, list }) => {
      const qty = qtys[key] || 0;
      if (!sels[key] || !qty) return null;
      const prod = list.find(p => p.id === sels[key]);
      return prod ? { prod, qty } : null;
    }).filter(Boolean);

    if (!comps.length) { ui.toast('Selecione ao menos um componente.', 'warning'); return; }

    const subtotal = comps.reduce((s, c) => s + c.prod.price * c.qty, 0);
    const final    = parseFloat((subtotal * (1 - disc / 100)).toFixed(2));
    if (final <= 0) { ui.toast('Preço do kit inválido.', 'warning'); return; }

    const parts = comps.map(c => c.qty > 1 ? `${c.qty}× ${c.prod.name}` : c.prod.name);
    const name  = `Kit — ${parts.join(' + ')}`;

    state.cart.push({ productId: null, name, unitPrice: final, costPrice: parseFloat(subtotal.toFixed(2)), qty: 1, stock: null, category: 'Kit' });
    paintCart();
    paintTotals();
    ui.closeModal(true);
    ui.toast('Kit adicionado ao carrinho.', 'success');
  };

  const ktAc = new AbortController();
  document.addEventListener('keydown', (e) => {
    if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
  }, { signal: ktAc.signal });
  ui.modal({ title: 'Montar Kit', body, footer: [cancelBtn, addBtn], narrow: true })
    .then(() => ktAc.abort());
}

/* ─── Quick-add modal (Cigarro / Dose) — com animação ────────── */
/* ─── Brand-card modal (Cigarro / Dose) ─────────────────────── */
function openBrandModal(brands, title, opts = {}) {
  const prices = {};
  const qtys   = {};
  const armed  = {};
  brands.forEach(b => { prices[b.id] = b.price; qtys[b.id] = 0; });
  let panel = 'grid';

  // ── body: slider with two panels ──────────────────────────
  const wrap = el('div');
  wrap.className = 'bm-wrap';

  const slider = el('div');
  slider.className = 'bm-slider';
  wrap.appendChild(slider);

  const gridPanel   = el('div');
  gridPanel.className = 'bm-panel';
  const detailPanel = el('div');
  detailPanel.className = 'bm-panel';
  slider.appendChild(gridPanel);
  slider.appendChild(detailPanel);

  // ── shared footer buttons (shown/hidden per panel) ─────────
  const closeBtn  = el('button', { class: 'btn btn-ghost',    type: 'button' }, 'Fechar');
  closeBtn.onclick = () => ui.closeModal(null);

  const backBtn   = el('button', { class: 'btn btn-ghost',    type: 'button' }, '← Voltar');
  const addBtn    = el('button', { class: 'btn btn-primary',  type: 'button' }, 'Adicionar ao carrinho');

  const commitCart = () => {
    let added = 0;
    for (const b of brands) {
      const qty = qtys[b.id] || 0;
      if (qty <= 0) continue;
      const unitPrice = prices[b.id] ?? b.price;
      const existing = state.cart.find(i => i.productId == null && i.name === b.name);
      if (existing) { existing.qty += qty; }
      else { state.cart.push({ productId: null, name: b.name, unitPrice, costPrice: 0, qty, stock: null, category: opts.category || 'Outros' }); }
      added++;
    }
    if (added === 0) { ui.toast('Selecione ao menos um item.', 'warning'); return false; }
    paintCart();
    paintTotals();
    ui.closeModal(true);
    ui.toast(`${added} item(s) adicionado(s) ao carrinho`, 'success');
    return true;
  };
  addBtn.onclick = commitCart;

  // ── grid panel ─────────────────────────────────────────────
  const renderGrid = () => {
    const totalQty = Object.values(qtys).reduce((s, v) => s + v, 0);
    const totalVal = brands.reduce((s, b) => s + (qtys[b.id] || 0) * (prices[b.id] ?? b.price), 0);

    closeBtn.style.display  = '';
    backBtn.style.display   = 'none';
    addBtn.style.display    = totalQty > 0 ? '' : 'none';
    addBtn.textContent = totalQty > 0
      ? `Adicionar (${totalQty}x — ${fmt.currency(totalVal)})`
      : 'Adicionar ao carrinho';

    gridPanel.innerHTML = `<div class="bm-grid">${brands.map(b => {
      const q = qtys[b.id] || 0;
      return `
        <button class="bm-card${q > 0 ? ' bm-card--on' : ''}" data-bid="${b.id}" type="button">
          ${q > 0 ? `<span class="bm-badge">${q}</span>` : ''}
          <span class="bm-card-name">${fmt.escape(b.name)}</span>
          <span class="bm-card-price">${fmt.currency(prices[b.id] ?? b.price)}</span>
        </button>`;
    }).join('')}</div>`;

    gridPanel.querySelectorAll('.bm-card').forEach(card => {
      card.onclick = () => {
        const brand = brands.find(b => b.id === card.dataset.bid);
        if (!brand) return;
        if ((qtys[brand.id] || 0) === 0) qtys[brand.id] = 1; // começa com 1 por padrão
        showDetail(brand);
      };
    });
  };

  // ── detail panel ───────────────────────────────────────────
  const showDetail = (brand) => {
    panel = 'detail';
    slider.classList.add('bm-slide');
    closeBtn.style.display = 'none';
    addBtn.style.display   = 'none'; // usamos botão local no painel
    backBtn.style.display  = '';

    const repaintLocalAdd = () => {
      const localAdd = document.getElementById('bm-local-add');
      if (!localAdd) return;
      const qty   = qtys[brand.id] || 0;
      const price = prices[brand.id] ?? brand.price;
      if (qty > 0) {
        localAdd.disabled     = false;
        localAdd.textContent  = `Adicionar ${qty}× — ${fmt.currency(qty * price)}`;
        localAdd.style.opacity = '';
      } else {
        localAdd.disabled     = true;
        localAdd.textContent  = 'Aumente a quantidade acima';
        localAdd.style.opacity = '0.45';
      }
    };

    const openBtnHtml = opts.openLabel
      ? `<button id="bm-open" class="bm-open-btn" type="button">${fmt.escape(opts.openLabel)}</button>`
      : '';

    detailPanel.innerHTML = `
      <div class="bm-detail">
        <div class="bm-detail-name">${fmt.escape(brand.name)}</div>

        <div class="bm-field">
          <div class="bm-field-label">Preço por unidade (R$)</div>
          <input type="number" id="bm-price" class="bm-price-input"
                 value="${(prices[brand.id] ?? brand.price).toFixed(2)}"
                 step="0.50" min="0" inputmode="decimal">
        </div>

        <div class="bm-qty-row">
          <button class="bm-qty-btn" id="bm-dec" type="button">−</button>
          <span class="bm-qty-num" id="bm-qty">${qtys[brand.id] || 0}</span>
          <button class="bm-qty-btn bm-qty-btn--inc" id="bm-inc" type="button">+</button>
        </div>

        <button id="bm-local-add" class="btn btn-primary"
                type="button" style="width:100%;margin-top:14px;font-size:1rem;padding:12px 0"
                disabled>
          Aumente a quantidade acima
        </button>

        ${openBtnHtml}
      </div>`;

    document.getElementById('bm-price').oninput = function () {
      prices[brand.id] = parseFloat(this.value) || 0;
      repaintLocalAdd();
    };

    document.getElementById('bm-dec').onclick = () => {
      if ((qtys[brand.id] || 0) > 0) {
        qtys[brand.id]--;
        const q = document.getElementById('bm-qty'); if (q) q.textContent = qtys[brand.id];
        repaintLocalAdd();
      }
    };
    document.getElementById('bm-inc').onclick = () => {
      qtys[brand.id] = (qtys[brand.id] || 0) + 1;
      const q = document.getElementById('bm-qty'); if (q) q.textContent = qtys[brand.id];
      repaintLocalAdd();
    };

    document.getElementById('bm-local-add').onclick = () => {
      const qty = qtys[brand.id] || 0;
      if (qty <= 0) return;
      const unitPrice = prices[brand.id] ?? brand.price;
      const existing = state.cart.find(i => i.productId == null && i.name === brand.name);
      if (existing) { existing.qty += qty; }
      else { state.cart.push({ productId: null, name: brand.name, unitPrice, costPrice: 0, qty, stock: null, category: opts.category || 'Outros' }); }
      paintCart();
      paintTotals();
      ui.closeModal(true);
      ui.toast(`${brand.name} × ${qty} adicionado`, 'success');
    };

    repaintLocalAdd(); // reflete qty inicial (cards abrem com qty=1)

    if (opts.openLabel) {
      const openBtn = document.getElementById('bm-open');
      if (openBtn) {
        const id = brand.id;
        openBtn.onclick = async () => {
          if (!armed[id]) {
            armed[id] = true;
            openBtn.classList.add('armed');
            openBtn.textContent = 'Confirmar?';
            armed[`_t_${id}`] = setTimeout(() => {
              delete armed[id];
              openBtn.classList.remove('armed');
              openBtn.textContent = opts.openLabel;
            }, 3000);
          } else {
            clearTimeout(armed[`_t_${id}`]);
            delete armed[id];
            openBtn.disabled    = true;
            openBtn.textContent = '✓ Registrado';
            const user = auth.currentUser();
            const tipo = opts.openLabel.toLowerCase().includes('garrafa') ? 'garrafa' : 'carteira';
            db.create('aberturas', {
              tipo,
              brand:       brand.name,
              brandId:     brand.id,
              operator:    user?.name || 'Operador',
              operatorId:  user?.id   || user?.uid || null,
              caixaId:     state.caixaId || null,
              createdAt:   Date.now(),
            }).catch(() => {});
            ui.toast(`${opts.openLabel} registrado — ${brand.name}`, 'success');
          }
        };
      }
    }
  };

  backBtn.onclick = () => {
    panel = 'grid';
    slider.classList.remove('bm-slide');
    renderGrid();
  };

  // ── keyboard nav ───────────────────────────────────────────
  const bmAc = new AbortController();
  document.addEventListener('keydown', (e) => {
    const onInput = ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if (panel === 'grid') {
      if (onInput) return;
      const cards = [...gridPanel.querySelectorAll('.bm-card')];
      if (!cards.length) return;
      const idx = cards.indexOf(document.activeElement);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); cards[(idx + 1) % cards.length].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); cards[(idx - 1 + cards.length) % cards.length].focus();
      }
    } else {
      if (onInput) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault(); document.getElementById('bm-inc')?.click();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault(); document.getElementById('bm-dec')?.click();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const la = document.getElementById('bm-local-add');
        if (la && !la.disabled) la.click();
      } else if (e.key === 'Backspace') {
        e.preventDefault(); backBtn.click();
      }
    }
  }, { signal: bmAc.signal });

  // ── initial render ─────────────────────────────────────────
  renderGrid();
  ui.modal({ title, body: wrap, footer: [closeBtn, backBtn, addBtn], narrow: true })
    .then(() => bmAc.abort());
}

function openQuickAdd(category, title, opts = {}) {
  const prods = state.products.filter(p => p.category === category);
  if (prods.length === 0) {
    ui.toast(`Nenhum produto cadastrado em "${category}". Cadastre em Produtos primeiro.`, 'warning', { duration: 4500 });
    return;
  }

  const qtys   = {};
  const prices = {};
  const armed  = {};
  prods.forEach(p => { qtys[p.id] = 0; prices[p.id] = p.price; });

  const body = el('div');
  body.className = 'qa-body';

  const totalBar = el('div');
  totalBar.className = 'qa-total hidden';

  const updateTotalBar = () => {
    const totalQty = Object.values(qtys).reduce((s, v) => s + v, 0);
    const totalVal = prods.reduce((s, p) => s + (qtys[p.id] || 0) * (prices[p.id] ?? p.price), 0);
    if (totalQty > 0) {
      totalBar.className = 'qa-total';
      totalBar.innerHTML = `<span><strong>${totalQty}</strong> item(s) selecionado(s)</span><span class="qa-total-val">${fmt.currency(totalVal)}</span>`;
    } else {
      totalBar.className = 'qa-total hidden';
      totalBar.innerHTML = '';
    }
  };

  const updateRow = (id) => {
    const q = qtys[id];
    const row = body.querySelector(`[data-qid="${id}"]`);
    if (!row) return;

    row.classList.toggle('qa-item--active', q > 0);

    const countEl = row.querySelector('.qa-count');
    if (countEl) {
      countEl.textContent = q;
      countEl.classList.toggle('qa-count--pos', q > 0);
      if (q > 0) {
        countEl.classList.remove('qa-pop');
        void countEl.offsetWidth;
        countEl.classList.add('qa-pop');
      }
    }

    const decBtn = row.querySelector('.qa-btn-dec');
    if (decBtn) decBtn.disabled = q === 0;

    const p = prods.find(x => x.id === id);
    const unitPrice = prices[id] ?? p?.price ?? 0;
    let subEl = row.querySelector('.qa-subtotal');
    if (p && q > 0) {
      if (!subEl) {
        subEl = el('div');
        subEl.className = 'qa-subtotal';
        row.appendChild(subEl);
      }
      subEl.textContent = fmt.currency(q * unitPrice);
    } else if (subEl) {
      subEl.remove();
    }

    updateTotalBar();
  };

  const wireButtons = () => {
    body.querySelectorAll('.qa-btn-dec').forEach(btn => {
      btn.onclick = () => {
        const id = btn.closest('[data-qid]').dataset.qid;
        if (qtys[id] > 0) { qtys[id]--; updateRow(id); }
      };
    });
    body.querySelectorAll('.qa-btn-inc').forEach(btn => {
      btn.onclick = () => {
        const id = btn.closest('[data-qid]').dataset.qid;
        qtys[id]++;
        updateRow(id);
      };
    });
    body.querySelectorAll('.qa-item-info').forEach(area => {
      area.onclick = (e) => {
        if (e.target.closest('.qa-price-input') || e.target.closest('.qa-open-btn')) return;
        const id = area.closest('[data-qid]').dataset.qid;
        qtys[id]++;
        updateRow(id);
      };
    });
    body.querySelectorAll('.qa-price-input').forEach(input => {
      input.onclick = (e) => e.stopPropagation();
      input.oninput = () => {
        const id = input.dataset.pid;
        prices[id] = parseFloat(input.value) || 0;
        updateRow(id);
      };
    });
    if (opts.openLabel) {
      body.querySelectorAll('.qa-open-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.dataset.pid;
          if (!armed[id]) {
            armed[id] = true;
            btn.classList.add('armed');
            btn.textContent = 'Confirmar?';
            armed[`_t_${id}`] = setTimeout(() => {
              delete armed[id];
              btn.classList.remove('armed');
              btn.textContent = opts.openLabel;
            }, 3000);
          } else {
            clearTimeout(armed[`_t_${id}`]);
            delete armed[id];
            btn.classList.remove('armed');
            const p = prods.find(x => x.id === id);
            if (!p) return;
            btn.disabled = true;
            btn.textContent = '…';
            try {
              await db.runStockTransaction([{ productId: p.id, qty: 1 }]);
              const local = state.products.find(x => x.id === p.id);
              if (local) local.stock = Math.max(0, (local.stock || 0) - 1);
              btn.textContent = '✓ Aberto';
              const stockEl = body.querySelector(`[data-qid="${id}"] .qa-stock-info`);
              const newStock = local?.stock ?? 0;
              if (stockEl) {
                stockEl.className = `qa-stock-info${newStock <= 0 ? ' stock-out' : ''}`;
                stockEl.textContent = newStock <= 0 ? '⚠ Sem estoque' : `Estoque: ${newStock}`;
              }
              ui.toast(`${opts.openLabel} — ${p.name} baixado do estoque ✓`, 'success');
            } catch (err) {
              btn.disabled = false;
              btn.textContent = opts.openLabel;
              ui.toast('Erro ao baixar estoque: ' + (err.message || 'Tente novamente.'), 'danger');
            }
          }
        };
      });
    }
  };

  body.innerHTML = prods.map(p => {
    const out = (p.stock ?? 0) <= 0;
    const openBtn = opts.openLabel
      ? `<button class="qa-open-btn" data-pid="${p.id}" type="button">${fmt.escape(opts.openLabel)}</button>`
      : '';
    return `
      <div class="qa-item" data-qid="${p.id}">
        <div class="qa-item-info">
          <div class="qa-item-name">${fmt.escape(p.name)}</div>
          <div class="qa-item-meta">
            <label class="qa-price-label">R$<input class="qa-price-input" type="number" step="0.50" min="0" data-pid="${p.id}" value="${p.price.toFixed(2)}"></label>
            <span class="qa-stock-info${out ? ' stock-out' : ''}">${out ? '⚠ Sem estoque' : `Estoque: ${p.stock}`}</span>
          </div>
          ${openBtn}
        </div>
        <div class="qa-counter">
          <button class="qa-btn qa-btn-dec" disabled>−</button>
          <span class="qa-count">0</span>
          <button class="qa-btn qa-btn-inc">+</button>
        </div>
      </div>
    `;
  }).join('');
  body.appendChild(totalBar);
  wireButtons();

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);

  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Adicionar ao carrinho');
  addBtn.onclick = () => {
    let added = 0;
    for (const [productId, qty] of Object.entries(qtys)) {
      if (qty <= 0) continue;
      const p = prods.find(x => x.id === productId);
      if (!p) continue;
      const unitPrice = prices[productId] ?? p.price;
      const existing = state.cart.find(i => i.productId === productId);
      if (existing) {
        existing.qty += qty;
      } else {
        state.cart.push({ productId: p.id, name: p.name, unitPrice, costPrice: p.costPrice || 0, qty, stock: p.stock, category: p.category || 'Outros' });
      }
      added++;
    }
    if (added === 0) { ui.toast('Selecione ao menos um produto.', 'warning'); return; }
    paintCart();
    paintTotals();
    ui.closeModal(true);
    ui.toast(`${added} produto(s) adicionado(s) ao carrinho ✓`, 'success');
  };

  ui.modal({ title, body, footer: [cancelBtn, addBtn], narrow: true });
}

/* ─── Baixa manual de estoque (Abrir carteira / garrafa) ─────── */
async function openStockDeduct(category, title, emoji) {
  const prods = state.products.filter(p => p.category === category);
  if (prods.length === 0) {
    ui.toast(`Nenhum produto de ${category} cadastrado.`, 'warning');
    return;
  }

  const body = el('div');
  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:.83rem;color:var(--text-3);line-height:1.5;margin-bottom:0';
  hint.innerHTML = 'Selecione o produto que está sendo aberto. <strong>1 unidade será baixada do estoque.</strong>';
  body.appendChild(hint);

  const list = el('div');
  list.className = 'sd-list';
  list.innerHTML = prods.map(p => {
    const out = (p.stock ?? 0) <= 0;
    return `
      <button class="sd-item" data-id="${p.id}" type="button">
        <span class="sd-item-emoji">${emoji}</span>
        <div class="sd-info">
          <div class="sd-name">${fmt.escape(p.name)}</div>
          <div class="sd-stock ${out ? 'out' : ''}">
            ${out ? '⚠ Sem estoque cadastrado' : `Estoque atual: ${p.stock}`}
          </div>
        </div>
      </button>
    `;
  }).join('');
  body.appendChild(list);

  list.querySelectorAll('.sd-item').forEach(btn => {
    btn.onclick = async () => {
      const p = prods.find(x => x.id === btn.dataset.id);
      if (!p) return;

      const ok = await ui.confirm({
        title,
        message: `Baixar <strong>1 unidade</strong> de <strong>${fmt.escape(p.name)}</strong> do estoque?`,
        okText: 'Confirmar abertura',
      });
      if (!ok) return;

      try {
        await db.runStockTransaction([{ productId: p.id, qty: 1 }]);
        const local = state.products.find(x => x.id === p.id);
        if (local) local.stock = Math.max(0, (local.stock || 0) - 1);
        ui.toast(`${emoji} ${p.name} — 1 unidade baixada do estoque.`, 'success');
        ui.closeModal(true);
      } catch (err) {
        ui.toast('Erro ao baixar estoque: ' + (err.message || 'Tente novamente.'), 'danger');
      }
    };
  });

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Fechar');
  cancelBtn.onclick = () => ui.closeModal(null);

  await ui.modal({ title, body, footer: [cancelBtn], narrow: true });
}

function paintProducts() {
  const grid = document.getElementById('pdv-grid');
  let arr = state.products;
  if (state.category !== 'all') arr = arr.filter(p => p.category === state.category);
  if (state.search) arr = arr.filter(p =>
    (p.name || '').toLowerCase().includes(state.search) ||
    (p.brand || '').toLowerCase().includes(state.search) ||
    (p.barcode || '').includes(state.search)
  );

  if (arr.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">
      ${icon('search', { size: 48 })}
      <h4>Nenhum produto encontrado</h4>
      <p>Tente outra busca ou categoria.</p>
    </div>`;
    return;
  }

  grid.innerHTML = arr.map(p => {
    const out = (p.stock || 0) <= 0;
    const low = !out && p.minStock != null && p.stock <= p.minStock;
    return `
      <div class="pdv-product ${out ? 'out' : ''}" data-id="${p.id}" data-category="${p.category || ''}">
        ${productImage(p, { cls: 'pdv-product-img' })}
        <div class="pdv-product-cat">${fmt.escape(p.category || '')}</div>
        <div class="pdv-product-name">${fmt.escape(p.name)}</div>
        <div class="pdv-product-price">${fmt.currency(p.price)}</div>
        <div class="pdv-product-stock ${out ? 'zero' : low ? 'low' : ''}">
          ${out ? 'Esgotado' : `Estoque: ${p.stock}`}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.pdv-product').forEach((card, i) => {
    const cat = card.dataset.category;
    const imgDiv = card.querySelector('.pdv-product-img');
    if (imgDiv) {
      if (cat === 'Cigarro') {
        const positions = ['18%', '35%', '55%', '72%'];
        const delays   = ['0s', '0.9s', '1.8s', '0.45s'];
        positions.forEach((x, s) => {
          const el = document.createElement('span');
          el.className = 'pdv-smoke';
          el.style.setProperty('--x', x);
          el.style.setProperty('--d', delays[s]);
          imgDiv.appendChild(el);
        });
      } else if (cat === 'Cerveja') {
        const frost = document.createElement('div');
        frost.className = 'pdv-frost';
        imgDiv.appendChild(frost);
      }
    }
    card.onclick = () => addToCart(card.dataset.id);
    card.animate([
      { opacity: 0, transform: 'translateY(10px) scale(0.97)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 200, delay: Math.min(i * 28, 280), easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' });
  });
}

function addToCart(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const existing = state.cart.find(i => i.productId === productId);
  if (existing) {
    if (p.stock > 0 && existing.qty + 1 > p.stock) {
      ui.toast(`Atenção: estoque pode ser insuficiente (${p.stock} cadastrado).`, 'warning');
    }
    existing.qty += 1;
  } else {
    if (p.stock <= 0) ui.toast(`Atenção: "${p.name}" sem estoque cadastrado.`, 'warning');
    state.cart.push({
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      costPrice: p.costPrice || 0,
      qty: 1,
      stock: p.stock,
      category: p.category || 'Outros'
    });
  }
  paintCart();
  paintTotals();
}

function paintCart() {
  const c = document.getElementById('pdv-items');
  if (state.cart.length === 0) {
    c.innerHTML = `<div class="pdv-cart-empty">
      ${icon('cart', { size: 56 })}
      <div>Carrinho vazio.<br>Clique nos produtos para adicionar.</div>
    </div>`;
    document.getElementById('pdv-finish').disabled = true;
    return;
  }
  c.innerHTML = state.cart.map((i, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${fmt.escape(i.name)}</div>
        <div class="cart-item-price">${fmt.currency(i.unitPrice)} · estoque ${i.stock}</div>
      </div>
      <div class="cart-item-controls">
        <button class="cart-qty-btn" data-dec="${idx}">−</button>
        <span class="cart-qty">${i.qty}</span>
        <button class="cart-qty-btn" data-inc="${idx}">+</button>
        <button class="cart-item-remove" data-rm="${idx}" title="Remover">${icon('close', { size: 14 })}</button>
      </div>
      <div class="cart-item-total">${fmt.currency(i.qty * i.unitPrice)}</div>
    </div>
  `).join('');

  // Animar último item adicionado
  const cartItems = c.querySelectorAll('.cart-item');
  if (cartItems.length) {
    cartItems[cartItems.length - 1].animate([
      { opacity: 0, transform: 'translateX(14px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 150, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' });
  }

  c.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const i = state.cart[+b.dataset.inc];
    if (i.qty + 1 > i.stock) { ui.toast('Estoque insuficiente.', 'warning'); return; }
    i.qty += 1; paintCart(); paintTotals();
  });
  c.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
    const idx = +b.dataset.dec;
    const i = state.cart[idx];
    i.qty -= 1;
    if (i.qty <= 0) state.cart.splice(idx, 1);
    paintCart(); paintTotals();
  });
  c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    state.cart.splice(+b.dataset.rm, 1);
    paintCart(); paintTotals();
  });

  document.getElementById('pdv-finish').disabled = false;
}

function _calcTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = Math.max(0, state.discount || 0);
  const deliveryFee = state.needsDelivery ? (state.deliveryFee || 0) : 0;
  const payMethod = PAYMENTS.find(p => p.id === state.paymentMethod);
  const payFeeRate = payMethod?.fee || 0;
  const base = Math.max(0, subtotal - discount + deliveryFee);
  const paymentFee = Math.round(base * payFeeRate) / 100;
  const total = Math.max(0, base + paymentFee);
  return { subtotal, discount, deliveryFee, payFeeRate, paymentFee, payMethod, base, total };
}

function paintTotals() {
  const { subtotal, discount, deliveryFee, payFeeRate, paymentFee, payMethod, total } = _calcTotals();
  const inputStyle = 'width:80px;padding:3px 6px;border:1px solid var(--line);background:transparent;border-radius:4px;color:var(--cream);text-align:right';

  document.getElementById('pdv-totals').innerHTML = `
    <div class="pdv-total-row">
      <span>Subtotal</span><span>${fmt.currency(subtotal)}</span>
    </div>
    <div class="pdv-total-row">
      <span>Desconto</span>
      <span>
        <input type="number" min="0" step="0.01" value="${discount}"
          id="pdv-discount" style="${inputStyle}" />
      </span>
    </div>
    ${state.needsDelivery ? `
      <div class="pdv-total-row">
        <span>Taxa entrega</span>
        <span>
          <input type="number" min="0" step="0.01" value="${deliveryFee}"
            id="pdv-fee" style="${inputStyle}" />
        </span>
      </div>` : ''}
    ${payFeeRate > 0 ? `
      <div class="pdv-total-row" style="font-size:.82rem;color:var(--text-2)">
        <span>Taxa ${payMethod.label} (${payFeeRate}%)</span>
        <span>+ ${fmt.currency(paymentFee)}</span>
      </div>` : ''}
    <div class="pdv-total-row grand">
      <span>TOTAL</span><span class="total-value">${fmt.currency(total)}</span>
    </div>
  `;
  const totalEl = document.querySelector('.total-value');
  if (totalEl) {
    totalEl.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.09)' },
      { transform: 'scale(1)' }
    ], { duration: 220, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
  }

  const disc = document.getElementById('pdv-discount');
  if (disc) disc.onchange = (e) => { state.discount = parseFloat(e.target.value) || 0; paintTotals(); };
  const fi = document.getElementById('pdv-fee');
  if (fi) fi.onchange = (e) => { state.deliveryFee = parseFloat(e.target.value) || 0; paintTotals(); };
  paintTroco();
}

function paintTroco() {
  const wrap = document.getElementById('pdv-troco-wrap');
  if (!wrap) return;
  const isDinheiro = state.paymentMethod === 'dinheiro';
  wrap.style.display = isDinheiro ? '' : 'none';
  if (!isDinheiro) return;
  const { total } = _calcTotals();
  const recv = state.received || 0;
  const troco = recv >= total && recv > 0 ? recv - total : 0;
  const trocoEl = document.getElementById('pdv-troco-val');
  if (trocoEl) {
    trocoEl.textContent = fmt.currency(troco);
    trocoEl.className = troco > 0 ? 'text-gold' : '';
  }
}

async function openCustomerPicker() {
  const list = state.customers;
  const wrap = el('div');

  const showList = () => {
    wrap.innerHTML = `
      <div class="table-search" style="margin-bottom: var(--sp-3); max-width: none">
        ${icon('search')}
        <input id="cust-search" type="search" placeholder="Buscar cliente por nome ou telefone..." />
      </div>
      <div id="cust-results" style="max-height: 360px; overflow-y: auto"></div>
      <div style="margin-top: var(--sp-4); display: flex; justify-content: space-between; gap: var(--sp-2)">
        <button type="button" class="btn btn-ghost" id="cust-walkin">Venda avulsa (sem cliente)</button>
        <button type="button" class="btn btn-secondary" id="cust-new">+ Novo cliente</button>
      </div>
    `;

    const paintResults = () => {
      const q = wrap.querySelector('#cust-search').value.toLowerCase();
      const arr = q ? list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      ) : list;
      const box = wrap.querySelector('#cust-results');
      if (arr.length === 0) {
        box.innerHTML = `<div class="empty-state"><h4>Nenhum cliente encontrado</h4></div>`;
        return;
      }
      box.innerHTML = arr.map(c => `
        <div class="list-row" data-id="${c.id}" style="cursor:pointer; margin-bottom: 6px">
          <div class="user-chip-avatar" style="width: 32px; height: 32px; font-size: .8rem">
            ${(c.name || '?').charAt(0).toUpperCase()}
          </div>
          <div class="list-row-body">
            <div class="list-row-title">${fmt.escape(c.name)}</div>
            <div class="list-row-sub">${fmt.phone(c.phone)} · ${fmt.escape(c.address?.neighborhood || 'Sem bairro')}</div>
          </div>
        </div>
      `).join('');
      box.querySelectorAll('.list-row').forEach(r => r.onclick = () => {
        state.customer = list.find(c => c.id === r.dataset.id) || null;
        updateCustomerUI();
        ui.closeModal(true);
      });
    };

    wrap.querySelector('#cust-search').oninput = paintResults;
    wrap.querySelector('#cust-walkin').onclick = () => {
      state.customer = null;
      updateCustomerUI();
      ui.closeModal(true);
    };
    wrap.querySelector('#cust-new').onclick = showCreate;
    paintResults();
    wrap.querySelector('#cust-search').focus();
  };

  const showCreate = () => {
    wrap.innerHTML = `
      <div style="margin-bottom: var(--sp-3)">
        <label class="field-label">Nome *</label>
        <input id="qc-name" class="field-input" type="text" placeholder="Nome completo" autocomplete="off" />
      </div>
      <div style="margin-bottom: var(--sp-3)">
        <label class="field-label">Telefone *</label>
        <input id="qc-phone" class="field-input" type="tel" placeholder="(92) 99999-9999" autocomplete="off" />
      </div>
      <div id="qc-err" style="color: var(--danger); font-size: .8rem; min-height: 1.2em; margin-bottom: var(--sp-3)"></div>
      <div style="display: flex; justify-content: space-between; gap: var(--sp-2)">
        <button type="button" class="btn btn-ghost" id="qc-back">&#8592; Voltar</button>
        <button type="button" class="btn btn-primary" id="qc-save">Criar cliente</button>
      </div>
    `;
    wrap.querySelector('#qc-name').focus();
    wrap.querySelector('#qc-back').onclick = showList;
    wrap.querySelector('#qc-save').onclick = async () => {
      const name = (wrap.querySelector('#qc-name').value || '').trim();
      const phone = (wrap.querySelector('#qc-phone').value || '').trim();
      const errEl = wrap.querySelector('#qc-err');
      if (!name) { errEl.textContent = 'Nome obrigatório.'; return; }
      if (!phone) { errEl.textContent = 'Telefone obrigatório.'; return; }
      const saveBtn = wrap.querySelector('#qc-save');
      saveBtn.disabled = true;
      try {
        const cust = await db.create('customers', { name, phone, createdAt: Date.now() });
        state.customers.unshift(cust);
        state.customer = cust;
        updateCustomerUI();
        ui.closeModal(true);
      } catch {
        errEl.textContent = 'Erro ao salvar cliente. Tente novamente.';
        saveBtn.disabled = false;
      }
    };
  };

  showList();
  await ui.modal({ title: 'Selecionar cliente', body: wrap, footer: '', wide: true });
}

function updateCustomerUI() {
  const box = document.getElementById('pdv-customer');
  if (state.customer) {
    box.innerHTML = `
      ${icon('user')}
      <div class="pdv-customer-text">
        <div class="pdv-customer-name">${fmt.escape(state.customer.name)}</div>
        <div class="pdv-customer-sub">${fmt.phone(state.customer.phone)}</div>
      </div>
      <button class="btn-icon-ghost" id="pdv-customer-clear" title="Remover">${icon('close', { size: 14 })}</button>
    `;
    box.querySelector('#pdv-customer-clear').onclick = (e) => {
      e.stopPropagation();
      state.customer = null;
      updateCustomerUI();
    };
  } else {
    box.innerHTML = `
      ${icon('user')}
      <div class="pdv-customer-text">
        <div class="pdv-customer-name">Cliente avulso</div>
        <div class="pdv-customer-sub">Clique para selecionar</div>
      </div>
    `;
  }
  box.onclick = openCustomerPicker;
}

function confirmRichSale({ subtotal, discount, fee, payFeeRate, paymentFee, total }) {
  const payLabel = PAYMENTS.find(p => p.id === state.paymentMethod)?.label || state.paymentMethod;
  const recv = state.paymentMethod === 'dinheiro' ? (state.received || 0) : 0;
  const troco = recv >= total && recv > 0 ? recv - total : 0;

  const body = el('div');
  body.innerHTML = `
    <p style="color: var(--text-2); margin-bottom: var(--sp-4); line-height:1.5">
      Confirma a finalização desta venda?
    </p>
    <div style="background: rgba(0,0,0,0.3); padding: var(--sp-4); border-radius: var(--r-md);">
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Itens:</span><strong>${state.cart.reduce((s,i)=>s+i.qty,0)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Subtotal:</span><strong>${fmt.currency(subtotal)}</strong></div>
      ${discount ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Desconto:</span><strong style="color:var(--gold-300)">− ${fmt.currency(discount)}</strong></div>` : ''}
      ${fee ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Taxa entrega:</span><strong>+ ${fmt.currency(fee)}</strong></div>` : ''}
      ${paymentFee > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem;color:var(--text-2)"><span>Taxa ${payLabel} (${payFeeRate}%):</span><strong>+ ${fmt.currency(paymentFee)}</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px dashed var(--line);margin-top:6px;font-family:var(--font-brand);font-size:1.2rem">
        <span class="text-gold">TOTAL</span><span class="gold-text bold">${fmt.currency(total)}</span>
      </div>
      ${recv > 0 ? `
      <div style="border-top:1px dashed var(--line);margin-top:6px;padding-top:8px">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:.9rem"><span>Recebido:</span><strong>${fmt.currency(recv)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:.9rem"><span>Troco:</span><strong class="text-gold">${fmt.currency(troco)}</strong></div>
      </div>` : ''}
      <div style="margin-top:var(--sp-3); font-size: .85rem; color: var(--text-3); line-height:1.7">
        Pagamento: <strong>${fmt.escape(payLabel)}</strong><br>
        Cliente: <strong>${state.customer ? fmt.escape(state.customer.name) : 'Avulso'}</strong>
        ${state.needsDelivery ? '<br>Será gerada <strong class="text-gold">nota de entrega</strong>.' : ''}
      </div>
    </div>
  `;
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => ui.closeModal(false) }, 'Cancelar');
  const ok = el('button', { class: 'btn btn-primary', type: 'button',
    onClick: () => ui.closeModal(true) }, 'Confirmar venda');
  const csAc = new AbortController();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
  }, { signal: csAc.signal });
  return ui.modal({ title: 'Finalizar venda', body, footer: [cancel, ok] })
    .then(r => { csAc.abort(); return r === true; });
}

async function finishSale() {
  if (state.cart.length === 0) return;
  if (state.needsDelivery && !state.customer) {
    ui.toast('Para gerar nota de entrega, selecione um cliente.', 'warning');
    return;
  }

  const { subtotal, discount, deliveryFee: fee, payFeeRate, paymentFee, total } = _calcTotals();

  // Confirmação visual rica
  const ok = await confirmRichSale({ subtotal, discount, fee, payFeeRate, paymentFee, total });
  if (!ok) return;

  try {
    const seq = await db.nextSaleCode();
    const code = fmt.saleCode(seq);
    const user = auth.currentUser();

    const sale = {
      code,
      seq,
      caixaId: state.caixaId || null,
      items: state.cart.map(i => ({
        productId: i.productId,
        name: i.name,
        category: i.category || 'Outros',
        qty: i.qty,
        unitPrice: i.unitPrice,
        unitCost: i.costPrice || 0,
        subtotal: i.qty * i.unitPrice
      })),
      subtotal,
      discount,
      deliveryFee: fee,
      paymentFee,
      paymentFeeRate: payFeeRate,
      total,
      paymentMethod: state.paymentMethod,
      received: state.paymentMethod === 'dinheiro' ? (state.received || 0) : null,
      troco: state.paymentMethod === 'dinheiro' ? Math.max(0, (state.received || 0) - total) : null,
      customer: state.customer ? {
        id: state.customer.id,
        name: state.customer.name,
        phone: state.customer.phone,
        address: state.customer.address
      } : null,
      delivery: state.needsDelivery ? {
        status: 'pending',
        delivererId: null,
        delivererName: null,
        assignedAt: null,
        deliveredAt: null,
        fee
      } : null,
      status: state.needsDelivery ? 'pending_delivery' : 'paid',
      seller: user ? { id: user.id || user.uid, name: user.name } : null,
      note: state.note
    };

    const created = await db.create('sales', sale);

    // Baixar estoque via Firestore transaction — garante atomicidade mesmo com
    // múltiplos caixas vendendo o mesmo item simultaneamente.
    // A venda já foi gravada (operação crítica); se a baixa de estoque falhar,
    // não trava o caixa — apenas avisa para ajuste manual depois.
    const stockItems = state.cart.filter(i => i.productId).map(i => ({ productId: i.productId, qty: i.qty }));
    if (stockItems.length) {
      try {
        await db.runStockTransaction(stockItems);
      } catch (stockErr) {
        ui.toast('Venda registrada, mas houve falha ao baixar o estoque. Confira o estoque depois.', 'warning', { duration: 6000 });
      }
    }

    ui.toast(`Venda ${code} registrada!`, 'success', { title: 'Sucesso' });

    // Oferece imprimir cupom
    const printNow = await ui.confirm({
      title: 'Imprimir cupom?',
      message: 'Deseja imprimir o cupom da venda agora?',
      okText: 'Imprimir',
      cancelText: 'Mais tarde'
    });
    if (printNow) {
      await printSaleCupom(created.id);
    }

    // Reset
    state.cart = [];
    state.customer = null;
    state.discount = 0;
    state.deliveryFee = 0;
    state.needsDelivery = false;
    state.note = '';
    state.paymentMethod = 'dinheiro';
    state.received = 0;
    document.getElementById('pdv-delivery').checked = false;
    document.getElementById('pdv-pay-grid').querySelectorAll('.pdv-pay-btn')
      .forEach(b => b.classList.toggle('active', b.dataset.pay === 'dinheiro'));
    const recvInput = document.getElementById('pdv-received');
    if (recvInput) recvInput.value = '';
    paintTotals();
    // Recarregar produtos para refletir estoque
    state.products = (await db.list('products', { orderBy: 'name' })).filter(p => p.active !== false);
    updateCustomerUI();
    paintAll();
  } catch (err) {
    ui.toast(err.message || 'Erro ao finalizar', 'danger');
  }
}
