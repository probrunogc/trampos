/**
 * Módulo: Relatórios
 * Relatório financeiro completo: bruto x líquido, formas de pagamento,
 * fiados, produtos mais vendidos, horários de pico, entregas, doses/copão.
 */
import { db, fmt, ui, icon, clearNode, manausNow, auth } from '../core.js';
import { productImage } from '../product-art.js';

export const meta = {
  id: 'reports',
  label: 'Histórico',
  icon: 'trendUp',
  title: 'Histórico',
  subtitle: 'Resumo de vendas',
  roles: ['admin', 'vendedor']
};

// Taxas estimadas de cartão (%). Sobrescritas por settings/company se existir.
const DEFAULT_FEES = { dinheiro: 0, pix: 0, debito: 1.99, credito: 3.49, fiado: 0 };
const PAY_LABEL = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };
const PAY_COLOR = { dinheiro: '#3a8a4a', pix: '#1f9aa0', debito: '#3a6ab0', credito: '#9a5ab0', fiado: '#c08a2a' };

const PERIODS = [
  { id: '7',      label: '7 dias' },
  { id: '30',     label: '30 dias' },
  { id: 'mes',    label: 'Este mês' },
  { id: 'custom', label: 'Personalizado' }
];

let state = { period: '30', data: null, customFrom: null, customTo: null };

