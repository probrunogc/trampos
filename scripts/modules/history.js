/**
 * Módulo: Histórico de vendas
 * Lista todas as vendas, com filtros e detalhe (reimpressão de cupom).
 */
import { db, fmt, ui, icon, el, clearNode } from '../core.js';
import { printSaleCupom } from './deliveries.js';

export const meta = {
  id: 'history',
  label: 'Histórico',
  icon: 'sales',
  title: 'Histórico de vendas',
  subtitle: 'Todas as vendas registradas',
  roles: ['admin']
};

const PAY_LABEL = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };

let state = { list: [], search: '', pay: 'all', period: '30' };

export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header"><h3>Histórico de vendas</h3></div>
    <div class="hist-filters">
      <div class="table-search">
        ${icon('search')}
        <input id="hist-search" type="search" placeholder="Buscar por código ou cliente..." />
      </div>
      <select id="hist-pay" class="input">
        <option value="all">Todas as formas</option>
        ${Object.entries(PAY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <select id="hist-period" class="input">
        <option value="7">Últimos 7 dias</option>
        <option value="30" selected>Últimos 30 dias</option>
        <option value="all">Tudo</option>
      </select>
    </div>
    <div id="hist-summary" class="hist-summary"></div>
    <div id="hist-list"></div>
  `;
  root.querySelector('#hist-search').oninput = (e) => { state.search = e.target.value.toLowerCase(); paint(); };
  root.querySelector('#hist-pay').onchange = (e) => { state.pay = e.target.value; paint(); };
  root.querySelector('#hist-period').onchange = (e) => { state.period = e.target.value; paint(); };

  state.list = await db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' });
  paint();
}

function filtered() {
  let arr = state.list.filter(s => s.status !== 'cancelled');
  if (state.period !== 'all') {
    const start = Date.now() - Number(state.period) * 86400000;
    arr = arr.filter(s => s.createdAt >= start);
  }
  if (state.pay !== 'all') arr = arr.filter(s => s.paymentMethod === state.pay);
  if (state.search) {
    const q = state.search;
    arr = arr.filter(s =>
      (s.code || '').toLowerCase().includes(q) ||
      (s.customer?.name || '').toLowerCase().includes(q));
  }
  return arr;
}

function paint() {
  const arr = filtered();
  const total = arr.reduce((a, s) => a + (s.total || 0), 0);
  document.getElementById('hist-summary').innerHTML = `
    <span>${arr.length} venda${arr.length === 1 ? '' : 's'}</span>
    <strong class="text-gold">${fmt.currency(total)}</strong>`;

  const box = document.getElementById('hist-list');
  if (arr.length === 0) {
    box.innerHTML = `<div class="empty-state">${icon('sales', { size: 56 })}
      <h4>Nenhuma venda</h4><p>Ajuste os filtros acima.</p></div>`;
    return;
  }
  box.innerHTML = arr.map(s => {
    const items = s.items || [];
    const openFiado = s.paymentMethod === 'fiado' && !s.fiadoSettled;
    return `
      <div class="hist-card" data-id="${s.id}">
        <div class="hist-card-top">
          <span class="hist-code">${fmt.escape(s.code || '—')}</span>
          <span class="hist-total">${fmt.currency(s.total)}</span>
        </div>
        <div class="hist-card-mid">
          <span class="hist-cust">${fmt.escape(s.customer?.name || 'Cliente avulso')}</span>
          <span class="badge badge-mute">${PAY_LABEL[s.paymentMethod] || s.paymentMethod}</span>
        </div>
        <div class="hist-card-sub text-mute small">
          ${fmt.datetime(s.createdAt)} · ${items.length} ${items.length === 1 ? 'item' : 'itens'}
          ${s.delivery ? ' · entrega' : ''}
          ${openFiado ? ' · <span class="text-warning">fiado em aberto</span>' : ''}
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('.hist-card').forEach(c =>
    c.onclick = () => openDetail(c.dataset.id));
}

function openDetail(id) {
  const s = state.list.find(x => x.id === id);
  if (!s) return;
  const body = el('div');
  body.innerHTML = `
    <div class="hist-detail">
      <div class="hist-detail-row"><span>Código</span><strong>${fmt.escape(s.code || '—')}</strong></div>
      <div class="hist-detail-row"><span>Data</span><strong>${fmt.datetime(s.createdAt)}</strong></div>
      <div class="hist-detail-row"><span>Cliente</span><strong>${fmt.escape(s.customer?.name || 'Avulso')}</strong></div>
      <div class="hist-detail-row"><span>Operador</span><strong>${fmt.escape(s.seller?.name || '—')}</strong></div>
      <div class="hist-detail-row"><span>Pagamento</span><strong>${PAY_LABEL[s.paymentMethod] || s.paymentMethod}</strong></div>
    </div>
    <div class="divider-text">Itens</div>
    <div class="hist-items">
      ${(s.items || []).map(it => `
        <div class="hist-item">
          <span>${it.qty}× ${fmt.escape(it.name)}</span>
          <span>${fmt.currency((it.qty || 0) * (it.unitPrice || 0))}</span>
        </div>`).join('')}
    </div>
    <div class="hist-detail-row" style="margin-top:var(--sp-3)"><span>Subtotal</span><span>${fmt.currency(s.subtotal)}</span></div>
    ${s.discount ? `<div class="hist-detail-row"><span>Desconto</span><span>− ${fmt.currency(s.discount)}</span></div>` : ''}
    ${s.deliveryFee ? `<div class="hist-detail-row"><span>Taxa de entrega</span><span>+ ${fmt.currency(s.deliveryFee)}</span></div>` : ''}
    <div class="hist-detail-row hist-detail-total"><span>TOTAL</span><strong class="text-gold">${fmt.currency(s.total)}</strong></div>
  `;
  const printBtn = el('button', { class: 'btn btn-secondary', type: 'button',
    onClick: () => printSaleCupom(s.id) }, 'Reimprimir cupom');
  const closeBtn = el('button', { class: 'btn btn-primary', type: 'button',
    onClick: () => ui.closeModal(true) }, 'Fechar');
  ui.modal({ title: 'Detalhe da venda', body, footer: [printBtn, closeBtn] });
}
