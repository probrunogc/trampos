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

let state = {
  products: [],
  customers: [],
  search: '',
  category: 'all',
  cart: [],       // { productId, name, unitPrice, qty, stock }
  customer: null, // { id, name, ... }
  paymentMethod: 'dinheiro',
  discount: 0,
  deliveryFee: 0,
  needsDelivery: false,
  note: ''
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Outros'];
const PAYMENTS = [
  { id: 'dinheiro',   label: 'Dinheiro' },
  { id: 'pix',        label: 'PIX' },
  { id: 'debito',     label: 'Débito' },
  { id: 'credito',    label: 'Crédito' },
  { id: 'fiado',      label: 'Fiado' }
];

export async function render(root) {
  clearNode(root);

  // Reset cart on enter
  state.cart = [];
  state.customer = null;
  state.discount = 0;
  state.deliveryFee = 0;
  state.needsDelivery = false;
  state.note = '';
  state.paymentMethod = 'dinheiro';

  root.innerHTML = `
    <div class="pdv-layout">
      <!-- Produtos -->
      <div class="pdv-products">
        <div class="pdv-search-bar">
          <div class="search-wrap">
            ${icon('search')}
            <input id="pdv-search" type="search" placeholder="Buscar produto..." autofocus />
          </div>
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
          <div class="field" style="margin-bottom: var(--sp-3)">
            <span class="field-label">Forma de pagamento</span>
            <select id="pdv-payment" class="input">
              ${PAYMENTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
            </select>
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

  // Categorias chips
  const catBar = document.getElementById('pdv-cats');
  catBar.innerHTML = `<div class="pdv-cat-chip active" data-cat="all">Todas</div>` +
    CATEGORIES.map(c => `<div class="pdv-cat-chip" data-cat="${c}">${c}</div>`).join('');
  catBar.querySelectorAll('.pdv-cat-chip').forEach(chip => {
    chip.onclick = () => {
      catBar.querySelectorAll('.pdv-cat-chip').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      state.category = chip.dataset.cat;
      paintProducts();
    };
  });

  // Search
  document.getElementById('pdv-search').oninput = (e) => {
    state.search = e.target.value.toLowerCase();
    paintProducts();
  };


  // Customer
  document.getElementById('pdv-customer').onclick = openCustomerPicker;

  // Payment
  document.getElementById('pdv-payment').onchange = (e) => state.paymentMethod = e.target.value;

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

  // Scanner USB (C3TECH e similares — modo teclado HID)
  // O leitor injeta os dígitos muito rápido (< 50ms/char) e encerra com Enter.
  // Capturamos no document para funcionar mesmo sem o campo de busca focado.
  wireScanner();

  paintAll();
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
  const loading = !!prefillBarcode;
  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column: span 2">
        <span class="field-label">Nome do produto *</span>
        <input name="name" required placeholder="${loading ? '🔍 Buscando na Cosmos...' : 'Ex: Heineken Lata 350ml'}" ${loading ? 'disabled' : ''} />
      </label>
      <label class="field">
        <span class="field-label">Categoria *</span>
        <select name="category" required>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Preço (R$) *</span>
        <input name="price" type="number" min="0" step="0.01" required placeholder="0,00" />
      </label>
      <label class="field">
        <span class="field-label">Estoque inicial</span>
        <input name="stock" type="number" min="0" step="1" value="0" />
      </label>
      <label class="field">
        <span class="field-label">Estoque mínimo</span>
        <input name="minStock" type="number" min="0" step="1" value="6" />
      </label>
    </div>
    <div class="field-row">
      <label class="field" style="grid-column: span 2">
        <span class="field-label">Código de barras</span>
        <input name="barcode" value="${fmt.escape(prefillBarcode)}" placeholder="Opcional" />
      </label>
    </div>
  `;

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Cadastrar');

  const doSave = async () => {
    if (saveBtn.disabled) return;
    const nameVal  = form.querySelector('[name="name"]').value.trim();
    const priceVal = parseFloat(form.querySelector('[name="price"]').value) || 0;
    if (!nameVal)    { ui.toast('Informe o nome do produto.', 'warning'); return; }
    if (priceVal <= 0) { ui.toast('Informe o preço do produto.', 'warning'); return; }

    saveBtn.disabled = true;
    const payload = {
      name:     nameVal,
      category: form.querySelector('[name="category"]').value,
      price:    priceVal,
      stock:    parseInt(form.querySelector('[name="stock"]').value, 10) || 0,
      minStock: parseInt(form.querySelector('[name="minStock"]').value, 10) || 0,
      barcode:  form.querySelector('[name="barcode"]').value.trim(),
      active:   true
    };
    try {
      const created = await db.create('products', payload);
      state.products.push(created);
      state.products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      paintProducts();
      ui.toast(`"${payload.name}" cadastrado.`, 'success');
      ui.closeModal(true);
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar', 'danger');
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', doSave);
  form.addEventListener('submit', (e) => { e.preventDefault(); doSave(); });

  // Abre modal e dispara lookup em paralelo
  const modalPromise = ui.modal({ title: 'Cadastrar produto', body: form, footer: [cancelBtn, saveBtn] });

  if (prefillBarcode) {
    cosmosLookup(prefillBarcode).then(data => {
      const nameInput = form.querySelector('[name="name"]');
      if (!nameInput) return;
      nameInput.disabled = false;
      if (data?.description) {
        nameInput.value = data.description;
        const cat = cosmosCat(data.description);
        if (cat) form.querySelector('[name="category"]').value = cat;
        ui.toast('✔ Produto encontrado na Cosmos', 'success');
      } else {
        nameInput.placeholder = 'Ex: Heineken Lata 350ml';
        ui.toast('Produto não encontrado — preencha manualmente', 'info');
      }
      nameInput.focus();
    });
  }

  await modalPromise;
}

async function handleScannedBarcode(code) {
  // 1. Tenta encontrar pelo campo barcode
  let product = state.products.find(p => p.barcode === code);

  // 2. Se não achou, adiciona ao carrinho com confirmação ou abre cadastro
  if (!product) {
    // Flash visual na barra de busca com o código
    const searchInput = document.getElementById('pdv-search');
    if (searchInput) {
      searchInput.value = code;
      state.search = code;
      paintProducts();
    }

    const ok = await ui.confirm({
      title: `Código não encontrado`,
      message: `Código lido: <strong>${fmt.escape(code)}</strong><br><br>Nenhum produto com esse código no cadastro.<br>Deseja cadastrar agora?`,
      okText: 'Cadastrar produto',
      cancelText: 'Fechar'
    });

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

function paintAll() { paintProducts(); paintCart(); paintTotals(); }

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
      <div class="pdv-product ${out ? 'out' : ''}" data-id="${p.id}">
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

  grid.querySelectorAll('.pdv-product').forEach(card => {
    card.onclick = () => addToCart(card.dataset.id);
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
      qty: 1,
      stock: p.stock
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

function paintTotals() {
  const subtotal = state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = Math.max(0, state.discount || 0);
  const fee = state.needsDelivery ? (state.deliveryFee || 0) : 0;
  const total = Math.max(0, subtotal - discount + fee);

  document.getElementById('pdv-totals').innerHTML = `
    <div class="pdv-total-row">
      <span>Subtotal</span><span>${fmt.currency(subtotal)}</span>
    </div>
    <div class="pdv-total-row">
      <span>Desconto</span>
      <span>
        <input type="number" min="0" step="0.01" value="${discount}"
          id="pdv-discount" style="width:80px;padding:3px 6px;border:1px solid var(--line);background:transparent;border-radius:4px;color:var(--cream);text-align:right" />
      </span>
    </div>
    ${state.needsDelivery ? `
      <div class="pdv-total-row">
        <span>Taxa entrega</span>
        <span>
          <input type="number" min="0" step="0.01" value="${fee}"
            id="pdv-fee" style="width:80px;padding:3px 6px;border:1px solid var(--line);background:transparent;border-radius:4px;color:var(--cream);text-align:right" />
        </span>
      </div>` : ''}
    <div class="pdv-total-row grand">
      <span>TOTAL</span><span class="total-value">${fmt.currency(total)}</span>
    </div>
  `;
  const disc = document.getElementById('pdv-discount');
  if (disc) disc.onchange = (e) => { state.discount = parseFloat(e.target.value) || 0; paintTotals(); };
  const fi = document.getElementById('pdv-fee');
  if (fi) fi.onchange = (e) => { state.deliveryFee = parseFloat(e.target.value) || 0; paintTotals(); };
}

async function openCustomerPicker() {
  const list = state.customers;

  const wrap = el('div');
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
  wrap.querySelector('#cust-new').onclick = () => {
    ui.closeModal(false);
    ui.toast('Cadastre o cliente na aba Clientes e volte ao PDV.', 'info');
    location.hash = '/customers';
  };

  paintResults();
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

function confirmRichSale({ subtotal, discount, fee, total }) {
  return new Promise((resolve) => {
    const body = el('div');
    body.innerHTML = `
      <p style="color: var(--text-2); margin-bottom: var(--sp-4); line-height:1.5">
        Confirma a finalização desta venda?
      </p>
      <div style="background: rgba(0,0,0,0.3); padding: var(--sp-4); border-radius: var(--r-md);">
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Itens:</span><strong>${state.cart.reduce((s,i)=>s+i.qty,0)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Subtotal:</span><strong>${fmt.currency(subtotal)}</strong></div>
        ${discount ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Desconto:</span><strong>− ${fmt.currency(discount)}</strong></div>` : ''}
        ${fee ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Taxa entrega:</span><strong>+ ${fmt.currency(fee)}</strong></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px dashed var(--line);margin-top:6px;font-family:var(--font-brand);font-size:1.2rem">
          <span class="text-gold">TOTAL</span><span class="gold-text bold">${fmt.currency(total)}</span>
        </div>
        <div style="margin-top:var(--sp-3); font-size: .85rem; color: var(--text-3); line-height:1.5">
          Pagamento: <strong>${PAYMENTS.find(p => p.id === state.paymentMethod).label}</strong><br>
          Cliente: <strong>${state.customer ? fmt.escape(state.customer.name) : 'Avulso'}</strong>
          ${state.needsDelivery ? '<br>Será gerada <strong class="text-gold">nota de entrega</strong>.' : ''}
        </div>
      </div>
    `;
    const cancel = el('button', { class: 'btn btn-ghost', type: 'button',
      onClick: () => { ui.closeModal(false); resolve(false); } }, 'Cancelar');
    const ok = el('button', { class: 'btn btn-primary', type: 'button',
      onClick: () => { ui.closeModal(true); resolve(true); } }, 'Confirmar venda');
    ui.modal({ title: 'Finalizar venda', body, footer: [cancel, ok] });
  });
}

async function finishSale() {
  if (state.cart.length === 0) return;
  if (state.needsDelivery && !state.customer) {
    ui.toast('Para gerar nota de entrega, selecione um cliente.', 'warning');
    return;
  }

  const subtotal = state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = state.discount || 0;
  const fee = state.needsDelivery ? (state.deliveryFee || 0) : 0;
  const total = subtotal - discount + fee;

  // Confirmação visual rica
  const ok = await confirmRichSale({ subtotal, discount, fee, total });
  if (!ok) return;

  try {
    const seq = await db.nextSaleCode();
    const code = fmt.saleCode(seq);
    const user = auth.currentUser();

    const sale = {
      code,
      seq,
      items: state.cart.map(i => ({
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        unitPrice: i.unitPrice,
        subtotal: i.qty * i.unitPrice
      })),
      subtotal,
      discount,
      deliveryFee: fee,
      total,
      paymentMethod: state.paymentMethod,
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

    // Baixar estoque
    for (const it of state.cart) {
      const p = state.products.find(x => x.id === it.productId);
      if (p) {
        await db.update('products', p.id, { stock: Math.max(0, (p.stock || 0) - it.qty) });
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
    document.getElementById('pdv-delivery').checked = false;
    document.getElementById('pdv-payment').value = 'dinheiro';
    state.paymentMethod = 'dinheiro';
    // Recarregar produtos para refletir estoque
    state.products = (await db.list('products', { orderBy: 'name' })).filter(p => p.active !== false);
    updateCustomerUI();
    paintAll();
  } catch (err) {
    ui.toast(err.message || 'Erro ao finalizar', 'danger');
  }
}
