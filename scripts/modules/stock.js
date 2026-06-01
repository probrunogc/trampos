/**
 * Módulo: Entrada Rápida de Estoque
 * Pensado para o operador de caixa: escaneia ou digita o código de barras,
 * atualiza a quantidade em estoque ou cadastra o produto rapidamente.
 */
import { db, fmt, ui, icon, el, clearNode } from '../core.js';

export const meta = {
  id: 'stock',
  label: 'Estoque Rápido',
  icon: 'stock',
  title: 'Entrada de Estoque',
  subtitle: 'Escanear produto e registrar entrada',
  roles: ['admin', 'vendedor']
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Outros'];

let _products = [];
let _scanBuf   = '';
let _scanTimer = null;

export async function render(root) {
  clearNode(root);
  _products = (await db.list('products', { orderBy: 'name' })).filter(p => p.active !== false);

  root.innerHTML = `
    <div class="page-header">
      <h3>${icon('stock', { size: 18 })} Entrada Rápida de Estoque</h3>
    </div>

    <div class="stock-scanner-card">
      <div class="stock-scanner-icon">${icon('barcode', { size: 40 })}</div>
      <p class="stock-scanner-hint">Aponte o leitor para o produto <strong>ou</strong> digite o código / nome abaixo</p>
      <div class="search-wrap stock-search-wrap">
        ${icon('search')}
        <input id="stock-search" type="search" placeholder="Código de barras ou nome do produto…" autofocus autocomplete="off" />
      </div>
      <div id="stock-results"></div>
    </div>

    <div class="stock-history-wrap">
      <h4 class="stock-history-title">Entradas recentes desta sessão</h4>
      <div id="stock-history" class="stock-history"></div>
    </div>
  `;

  const searchInput = document.getElementById('stock-search');
  searchInput.oninput = (e) => searchProducts(e.target.value.trim());

  // Scanner USB — captura keydown no document enquanto este módulo estiver ativo
  wireScanner(root);
}

/* ─── Scanner USB ─────────────────────────────────────────────── */
function wireScanner(root) {
  if (window._stockScannerHandler) document.removeEventListener('keydown', window._stockScannerHandler);

  window._stockScannerHandler = (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return;
    // Se o foco estiver no campo de busca, deixa ele receber normalmente
    if (document.activeElement?.id === 'stock-search') return;

    if (e.key === 'Enter') {
      if (_scanBuf.length >= 3) handleScan(_scanBuf.trim());
      _scanBuf = '';
      clearTimeout(_scanTimer);
      return;
    }
    if (e.key.length === 1) {
      _scanBuf += e.key;
      clearTimeout(_scanTimer);
      _scanTimer = setTimeout(() => {
        if (_scanBuf.length >= 3) handleScan(_scanBuf.trim());
        _scanBuf = '';
      }, 120);
    }
  };
  document.addEventListener('keydown', window._stockScannerHandler);
}

function handleScan(code) {
  // Passa o código para o campo de busca e dispara a busca
  const input = document.getElementById('stock-search');
  if (!input) return;
  input.value = code;
  input.focus();
  searchProducts(code);
}

/* ─── Busca de produto ────────────────────────────────────────── */
function searchProducts(q) {
  const resultsEl = document.getElementById('stock-results');
  if (!resultsEl) return;
  if (!q) { resultsEl.innerHTML = ''; return; }

  const lower = q.toLowerCase();
  const byBarcode = _products.filter(p => p.barcode === q);
  const byName    = _products.filter(p =>
    (p.name || '').toLowerCase().includes(lower) ||
    (p.brand || '').toLowerCase().includes(lower)
  );

  // Prioriza match exato de barcode
  const results = byBarcode.length ? byBarcode : byName;

  if (results.length === 0) {
    resultsEl.innerHTML = `
      <div class="stock-no-result">
        <p>Nenhum produto encontrado para <strong>${fmt.escape(q)}</strong></p>
        <button class="btn btn-primary" id="btn-new-product">
          ${icon('plus', { size: 14 })} Cadastrar novo produto
        </button>
      </div>
    `;
    document.getElementById('btn-new-product').onclick = () => openNewProduct(q);
    return;
  }

  // Se achou exatamente 1 por barcode, abre direto
  if (byBarcode.length === 1) {
    resultsEl.innerHTML = '';
    openStockEntry(byBarcode[0]);
    return;
  }

  resultsEl.innerHTML = `
    <div class="stock-result-list">
      ${results.slice(0, 8).map(p => `
        <div class="stock-result-item" data-id="${p.id}">
          <div class="stock-result-name">${fmt.escape(p.name)}</div>
          <div class="stock-result-sub">${fmt.escape(p.brand || p.category || '')} · Estoque: <strong>${p.stock ?? 0}</strong></div>
        </div>
      `).join('')}
    </div>
  `;
  resultsEl.querySelectorAll('.stock-result-item').forEach(item => {
    item.onclick = () => {
      const p = _products.find(x => x.id === item.dataset.id);
      if (p) openStockEntry(p);
    };
  });
}

/* ─── Modal de entrada de estoque ────────────────────────────── */
function openStockEntry(product) {
  const body = el('div');
  body.innerHTML = `
    <div class="stock-entry-product">
      <div class="stock-entry-name">${fmt.escape(product.name)}</div>
      ${product.brand ? `<div class="stock-entry-brand">${fmt.escape(product.brand)}</div>` : ''}
      <div class="stock-entry-current">
        Estoque atual: <strong>${product.stock ?? 0}</strong> unidades
      </div>
    </div>

    <div class="stock-entry-form">
      <label class="field">
        <span class="field-label">Tipo de movimento</span>
        <select id="mov-type" class="input">
          <option value="add">Entrada — adicionar ao estoque</option>
          <option value="set">Ajuste — definir estoque total</option>
          <option value="remove">Saída — remover do estoque</option>
        </select>
      </label>
      <label class="field" style="margin-top:16px">
        <span class="field-label">Quantidade *</span>
        <input id="mov-qty" type="number" min="0" step="1" value="1" class="input" style="font-size:2rem;font-weight:700;text-align:center;padding:12px" />
      </label>
      <div id="mov-preview" class="stock-entry-preview"></div>
    </div>
  `;

  const updatePreview = () => {
    const type = body.querySelector('#mov-type').value;
    const qty  = parseInt(body.querySelector('#mov-qty').value) || 0;
    const cur  = product.stock ?? 0;
    let novo;
    if (type === 'add')    novo = cur + qty;
    else if (type === 'set') novo = qty;
    else                   novo = Math.max(0, cur - qty);
    body.querySelector('#mov-preview').innerHTML =
      `Estoque após: <strong style="font-size:1.3rem">${novo}</strong> unidades`;
  };

  body.querySelector('#mov-type').onchange = updatePreview;
  body.querySelector('#mov-qty').oninput   = updatePreview;
  updatePreview();

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Confirmar entrada');

  saveBtn.onclick = async () => {
    const type = body.querySelector('#mov-type').value;
    const qty  = parseInt(body.querySelector('#mov-qty').value) || 0;
    const cur  = product.stock ?? 0;
    let novo;
    if (type === 'add')    novo = cur + qty;
    else if (type === 'set') novo = qty;
    else                   novo = Math.max(0, cur - qty);

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    try {
      await db.update('products', product.id, { stock: novo });
      const idx = _products.findIndex(p => p.id === product.id);
      if (idx >= 0) _products[idx] = { ..._products[idx], stock: novo };

      // Registra no histórico da sessão
      addToHistory({ product, type, qty, novo });

      ui.toast(`✔ ${product.name} — estoque: ${novo}`, 'success');
      ui.closeModal(true);

      // Limpa busca para próximo produto
      const input = document.getElementById('stock-search');
      if (input) { input.value = ''; input.focus(); }
      const results = document.getElementById('stock-results');
      if (results) results.innerHTML = '';
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar', 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Confirmar entrada';
    }
  };

  ui.modal({ title: 'Registrar movimento de estoque', body, footer: [cancelBtn, saveBtn] });
  // Foca o campo de qty automaticamente
  requestAnimationFrame(() => body.querySelector('#mov-qty')?.select());
}

/* ─── Cadastro rápido de novo produto ────────────────────────── */
function openNewProduct(codeOrName) {
  const isBarcode = /^\d{8,14}$/.test(codeOrName);
  const body = el('form', { autocomplete: 'off' });
  body.innerHTML = `
    <p class="text-mute" style="margin-bottom:16px">Preencha os dados básicos. Você pode completar depois em <strong>Produtos</strong>.</p>
    <div class="field-row">
      <label class="field" style="grid-column:span 2">
        <span class="field-label">Nome do produto *</span>
        <input name="name" required value="${fmt.escape(isBarcode ? '' : codeOrName)}" placeholder="Ex.: Brahma Chopp Lata 350ml" />
      </label>
      <label class="field">
        <span class="field-label">Marca</span>
        <input name="brand" placeholder="Ex.: Brahma" />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Categoria *</span>
        <select name="category" required>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="field-label">Preço de venda *</span>
        <input name="price" type="number" min="0" step="0.01" required placeholder="0,00" />
      </label>
      <label class="field">
        <span class="field-label">Estoque inicial</span>
        <input name="stock" type="number" min="0" step="1" value="0" />
      </label>
    </div>
    <label class="field">
      <span class="field-label">Código de barras</span>
      <input name="barcode" value="${fmt.escape(isBarcode ? codeOrName : '')}" placeholder="EAN/UPC" />
    </label>
  `;

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => body.requestSubmit() }, 'Cadastrar');

  body.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    const fd = Object.fromEntries(new FormData(body));
    const payload = {
      name:     fd.name.trim(),
      brand:    fd.brand.trim(),
      category: fd.category,
      price:    parseFloat(fd.price) || 0,
      stock:    parseInt(fd.stock) || 0,
      barcode:  fd.barcode.trim(),
      active:   true,
      images:   [],
      image:    ''
    };
    try {
      const created = await db.create('products', payload);
      _products.push(created);
      _products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      addToHistory({ product: created, type: 'set', qty: created.stock, novo: created.stock });
      ui.toast(`✔ ${created.name} cadastrado!`, 'success');
      ui.closeModal(true);
      const input = document.getElementById('stock-search');
      if (input) { input.value = ''; input.focus(); }
      const results = document.getElementById('stock-results');
      if (results) results.innerHTML = '';
    } catch (err) {
      ui.toast(err.message || 'Erro ao cadastrar', 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cadastrar';
    }
  };

  ui.modal({ title: 'Cadastrar novo produto', wide: true, body, footer: [cancelBtn, saveBtn] });
  requestAnimationFrame(() => {
    const nameField = body.querySelector('[name="name"]');
    if (nameField && !nameField.value) nameField.focus();
  });
}

/* ─── Histórico da sessão ─────────────────────────────────────── */
const _history = [];
const TYPE_LABEL = { add: 'Entrada', set: 'Ajuste', remove: 'Saída' };

function addToHistory({ product, type, qty, novo }) {
  _history.unshift({ product, type, qty, novo, at: Date.now() });
  const el_hist = document.getElementById('stock-history');
  if (!el_hist) return;
  el_hist.innerHTML = _history.slice(0, 20).map(h => `
    <div class="stock-hist-row">
      <span class="stock-hist-type ${h.type}">${TYPE_LABEL[h.type]}</span>
      <span class="stock-hist-name">${fmt.escape(h.product.name)}</span>
      <span class="stock-hist-qty">${h.type === 'set' ? '→' : h.type === 'add' ? '+' : '−'} ${h.qty}</span>
      <span class="stock-hist-total">= ${h.novo}</span>
      <span class="stock-hist-time text-mute">${new Date(h.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
    </div>
  `).join('');
}
