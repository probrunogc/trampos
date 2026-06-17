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
  discount: 0,
  deliveryFee: 0,
  needsDelivery: false,
  note: ''
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Cigarro', 'Outros'];
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
  _checkMode = false;
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
          <button id="pdv-check-btn" class="btn btn-ghost btn-sm" type="button" title="Verificar preço sem adicionar ao carrinho">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Check
          </button>
        </div>
        <div id="pdv-check-result" style="display:none;padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--line)"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px 0">
          <button id="pdv-quick-cigarro" type="button"
                  style="display:flex;flex-direction:column;align-items:center;gap:4px;
                         padding:12px 8px;border-radius:10px;border:2px solid #b8860b;
                         background:linear-gradient(135deg,rgba(184,134,11,.18),rgba(184,134,11,.06));
                         cursor:pointer;color:inherit;transition:transform .1s,background .15s"
                  onmousedown="this.style.transform='scale(.96)'"
                  onmouseup="this.style.transform=''"
                  ontouchend="this.style.transform=''">
            <span style="font-size:1.7rem;line-height:1">🚬</span>
            <span style="font-weight:700;font-size:.88rem">Cigarro</span>
            <span style="font-size:.7rem;color:var(--text-2)">Retalho rápido</span>
          </button>
          <button id="pdv-quick-dose" type="button"
                  style="display:flex;flex-direction:column;align-items:center;gap:4px;
                         padding:12px 8px;border-radius:10px;border:2px solid #7b3fa0;
                         background:linear-gradient(135deg,rgba(123,63,160,.18),rgba(123,63,160,.06));
                         cursor:pointer;color:inherit;transition:transform .1s,background .15s"
                  onmousedown="this.style.transform='scale(.96)'"
                  onmouseup="this.style.transform=''"
                  ontouchend="this.style.transform=''">
            <span style="font-size:1.7rem;line-height:1">🥃</span>
            <span style="font-weight:700;font-size:.88rem">Dose</span>
            <span style="font-size:.7rem;color:var(--text-2)">Venda rápida</span>
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

  // Payment
  document.getElementById('pdv-payment').onchange = (e) => state.paymentMethod = e.target.value;

  // Quick-add atalhos
  document.getElementById('pdv-quick-cigarro').onclick = () => openQuickAdd('Cigarro', '🚬 Cigarro — Retalho rápido');
  document.getElementById('pdv-quick-dose').onclick    = () => openQuickAdd('Dose',    '🥃 Dose — Venda rápida');

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

/* ─── Quick-add modal (Cigarro / Dose) ───────────────────────── */
function openQuickAdd(category, title) {
  const prods = state.products.filter(p => p.category === category);
  if (prods.length === 0) {
    ui.toast(`Nenhum produto cadastrado em "${category}". Cadastre em Produtos primeiro.`, 'warning', { duration: 4500 });
    return;
  }

  const qtys = {};
  prods.forEach(p => { qtys[p.id] = 0; });

  const body = el('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const render = () => {
    body.innerHTML = prods.map(p => {
      const q = qtys[p.id];
      const out = (p.stock ?? 0) <= 0;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;
                    background:var(--surface-2,rgba(255,255,255,.05));
                    border:1px solid ${q > 0 ? 'var(--gold-400,#d4af37)' : 'transparent'};
                    transition:border-color .15s" data-qid="${p.id}">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${fmt.escape(p.name)}
            </div>
            <div style="font-size:.76rem;color:var(--text-2)">
              ${fmt.currency(p.price)}
              ${out ? ' · <span style="color:#e74c3c">Sem estoque</span>' : ` · Estoque: ${p.stock}`}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
            <button data-dec="${p.id}"
                    style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border,#555);
                           background:none;cursor:pointer;color:inherit;font-size:1rem;
                           display:flex;align-items:center;justify-content:center;
                           opacity:${q === 0 ? '.35' : '1'}">−</button>
            <span style="width:26px;text-align:center;font-weight:700;font-size:1rem">${q}</span>
            <button data-inc="${p.id}"
                    style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border,#555);
                           background:none;cursor:pointer;color:inherit;font-size:1rem;
                           display:flex;align-items:center;justify-content:center">+</button>
          </div>
        </div>
      `;
    }).join('');

    body.querySelectorAll('[data-dec]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.dec;
        if (qtys[id] > 0) { qtys[id]--; render(); }
      };
    });
    body.querySelectorAll('[data-inc]').forEach(btn => {
      btn.onclick = () => { qtys[btn.dataset.inc]++; render(); };
    });
  };

  render();

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);

  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Adicionar ao carrinho');
  addBtn.onclick = () => {
    let added = 0;
    for (const [productId, qty] of Object.entries(qtys)) {
      if (qty <= 0) continue;
      const p = prods.find(x => x.id === productId);
      if (!p) continue;
      const existing = state.cart.find(i => i.productId === productId);
      if (existing) {
        existing.qty += qty;
      } else {
        state.cart.push({ productId: p.id, name: p.name, unitPrice: p.price, costPrice: p.costPrice || 0, qty, stock: p.stock });
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
      costPrice: p.costPrice || 0,
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
      onClick: () => ui.closeModal(false) }, 'Cancelar');
    const ok = el('button', { class: 'btn btn-primary', type: 'button',
      onClick: () => ui.closeModal(true) }, 'Confirmar venda');
    // Resolve a partir do resultado do modal — assim Escape/clicar fora
    // cancela em vez de deixar a venda travada esperando um clique.
    return ui.modal({ title: 'Finalizar venda', body, footer: [cancel, ok] })
      .then(r => r === true);
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
        unitCost: i.costPrice || 0,
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

    // Baixar estoque via Firestore transaction — garante atomicidade mesmo com
    // múltiplos caixas vendendo o mesmo item simultaneamente.
    // A venda já foi gravada (operação crítica); se a baixa de estoque falhar,
    // não trava o caixa — apenas avisa para ajuste manual depois.
    const stockItems = state.cart.map(i => ({ productId: i.productId, qty: i.qty }));
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