export async function render(root) {
  if (!auth.isAdmin()) { await renderSellerHistory(root); return; }
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Relatório financeiro</h3>
      <div class="page-header-actions">
        <div class="seg" id="rep-period">
          ${PERIODS.map(p => `<button class="seg-btn ${p.id === state.period ? 'active' : ''}" data-p="${p.id}">${p.label}</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="rep-export-csv" title="Exportar vendas do período em CSV">
          ${icon('box', { size: 15 })}<span>CSV</span>
        </button>
        <button class="btn btn-ghost" id="rep-print">${icon('print', { size: 16 })}<span>Imprimir</span></button>
      </div>
    </div>
    <div id="rep-custom-range" style="display:${state.period === 'custom' ? 'flex' : 'none'};
         align-items:center;flex-wrap:wrap;gap:8px;padding:0 0 var(--sp-3);font-size:.85rem">
      <label style="display:flex;align-items:center;gap:6px">
        De:&nbsp;<input type="date" id="rep-date-from" class="input"
          style="padding:4px 8px;max-width:160px"
          value="${state.customFrom ? new Date(state.customFrom).toISOString().slice(0, 10) : ''}" />
      </label>
      <label style="display:flex;align-items:center;gap:6px">
        Até:&nbsp;<input type="date" id="rep-date-to" class="input"
          style="padding:4px 8px;max-width:160px"
          value="${state.customTo ? new Date(state.customTo).toISOString().slice(0, 10) : ''}" />
      </label>
      <button class="btn btn-primary btn-sm" id="rep-apply-custom">Aplicar</button>
    </div>
    <div id="rep-body"><div class="rep-loading">Carregando dados…</div></div>
  `;

  root.querySelectorAll('#rep-period .seg-btn').forEach(b => {
    b.onclick = () => {
      state.period = b.dataset.p;
      root.querySelectorAll('#rep-period .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      const customRow = root.querySelector('#rep-custom-range');
      if (customRow) customRow.style.display = state.period === 'custom' ? 'flex' : 'none';
      if (state.period !== 'custom') paint();
    };
  });

  root.querySelector('#rep-apply-custom')?.addEventListener('click', () => {
    const fromVal = root.querySelector('#rep-date-from')?.value;
    const toVal   = root.querySelector('#rep-date-to')?.value;
    if (!fromVal) { ui.toast('Informe a data inicial.', 'warning'); return; }
    // Parse as Manaus midnight (UTC-4 = UTC+0 at 04:00)
    state.customFrom = new Date(fromVal + 'T04:00:00Z').getTime();
    state.customTo   = toVal ? new Date(toVal   + 'T04:00:00Z').getTime() : null;
    paint();
  });

  root.querySelector('#rep-print').onclick = () => window.print();
  root.querySelector('#rep-export-csv').onclick = exportCSV;

  await load();
  paint();
}

async function load() {
  const [sales, products, settings] = await Promise.all([
    db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' }),
    db.list('products'),
    db.get('settings', 'company')
  ]);
  const fees = { ...DEFAULT_FEES };
  if (settings) {
    // Modelo novo: settings.fees = { dinheiro, pix, debito, credito }
    if (settings.fees && typeof settings.fees === 'object') {
      for (const k of Object.keys(fees)) {
        if (settings.fees[k] != null) fees[k] = Number(settings.fees[k]);
      }
    }
    // Compatibilidade com campos antigos
    if (settings.feeDebito != null) fees.debito = Number(settings.feeDebito);
    if (settings.feeCredito != null) fees.credito = Number(settings.feeCredito);
  }
  const costMap = {};
  products.forEach(p => { costMap[p.id] = Number(p.costPrice) || 0; });
  const doseIds = new Set(products.filter(p => p.category === 'Dose').map(p => p.id));
  state.data = { sales, products, fees, costMap, doseIds };
}

function rangeStart() {
  if (state.period === 'custom') {
    return state.customFrom ?? (manausNow().startOfDay - 29 * 24 * 60 * 60 * 1000);
  }
  const { startOfMonth, startOfDay } = manausNow();
  if (state.period === 'mes') return startOfMonth;
  const days = Number(state.period);
  return startOfDay - (days - 1) * 24 * 60 * 60 * 1000;
}

function rangeEnd() {
  if (state.period === 'custom' && state.customTo) {
    return state.customTo + 24 * 60 * 60 * 1000 - 1; // até 23:59:59 do dia escolhido
  }
  return Date.now();
}

function paint() {
  const box = document.getElementById('rep-body');
  const { sales, fees, costMap, doseIds } = state.data;
  const start = rangeStart();
  const end   = rangeEnd();
  const list = sales.filter(s => s.createdAt >= start && s.createdAt <= end && s.status !== 'cancelled');

  if (list.length === 0) {
    box.innerHTML = `<div class="empty-state">${icon('trendUp', { size: 56 })}
      <h4>Sem vendas no período</h4><p>Nenhuma venda registrada nesse intervalo.</p></div>`;
    return;
  }

  // ---- agregados ----
  let bruto = 0, descontos = 0, taxasEntrega = 0, taxasCartao = 0, custoProdutos = 0;
  let zeroCostRevenue = 0; // receita de itens sem custo cadastrado
  const byPay = {};        // pagamento -> { count, value }
  const byHour = Array(24).fill(0);
  const byDay = {};        // ts -> value
  const prodAgg = {};      // productId -> { name, art, image, category, qty, revenue }
  let doseQty = 0, doseRevenue = 0;
  let entregaCount = 0;
  const fiadoOpen = [];

  list.forEach(s => {
    const total = Number(s.total) || 0;
    bruto += total;
    descontos += Number(s.discount) || 0;
    taxasEntrega += Number(s.deliveryFee) || 0;
    const fee = fees[s.paymentMethod] || 0;
    taxasCartao += total * (fee / 100);

    const pm = s.paymentMethod || 'dinheiro';
    if (!byPay[pm]) byPay[pm] = { count: 0, value: 0 };
    byPay[pm].count++; byPay[pm].value += total;

    const dt = new Date(s.createdAt);
    byHour[dt.getHours()]++;
    const dayKey = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    byDay[dayKey] = (byDay[dayKey] || 0) + total;

    (s.items || []).forEach(it => {
      const qty = Number(it.qty) || 0;
      const rev = qty * (Number(it.unitPrice) || 0);
      const key = it.productId || it.name;
      if (!prodAgg[key]) {
        const p = state.data.products.find(x => x.id === it.productId) || {};
        prodAgg[key] = { name: it.name, art: p.art, image: p.image, category: p.category, qty: 0, revenue: 0 };
      }
      prodAgg[key].qty += qty; prodAgg[key].revenue += rev;
      // Prefere o custo congelado no momento da venda; cai para o custo atual do produto
      const unitCost = it.unitCost != null ? Number(it.unitCost) : (costMap[it.productId] || 0);
      custoProdutos += qty * unitCost;
      if (unitCost === 0) zeroCostRevenue += rev;
      if (doseIds.has(it.productId)) { doseQty += qty; doseRevenue += rev; }
    });

    if (s.delivery) entregaCount++;
    if (s.paymentMethod === 'fiado' && !s.fiadoSettled) fiadoOpen.push(s);
  });

  const liquido = bruto - taxasCartao;
  // Lucro bruto = faturamento − custo das mercadorias (sem considerar taxas)
  const lucroBruto = bruto - custoProdutos;
  // Lucro líquido = lucro bruto − taxas de cartão/PIX − taxas de entrega repassadas
  const lucroLiquido = lucroBruto - taxasCartao - taxasEntrega;
  const ticket = bruto / list.length;
  const fiadoTotal = fiadoOpen.reduce((a, s) => a + (Number(s.total) || 0), 0);

  const topProd = Object.values(prodAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // dias ordenados
  const dayEntries = Object.entries(byDay).map(([ts, v]) => ({ ts: +ts, v }))
    .sort((a, b) => a.ts - b.ts);

  box.innerHTML = `
    ${zeroCostRevenue > 0 ? `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:var(--sp-4);
                  background:rgba(230,126,34,0.1);border:1px solid rgba(230,126,34,0.35);border-radius:8px;
                  font-size:.84rem;color:var(--text-2)">
        <span style="font-size:1.1rem;flex-shrink:0">⚠</span>
        <span>
          <strong style="color:#e67e22">${fmt.currency(zeroCostRevenue)}</strong>
          (${bruto ? (zeroCostRevenue / bruto * 100).toFixed(1) : 0}% do faturamento) vem de itens
          <strong>sem custo cadastrado</strong> — o Lucro Bruto está subestimado.
          <a href="#/products" style="color:var(--gold-300);margin-left:6px">Cadastrar custos →</a>
        </span>
      </div>` : ''}
    <section class="rep-kpis">
      ${kpi('money', 'Faturamento Bruto', fmt.currency(bruto), `${list.length} vendas`)}
      ${kpi('trendUp', 'Faturamento Líquido', fmt.currency(liquido), `− ${fmt.currency(taxasCartao)} em taxas`)}
      ${kpi('box', 'Lucro Bruto', fmt.currency(lucroBruto), `− ${fmt.currency(custoProdutos)} de custo · margem ${bruto ? (lucroBruto / bruto * 100).toFixed(1) : 0}%`)}
      ${kpi('trendUp', 'Lucro Líquido', fmt.currency(lucroLiquido), `após taxas e entregas · margem ${bruto ? (lucroLiquido / bruto * 100).toFixed(1) : 0}%`)}
      ${kpi('cart', 'Ticket Médio', fmt.currency(ticket), `${list.length} pedidos`)}
      ${kpi('alert', 'Descontos', fmt.currency(descontos), 'concedidos no período')}
      ${kpi('money', 'Taxas de Cartão/PIX', fmt.currency(taxasCartao), 'descontadas das maquininhas')}
      ${kpi('delivery', 'Taxas de Entrega', fmt.currency(taxasEntrega), `${entregaCount} entregas`)}
    </section>

    <section class="dash-row" style="margin-top:var(--sp-4)">
      <div class="panel">
        <div class="panel-head"><h4>Vendas por dia</h4>
          <span class="text-mute small">Total <strong class="text-gold">${fmt.currency(bruto)}</strong></span>
        </div>
        ${barChart(dayEntries.map(d => ({
          label: new Date(d.ts).toLocaleDateString('pt-BR', { timeZone: 'America/Manaus', day: '2-digit', month: '2-digit' }),
          short: new Date(d.ts).toLocaleDateString('pt-BR', { timeZone: 'America/Manaus', day: '2-digit' }),
          value: d.v
        })), 'currency')}
      </div>
      <div class="panel">
        <div class="panel-head"><h4>Formas de pagamento</h4></div>
        ${paymentBreakdown(byPay, bruto)}
      </div>
    </section>

    <section class="dash-row" style="margin-top:var(--sp-4)">
      <div class="panel">
        <div class="panel-head"><h4>Horários de pico</h4>
          <span class="text-mute small">por nº de vendas</span>
        </div>
        ${hourChart(byHour)}
      </div>
      <div class="panel rep-fiado">
        <div class="panel-head"><h4>Fiado em aberto</h4></div>
        <div class="rep-fiado-big">
          <div class="rep-fiado-val">${fmt.currency(fiadoTotal)}</div>
          <div class="text-mute small">${fiadoOpen.length} fiado${fiadoOpen.length === 1 ? '' : 's'} a receber</div>
        </div>
        ${fiadoOpen.length === 0
          ? '<p class="text-mute small">Nenhum fiado em aberto. 👍</p>'
          : `<div class="list-compact">${fiadoOpen.slice(0, 8).map(s => `
              <div class="list-row" style="gap:6px">
                <div class="list-rank">${icon('user', { size: 13 })}</div>
                <div class="list-row-body" style="flex:1;min-width:0">
                  <div class="list-row-title">${fmt.escape(s.customer?.name || 'Cliente avulso')}</div>
                  <div class="list-row-sub">${s.code || ''} · ${fmt.date(s.createdAt)}</div>
                </div>
                <div class="list-row-meta" style="flex-shrink:0">${fmt.currency(s.total)}</div>
                <button class="btn btn-ghost btn-sm rep-settle-fiado"
                        data-id="${s.id}"
                        style="flex-shrink:0;color:#27ae60;border-color:#27ae60;opacity:.8"
                        title="Marcar como quitado">
                  ✓ Quitado
                </button>
              </div>`).join('')}
              ${fiadoOpen.length > 8 ? `<div class="text-mute small" style="padding:6px 4px">+ ${fiadoOpen.length - 8} outros</div>` : ''}
            </div>`}
      </div>
    </section>

    <section class="dash-row" style="margin-top:var(--sp-4)">
      <div class="panel">
        <div class="panel-head"><h4>Produtos mais vendidos</h4></div>
        <div class="rep-prod-list">
          ${topProd.map((p, i) => `
            <div class="rep-prod-row">
              <span class="rep-prod-rank">${i + 1}</span>
              ${productImage(p, { cls: 'prod-img-sm' })}
              <div class="rep-prod-info">
                <div class="rep-prod-name">${fmt.escape(p.name)}</div>
                <div class="text-mute small">${p.qty} un · ${fmt.escape(p.category || '')}</div>
              </div>
              <div class="rep-prod-rev">${fmt.currency(p.revenue)}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h4>Doses & Copão</h4>
          <span class="text-mute small">vendas no balcão</span>
        </div>
        <div class="rep-dose">
          <div class="rep-dose-card">
            <div class="rep-dose-num">${doseQty}</div>
            <div class="text-mute small">doses / copões vendidos</div>
          </div>
          <div class="rep-dose-card">
            <div class="rep-dose-num text-gold">${fmt.currency(doseRevenue)}</div>
            <div class="text-mute small">faturado em doses</div>
          </div>
        </div>
        ${doseRanking()}
      </div>
    </section>

    <section class="panel" style="margin-top:var(--sp-4)" id="rep-recent-sales">
      <div class="panel-head">
        <h4>Vendas recentes</h4>
        <span class="text-mute small">últimas 20 — clique para cancelar se necessário</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>Código</th><th>Data/Hora</th><th>Cliente</th>
            <th>Itens</th><th>Pagamento</th>
            <th class="cell-num">Total</th><th>Status</th><th></th>
          </tr></thead>
          <tbody id="rep-recent-tbody">
            ${sales.slice(0, 20).map(s => {
              const isCancelled = s.status === 'cancelled';
              const dt = s.createdAt
                ? new Date(s.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Manaus', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';
              const PAY = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };
              const itemSummary = (s.items || []).slice(0, 2).map(i => `${i.qty}× ${fmt.escape(i.name)}`).join(', ')
                + ((s.items || []).length > 2 ? ` +${(s.items || []).length - 2}` : '');
              return `<tr>
                <td class="cell-mono">${fmt.escape(s.code || '—')}</td>
                <td class="text-mute small">${dt}</td>
                <td>${fmt.escape(s.customer?.name || 'Avulso')}</td>
                <td style="font-size:.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemSummary}</td>
                <td><span class="badge">${PAY[s.paymentMethod] || s.paymentMethod || '—'}</span></td>
                <td class="cell-num bold">${fmt.currency(s.total)}</td>
                <td>${isCancelled
                  ? '<span class="badge badge-danger">Cancelada</span>'
                  : '<span class="badge badge-success badge-dot">Paga</span>'}</td>
                <td>${isCancelled ? '' : `
                  <button class="btn btn-ghost btn-sm rep-cancel-sale"
                          data-id="${s.id}"
                          style="color:var(--danger);border-color:var(--danger);opacity:.7"
                          title="Cancelar esta venda e estornar estoque">
                    Cancelar
                  </button>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // Wire cancel buttons on recent sales list
  box.querySelectorAll('.rep-cancel-sale').forEach(btn => {
    btn.onclick = () => cancelSale(btn.dataset.id);
  });

  // Wire fiado settlement buttons
  box.querySelectorAll('.rep-settle-fiado').forEach(btn => {
    btn.onclick = () => settleFiado(btn.dataset.id);
  });

  function doseRanking() {
    const doses = Object.values(prodAgg)
      .filter(p => p.category === 'Dose')
      .sort((a, b) => b.qty - a.qty);
    if (doses.length === 0) return '<p class="text-mute small">Sem vendas de dose no período.</p>';
    const max = Math.max(...doses.map(d => d.qty), 1);
    return `<div class="list-compact" style="margin-top:var(--sp-3)">
      ${doses.map(d => `
        <div class="rep-dose-bar-row">
          <span class="rep-dose-bar-name">${fmt.escape(d.name)}</span>
          <span class="rep-dose-bar-track"><span class="rep-dose-bar-fill" style="width:${(d.qty / max) * 100}%"></span></span>
          <span class="rep-dose-bar-qty">${d.qty}</span>
        </div>`).join('')}
    </div>`;
  }
}

function exportCSV() {
  if (!state.data) { ui.toast('Dados ainda carregando.', 'info'); return; }
  const { sales } = state.data;
  const start = rangeStart();
  const end   = rangeEnd();
  const list  = sales.filter(s => s.createdAt >= start && s.createdAt <= end && s.status !== 'cancelled');
  if (list.length === 0) { ui.toast('Nenhuma venda no período para exportar.', 'info'); return; }

  const PAY = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };
  const rows = [
    ['Código', 'Data', 'Hora', 'Cliente', 'Itens', 'Pagamento', 'Subtotal', 'Desconto', 'Taxa Entrega', 'Total'],
    ...list.map(s => {
      const dt   = new Date(s.createdAt);
      const date = dt.toLocaleDateString('pt-BR',  { timeZone: 'America/Manaus' });
      const time = dt.toLocaleTimeString('pt-BR',  { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' });
      const itens = (s.items || []).map(i => `${i.qty}x ${i.name}`).join(' | ');
      const num = v => (Number(v) || 0).toFixed(2).replace('.', ',');
      return [
        s.code || '',
        date, time,
        s.customer?.name || 'Avulso',
        itens,
        PAY[s.paymentMethod] || s.paymentMethod || '',
        num(s.subtotal),
        num(s.discount),
        num(s.deliveryFee),
        num(s.total)
      ];
    })
  ];

  const csv  = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  ui.toast(`${list.length} vendas exportadas.`, 'success');
}

async function settleFiado(saleId) {
  const sale = state.data?.sales?.find(s => s.id === saleId);
  if (!sale) { ui.toast('Venda não encontrada.', 'warning'); return; }
  if (sale.fiadoSettled) { ui.toast('Este fiado já foi quitado.', 'info'); return; }

  const ok = await ui.confirm({
    title: 'Quitar fiado',
    message: `Marcar ${sale.code || 'esta venda'} de ${sale.customer?.name || 'cliente avulso'} (${fmt.currency(sale.total)}) como quitado?`,
    okText: 'Confirmar quitação',
    cancelText: 'Cancelar'
  });
  if (!ok) return;

  try {
    await db.update('sales', saleId, { fiadoSettled: true, settledAt: Date.now() });
    const idx = state.data.sales.findIndex(s => s.id === saleId);
    if (idx >= 0) state.data.sales[idx] = { ...state.data.sales[idx], fiadoSettled: true, settledAt: Date.now() };
    ui.toast(`Fiado de ${sale.customer?.name || 'avulso'} marcado como quitado.`, 'success');
    paint();
  } catch (err) {
    ui.toast(err.message || 'Erro ao quitar fiado.', 'danger');
  }
}

async function cancelSale(saleId) {
  const sale = state.data?.sales?.find(s => s.id === saleId);
  if (!sale) { ui.toast('Venda não encontrada.', 'warning'); return; }
  if (sale.status === 'cancelled') { ui.toast('Esta venda já está cancelada.', 'info'); return; }

  const ok = await ui.confirm({
    title: 'Cancelar venda',
    message: `Cancelar ${sale.code || 'esta venda'} (${fmt.currency(sale.total)})? O estoque dos itens será restituído automaticamente.`,
    okText: 'Cancelar venda',
    cancelText: 'Manter',
    danger: true
  });
  if (!ok) return;

  try {
    await db.update('sales', saleId, { status: 'cancelled', cancelledAt: Date.now() });

    // Restituir estoque via transação
    const stockItems = (sale.items || [])
      .filter(i => i.productId)
      .map(i => ({ productId: i.productId, qty: Number(i.qty) || 0 }))
      .filter(i => i.qty > 0);
    if (stockItems.length) await db.runStockTransaction(stockItems, { reverse: true });

    // Atualiza state local para refletir imediatamente sem recarregar
    const idx = state.data.sales.findIndex(s => s.id === saleId);
    if (idx >= 0) state.data.sales[idx] = { ...state.data.sales[idx], status: 'cancelled', cancelledAt: Date.now() };

    ui.toast(`Venda ${sale.code || ''} cancelada. Estoque restituído.`, 'success');
    paint(); // re-render com a venda marcada como cancelada
  } catch (err) {
    ui.toast(err.message || 'Erro ao cancelar venda.', 'danger');
  }
}

function kpi(ic, label, value, foot) {
  return `<div class="kpi">
    <div class="kpi-icon">${icon(ic, { size: 20 })}</div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-foot">${foot}</div>
  </div>`;
}

function barChart(items, fmtType) {
  if (items.length === 0) return '<p class="text-mute small">Sem dados.</p>';
  const max = Math.max(...items.map(i => i.value), 1);
  return `<div class="rep-bars">
    ${items.map(i => `
      <div class="rep-bar-col" title="${i.label}: ${fmtType === 'currency' ? fmt.currency(i.value) : i.value}">
        <div class="rep-bar" style="height:${Math.max(3, (i.value / max) * 100)}%"></div>
        <span class="rep-bar-lbl">${i.short || i.label}</span>
      </div>`).join('')}
  </div>`;
}

function hourChart(byHour) {
  const max = Math.max(...byHour, 1);
  return `<div class="rep-bars rep-bars-hour">
    ${byHour.map((v, h) => `
      <div class="rep-bar-col" title="${String(h).padStart(2, '0')}h: ${v} vendas">
        <div class="rep-bar ${v === max ? 'peak' : ''}" style="height:${Math.max(3, (v / max) * 100)}%"></div>
        <span class="rep-bar-lbl">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>
      </div>`).join('')}
  </div>`;
}

function paymentBreakdown(byPay, bruto) {
  const order = ['dinheiro', 'pix', 'debito', 'credito', 'fiado'];
  const rows = order.filter(p => byPay[p]).map(p => {
    const d = byPay[p];
    const pct = bruto ? (d.value / bruto * 100) : 0;
    return { id: p, ...d, pct };
  });
  if (rows.length === 0) return '<p class="text-mute small">Sem dados.</p>';
  return `
    <div class="rep-pay-track">
      ${rows.map(r => `<span class="rep-pay-seg" style="width:${r.pct}%;background:${PAY_COLOR[r.id]}" title="${PAY_LABEL[r.id]} ${r.pct.toFixed(1)}%"></span>`).join('')}
    </div>
    <div class="list-compact" style="margin-top:var(--sp-3)">
      ${rows.map(r => `
        <div class="rep-pay-row">
          <span class="rep-pay-dot" style="background:${PAY_COLOR[r.id]}"></span>
          <span class="rep-pay-name">${PAY_LABEL[r.id]}</span>
          <span class="rep-pay-count text-mute small">${r.count} venda${r.count === 1 ? '' : 's'}</span>
          <span class="rep-pay-pct">${r.pct.toFixed(1)}%</span>
          <span class="rep-pay-val">${fmt.currency(r.value)}</span>
        </div>`).join('')}
    </div>`;
}

/* ─── Visão simplificada para vendedor ───────────────────────── */
async function renderSellerHistory(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Histórico do dia</h3>
      <div id="hist-date" class="text-mute small"></div>
    </div>
    <div id="hist-body" style="display:flex;flex-direction:column;gap:var(--sp-4)">
      <div class="rep-loading">Carregando…</div>
    </div>
  `;

  const { startOfDay } = manausNow();
  const allSales = await db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' });
  const today = allSales.filter(s => (s.createdAt || 0) >= startOfDay);

  const dateStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Manaus', weekday: 'long', day: '2-digit', month: 'long' });
  root.querySelector('#hist-date').textContent = dateStr;

  const body = root.querySelector('#hist-body');

  // Totais
  const total    = today.reduce((s, v) => s + (v.total || 0), 0);
  const payTally = {};
  today.forEach(s => { payTally[s.paymentMethod] = (payTally[s.paymentMethod] || 0) + (s.total || 0); });
  const PAY = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado' };

  body.innerHTML = `
    <!-- KPI -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">
      <div class="kpi-card">
        <div class="kpi-label">Total hoje</div>
        <div class="kpi-value">${fmt.currency(total)}</div>
        <div class="kpi-sub">${today.length} venda${today.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Formas de pagamento</div>
        <div style="margin-top:var(--sp-2)">
          ${Object.entries(payTally).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;font-size:.85rem;padding:2px 0">
               <span class="text-mute">${PAY[k] || k}</span>
               <span class="bold">${fmt.currency(v)}</span>
             </div>`).join('') || '<span class="text-mute small">Sem vendas</span>'}
        </div>
      </div>
    </div>

    <!-- Lista de vendas -->
    <div class="table-wrap">
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>Horário</th><th>Itens</th><th>Pagamento</th><th class="cell-num">Total</th>
          </tr></thead>
          <tbody>
            ${today.length === 0 ? `<tr><td colspan="4"><div class="empty-state">${icon('sales',{size:40})}<h4>Nenhuma venda hoje</h4></div></td></tr>` :
              today.map(s => {
                const time = s.createdAt
                  ? new Date(s.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' })
                  : '--:--';
                const items = (s.items || []).map(i => `${i.qty}× ${i.name}`).join(', ');
                return `<tr>
                  <td class="cell-mono">${time}</td>
                  <td style="font-size:.82rem;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items}</td>
                  <td><span class="badge">${PAY[s.paymentMethod] || s.paymentMethod || '-'}</span></td>
                  <td class="cell-num bold">${fmt.currency(s.total)}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
