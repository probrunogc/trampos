/**
 * Módulo: Entregas / Notas
 * Lista todas as vendas com entrega, gerencia status, atribui entregadores,
 * gera e imprime cupom térmico 80mm.
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';

export const meta = {
  id: 'deliveries',
  label: 'Entregas',
  icon: 'deliveries',
  title: 'Entregas & Notas',
  subtitle: 'Pedidos para entrega',
  roles: ['admin', 'vendedor', 'entregador']
};

let state = { sales: [], deliverers: [], filter: 'pending' };

export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Pedidos para entrega</h3>
      <div class="page-header-actions" id="filters"></div>
    </div>
    <div id="delivery-list"></div>
  `;

  const filterBar = document.getElementById('filters');
  const filters = [
    { id: 'pending', label: 'Pendentes' },
    { id: 'in_route', label: 'Em rota' },
    { id: 'delivered', label: 'Entregues' },
    { id: 'all', label: 'Todos' }
  ];
  filterBar.innerHTML = filters.map(f => `
    <button class="pdv-cat-chip ${state.filter === f.id ? 'active' : ''}" data-f="${f.id}">${f.label}</button>
  `).join('');
  filterBar.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    state.filter = b.dataset.f;
    filterBar.querySelectorAll('.pdv-cat-chip').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    paint();
  });

  await reload();
}

async function reload() {
  const [sales, deliverers] = await Promise.all([
    db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' }),
    db.list('deliverers', { orderBy: 'name' })
  ]);
  state.sales = sales.filter(s => s.delivery);
  state.deliverers = deliverers.filter(d => d.active !== false);
  paint();
}

function paint() {
  const root = document.getElementById('delivery-list');
  let arr = state.sales;
  if (state.filter !== 'all') arr = arr.filter(s => s.delivery?.status === state.filter);

  // Se for entregador, mostrar só os atribuídos a ele
  if (auth.isDeliverer()) {
    const u = auth.currentUser();
    arr = arr.filter(s => s.delivery?.delivererId === (u?.uid || u?.id));
  }

  if (arr.length === 0) {
    root.innerHTML = `
      <div class="table-wrap">
        <div class="empty-state">
          ${icon('deliveries', { size: 56 })}
          <h4>Nenhuma entrega ${state.filter === 'all' ? 'cadastrada' : state.filter === 'pending' ? 'pendente' : state.filter === 'in_route' ? 'em rota' : 'entregue'}</h4>
          <p>Vendas com nota de entrega aparecerão aqui.</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = arr.map(s => {
    const status = s.delivery.status;
    const statusBadge =
      status === 'pending'   ? '<span class="badge badge-warning badge-dot">Pendente</span>' :
      status === 'in_route'  ? '<span class="badge badge-info badge-dot">Em rota</span>' :
      status === 'delivered' ? '<span class="badge badge-success badge-dot">Entregue</span>' :
      '<span class="badge badge-mute">—</span>';
    const a = s.customer?.address || {};
    const addrLine = [a.street, a.number, a.complement].filter(Boolean).join(', ');
    const addrSub = [a.neighborhood, a.city, a.state].filter(Boolean).join(' — ');

    const canAssign = auth.isSeller() && status === 'pending';
    const canMark = auth.isSeller() || (auth.isDeliverer() && s.delivery.delivererId === (auth.currentUser()?.uid || auth.currentUser()?.id));

    return `
      <div class="delivery-card">
        <div>
          <div class="delivery-head">
            <span class="delivery-code">${s.code}</span>
            ${statusBadge}
            <span class="delivery-meta">${fmt.datetime(s.createdAt)}</span>
          </div>
          <div>
            <strong>${fmt.escape(s.customer?.name || 'Sem cliente')}</strong>
            <span class="text-mute small"> · ${fmt.phone(s.customer?.phone)}</span>
          </div>
          <div class="delivery-address">
            ${icon('mapPin')}
            <div>
              ${fmt.escape(addrLine || 'Sem endereço cadastrado')}
              ${addrSub ? `<div class="text-mute small">${fmt.escape(addrSub)}${a.reference ? ' · ' + fmt.escape(a.reference) : ''}</div>` : ''}
            </div>
          </div>
          <div class="text-mute small" style="margin-top: var(--sp-2)">
            ${s.items?.length || 0} item${s.items?.length === 1 ? '' : 'ns'} · Total: <strong class="text-gold">${fmt.currency(s.total)}</strong>
            ${s.delivery.delivererName ? ` · Entregador: <strong>${fmt.escape(s.delivery.delivererName)}</strong>` : ''}
          </div>
        </div>
        <div class="delivery-actions">
          <button class="btn btn-ghost btn-sm" data-print="${s.id}">${icon('print', { size: 14 })} Cupom</button>
          ${canAssign ? `<button class="btn btn-secondary btn-sm" data-assign="${s.id}">${icon('deliverers', { size: 14 })} Atribuir</button>` : ''}
          ${canMark && status === 'pending' && s.delivery.delivererId ? `<button class="btn btn-primary btn-sm" data-status="in_route" data-id="${s.id}">Em rota</button>` : ''}
          ${canMark && status === 'in_route' ? `<button class="btn btn-success btn-sm" data-status="delivered" data-id="${s.id}">${icon('check', { size: 14 })} Entregue</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  root.querySelectorAll('[data-print]').forEach(b =>
    b.onclick = () => printSaleCupom(b.dataset.print));
  root.querySelectorAll('[data-assign]').forEach(b =>
    b.onclick = () => assignDeliverer(b.dataset.assign));
  root.querySelectorAll('[data-status]').forEach(b =>
    b.onclick = () => changeStatus(b.dataset.id, b.dataset.status));
}

async function assignDeliverer(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  const wrap = el('div');
  if (state.deliverers.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        ${icon('deliverers', { size: 48 })}
        <h4>Nenhum entregador cadastrado</h4>
        <p>Cadastre um entregador na aba "Entregadores" antes de atribuir.</p>
      </div>`;
    await ui.modal({ title: 'Atribuir entregador', body: wrap });
    return;
  }

  wrap.innerHTML = `
    <p class="text-mute small" style="margin-bottom: var(--sp-3)">Selecione o entregador para este pedido:</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${state.deliverers.map(d => `
        <div class="list-row" data-id="${d.id}" data-name="${fmt.escape(d.name)}" style="cursor:pointer">
          <div class="user-chip-avatar" style="width:36px;height:36px;font-size:.9rem">${(d.name||'?').charAt(0).toUpperCase()}</div>
          <div class="list-row-body">
            <div class="list-row-title">${fmt.escape(d.name)}</div>
            <div class="list-row-sub">${fmt.phone(d.phone)} · ${fmt.escape(d.vehicle || 'Moto')} ${d.plate ? '· ' + fmt.escape(d.plate) : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  wrap.querySelectorAll('.list-row').forEach(r => r.onclick = async () => {
    const updated = {
      ...sale.delivery,
      delivererId: r.dataset.id,
      delivererName: r.dataset.name,
      assignedAt: Date.now(),
      status: 'pending'
    };
    await db.update('sales', saleId, { delivery: updated });
    ui.toast(`Atribuído a ${r.dataset.name}.`, 'success');
    ui.closeModal(true);
    await reload();
  });

  await ui.modal({ title: 'Atribuir entregador', body: wrap });
}

async function changeStatus(saleId, status) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;
  const updated = { ...sale.delivery, status };
  if (status === 'delivered') updated.deliveredAt = Date.now();
  await db.update('sales', saleId, {
    delivery: updated,
    status: status === 'delivered' ? 'paid' : sale.status
  });
  ui.toast(status === 'delivered' ? 'Entrega concluída.' : 'Status atualizado.', 'success');
  await reload();
}

/* =================================================================
 * IMPRESSÃO DO CUPOM TÉRMICO 80mm
 * Renderiza HTML no #print-host (escondido em tela) e chama window.print()
 * ================================================================= */
