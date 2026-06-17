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
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'pix',      label: 'PIX',      icon: '📱' },
  { id: 'debito',   label: 'Débito',   icon: '💳' },
  { id: 'credito',  label: 'Crédito',  icon: '💳' },
  { id: 'fiado',    label: 'Fiado',    icon: '📋' },
];

const CIGARRO_BRANDS = [
  { id: 'lucky-strike',     name: 'Lucky Strike',     price: 10.00 },
  { id: 'duhil-cereja',     name: 'Duhil Cereja',     price:  8.00 },
  { id: 'duhil-melancia',   name: 'Duhil Melancia',   price:  8.00 },
  { id: 'duhil-normal',     name: 'Duhil Normal',     price:  8.00 },
  { id: 'rottman-normal',   name: 'Rottman Normal',   price:  8.00 },
  { id: 'rottman-cereja',   name: 'Rottman Cereja',   price:  8.00 },
  { id: 'rottman-melancia', name: 'Rottman Melancia', price:  8.00 },
  { id: 'black',            name: 'Black',            price: 12.00 },
  { id: '0800',             name: '0800',             price:  7.00 },
  { id: '0800-menta',       name: '0800 Menta',       price:  7.00 },
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px 0">
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

  // Payment buttons
  document.getElementById('pdv-pay-grid').querySelectorAll('[data-pay]').forEach(btn => {
    btn.onclick = () => {
      state.paymentMethod = btn.dataset.pay;
      state.received = 0;
      document.getElementById('pdv-pay-grid').querySelectorAll('.pdv-pay-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.pay === state.paymentMethod));
      const recvInput = document.getElementById('pdv-received');
      if (recvInput) recvInput.value = '';
      paintTroco();
    };
  });
  document.getElementById('pdv-received').oninput = e => {
    state.received = parseFloat(e.target.value) || 0;
    paintTroco();
  };
  paintTroco();

  // Quick-add atalhos
  document.getElementById('pdv-quick-cigarro').onclick  = () => openBrandModal(CIGARRO_BRANDS, 'Cigarro — Retalho', { openLabel: 'Abrir carteira' });
  document.getElementById('pdv-quick-dose').onclick     = () => openBrandModal(DOSE_BRANDS,    'Dose — Venda',       { openLabel: 'Abrir garrafa' });

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

  // Scanner USB (C3TECH e similares — modo teclado HID)
  // O leitor injeta os dígitos muito rápido (< 50ms/char) e encerra com Enter.
  // Capturamos no document para funcionar mesmo sem o campo de busca focado.
  wireScanner();

  paintAll();

  // Check / open caixa after page is painted
  checkOrOpenCaixa();
}

/* ─── Caixa (abertura, sangria, fechamento) ──────────────────── */
function _setCaixaInfo(text) {
  const el_ = document.getElementById('pdv-caixa-info');
  if (el_) el_.textContent = text;
}

async function checkOrOpenCaixa() {
  try {
    const list = await db.list('caixas', { where: { field: 'status', value: 'open' }, orderBy: 'createdAt', orderDir: 'desc', limit: 1 });
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
  } catch {
    _setCaixaInfo('Erro ao verificar caixa');
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
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const confirmBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Continuar');
  confirmBtn.onclick = async () => {
    const amount = parseFloat(document.getElementById('sg-amount').value) || 0;
    const reason = document.getElementById('sg-reason').value.trim();
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

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);
  const fecharBtn = el('button', { class: 'btn btn-danger', type: 'button' }, 'Fechar caixa');
  fecharBtn.disabled = true;

  ui.modal({ title: 'Fechamento de caixa', body, footer: [cancelBtn, fecharBtn] });

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
      setTimeout(() => promptAbrirCaixa(), 600);
    } catch (err) {
      fecharBtn.disabled = false;
      ui.toast('Erro ao fechar caixa: ' + (err.message || 'Tente novamente.'), 'danger');
    }
  };
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

/* ─── Quick-add modal (Cigarro / Dose) — com animação ────────── */
/* ─── Brand-card modal (Cigarro / Dose) ─────────────────────── */
function openBrandModal(brands, title, opts = {}) {
  const prices = {};
  const qtys   = {};
  const armed  = {};
  brands.forEach(b => { prices[b.id] = b.price; qtys[b.id] = 0; });

  const body = el('div');
  body.className = 'qa-body';

  const totalBar = el('div');
  totalBar.className = 'qa-total hidden';

  const updateTotalBar = () => {
    const totalQty = Object.values(qtys).reduce((s, v) => s + v, 0);
    const totalVal = brands.reduce((s, b) => s + (qtys[b.id] || 0) * (prices[b.id] ?? b.price), 0);
    if (totalQty > 0) {
      totalBar.className = 'qa-total';
      totalBar.innerHTML = `<span><strong>${totalQty}</strong> item(s) selecionado(s)</span><span class="qa-total-val">${fmt.currency(totalVal)}</span>`;
    } else {
      totalBar.className = 'qa-total hidden';
      totalBar.innerHTML = '';
    }
  };

  const updateCard = (id) => {
    const card = body.querySelector(`[data-bid="${id}"]`);
    if (!card) return;
    const q = qtys[id];
    card.classList.toggle('brand-card--active', q > 0);
    const countEl = card.querySelector('.qa-count');
    if (countEl) {
      countEl.textContent = q;
      countEl.classList.toggle('qa-count--pos', q > 0);
      if (q > 0) {
        countEl.classList.remove('qa-pop');
        void countEl.offsetWidth;
        countEl.classList.add('qa-pop');
      }
    }
    const decBtn = card.querySelector('.qa-btn-dec');
    if (decBtn) decBtn.disabled = q === 0;
    updateTotalBar();
  };

  body.innerHTML = `<div class="brand-grid">${brands.map(b => {
    const openBtn = opts.openLabel
      ? `<button class="qa-open-btn" data-bid="${b.id}" type="button">${fmt.escape(opts.openLabel)}</button>`
      : '';
    return `
      <div class="brand-card" data-bid="${b.id}">
        <div class="brand-card-name">${fmt.escape(b.name)}</div>
        <label class="qa-price-label">R$<input class="qa-price-input" type="number" step="0.50" min="0" data-bid="${b.id}" value="${b.price.toFixed(2)}"></label>
        ${openBtn}
        <div class="qa-counter brand-card-counter">
          <button class="qa-btn qa-btn-dec" disabled>−</button>
          <span class="qa-count">0</span>
          <button class="qa-btn qa-btn-inc">+</button>
        </div>
      </div>`;
  }).join('')}</div>`;
  body.appendChild(totalBar);

  body.querySelectorAll('.qa-price-input').forEach(input => {
    input.onclick = e => e.stopPropagation();
    input.oninput = () => {
      prices[input.dataset.bid] = parseFloat(input.value) || 0;
      updateTotalBar();
    };
  });

  body.querySelectorAll('.brand-card').forEach(card => {
    card.onclick = e => {
      if (e.target.closest('.qa-price-input') || e.target.closest('.qa-open-btn') || e.target.closest('.qa-btn')) return;
      const id = card.dataset.bid;
      qtys[id]++;
      updateCard(id);
    };
  });

  body.querySelectorAll('.qa-btn-dec').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.closest('[data-bid]').dataset.bid;
      if (qtys[id] > 0) { qtys[id]--; updateCard(id); }
    };
  });
  body.querySelectorAll('.qa-btn-inc').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.closest('[data-bid]').dataset.bid;
      qtys[id]++;
      updateCard(id);
    };
  });

  if (opts.openLabel) {
    body.querySelectorAll('.qa-open-btn').forEach(btn => {
      btn.onclick = async e => {
        e.stopPropagation();
        const id = btn.dataset.bid;
        const brand = brands.find(b => b.id === id);
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
          btn.disabled = true;
          btn.textContent = 'Aberto';
          ui.toast(`${opts.openLabel} — ${brand?.name ?? ''} registrado.`, 'success');
        }
      };
    });
  }

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  cancelBtn.onclick = () => ui.closeModal(null);

  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Adicionar ao carrinho');
  addBtn.onclick = () => {
    let added = 0;
    for (const b of brands) {
      const qty = qtys[b.id] || 0;
      if (qty <= 0) continue;
      const unitPrice = prices[b.id] ?? b.price;
      const existing = state.cart.find(i => i.productId == null && i.name === b.name);
      if (existing) {
        existing.qty += qty;
      } else {
        state.cart.push({ productId: null, name: b.name, unitPrice, costPrice: 0, qty, stock: null });
      }
      added++;
    }
    if (added === 0) { ui.toast('Selecione ao menos um item.', 'warning'); return; }
    paintCart();
    paintTotals();
    ui.closeModal(true);
    ui.toast(`${added} item(s) adicionado(s) ao carrinho`, 'success');
  };

  ui.modal({ title, body, footer: [cancelBtn, addBtn], narrow: true });
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
        state.cart.push({ productId: p.id, name: p.name, unitPrice, costPrice: p.costPrice || 0, qty, stock: p.stock });
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
  paintTroco();
}

function paintTroco() {
  const wrap = document.getElementById('pdv-troco-wrap');
  if (!wrap) return;
  const isDinheiro = state.paymentMethod === 'dinheiro';
  wrap.style.display = isDinheiro ? '' : 'none';
  if (!isDinheiro) return;
  const subtotal = state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = Math.max(0, state.discount || 0);
  const fee = state.needsDelivery ? (state.deliveryFee || 0) : 0;
  const total = Math.max(0, subtotal - discount + fee);
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
      caixaId: state.caixaId || null,
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
    paintTroco();
    // Recarregar produtos para refletir estoque
    state.products = (await db.list('products', { orderBy: 'name' })).filter(p => p.active !== false);
    updateCustomerUI();
    paintAll();
  } catch (err) {
    ui.toast(err.message || 'Erro ao finalizar', 'danger');
  }
}