export async function printSaleCupom(saleId) {
  const sale = await db.get('sales', saleId);
  if (!sale) { ui.toast('Venda não encontrada.', 'danger'); return; }
  const company = await db.get('settings', 'company') || { name: 'Empório das Bebidas' };

  const host = document.getElementById('print-host');
  host.innerHTML = buildCupomHTML(sale, company);

  // Pequeno delay para garantir layout antes da impressão
  setTimeout(() => {
    window.print();
  }, 80);
}

function buildCupomHTML(sale, company) {
  const PAYMENT_LABELS = {
    dinheiro: 'DINHEIRO', pix: 'PIX', debito: 'CARTÃO DÉBITO',
    credito: 'CARTÃO CRÉDITO', fiado: 'FIADO'
  };
  const a = sale.customer?.address || {};
  const addrLine = [a.street, a.number, a.complement].filter(Boolean).join(', ');
  const addrSub = [a.neighborhood, a.city, a.state].filter(Boolean).join(' — ');

  return `
    <div class="print-doc">
      <div class="print-medallion">
        <img src="assets/logo.svg" alt="" />
      </div>
      <div class="print-brand">${fmt.escape(company.name || 'EMPÓRIO DAS BEBIDAS')}</div>
      ${company.slogan ? `<div class="print-sub">"${fmt.escape(company.slogan)}"</div>` : ''}
      <div class="print-since">★ SINCE 2025 ★</div>

      <hr class="print-hr">
      <div style="font-size: 9pt; text-align:center;">
        ${company.address ? fmt.escape(company.address) + '<br>' : ''}
        ${company.phone ? 'Tel: ' + fmt.escape(company.phone) + '<br>' : ''}
        ${company.cnpj ? 'CNPJ: ' + fmt.escape(company.cnpj) : ''}
      </div>

      <div class="print-doc-title">${sale.delivery ? 'NOTA DE ENTREGA' : 'COMPROVANTE DE VENDA'}</div>

      <div class="print-row print-strong" style="font-size: 11pt">
        <span>${fmt.escape(sale.code)}</span>
        <span>${fmt.datetime(sale.createdAt)}</span>
      </div>

      ${sale.customer ? `
        <div class="print-block">
          <div class="print-label">CLIENTE</div>
          <div class="print-strong">${fmt.escape(sale.customer.name)}</div>
          <div>${fmt.phone(sale.customer.phone)}</div>
          ${sale.customer.document ? `<div>Doc: ${fmt.escape(sale.customer.document)}</div>` : ''}
        </div>
      ` : '<div class="print-block"><div class="print-label">CONSUMIDOR FINAL</div></div>'}

      ${sale.delivery && addrLine ? `
        <div class="print-address">
          <div class="print-label print-strong">ENDEREÇO DE ENTREGA</div>
          <div class="print-strong">${fmt.escape(addrLine)}</div>
          ${addrSub ? `<div>${fmt.escape(addrSub)}</div>` : ''}
          ${a.cep ? `<div>CEP ${fmt.cep(a.cep)}</div>` : ''}
          ${a.reference ? `<div><em>Ref.: ${fmt.escape(a.reference)}</em></div>` : ''}
        </div>
      ` : ''}

      <hr class="print-hr">
      <div class="print-strong" style="font-size: 9pt; margin-bottom: 2pt">ITENS</div>

      ${(sale.items || []).map(it => `
        <div class="print-item">
          <div class="print-item-name">${fmt.escape(it.name)}</div>
          <div class="print-item-line">
            <span class="print-item-meta">${it.qty} x ${fmt.currency(it.unitPrice)}</span>
            <span class="print-item-meta print-strong">${fmt.currency(it.qty * it.unitPrice)}</span>
          </div>
        </div>
      `).join('')}

      <hr class="print-hr">

      <div class="print-row"><span>Subtotal:</span><span>${fmt.currency(sale.subtotal)}</span></div>
      ${sale.discount ? `<div class="print-row"><span>Desconto:</span><span>− ${fmt.currency(sale.discount)}</span></div>` : ''}
      ${sale.deliveryFee ? `<div class="print-row"><span>Taxa de entrega:</span><span>+ ${fmt.currency(sale.deliveryFee)}</span></div>` : ''}

      <div class="print-total">
        <span>TOTAL</span><span>${fmt.currency(sale.total)}</span>
      </div>

      <div class="print-row" style="margin-top: 4pt">
        <span class="print-label">PAGAMENTO</span>
        <span class="print-strong">${PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod?.toUpperCase()}</span>
      </div>

      ${sale.delivery ? `
        <hr class="print-hr">
        <div class="print-strong" style="text-align:center; font-size: 10pt; margin: 3pt 0;">
          === INSTRUÇÕES DO ENTREGADOR ===
        </div>
        <div style="font-size: 9.5pt;">
          ${sale.delivery.delivererName ? `Entregador: <strong>${fmt.escape(sale.delivery.delivererName)}</strong><br>` : ''}
          Status: <strong>${
            sale.delivery.status === 'pending' ? 'PENDENTE' :
            sale.delivery.status === 'in_route' ? 'EM ROTA' :
            sale.delivery.status === 'delivered' ? 'ENTREGUE' : '—'
          }</strong>
          ${sale.delivery.deliveredAt ? `<br>Entregue em: ${fmt.datetime(sale.delivery.deliveredAt)}` : ''}
        </div>
      ` : ''}

      <hr class="print-double-hr">

      <div class="print-foot">
        Obrigado pela preferência!<br>
        Empório das Bebidas · ${new Date().getFullYear()}
      </div>
    </div>
  `;
}
