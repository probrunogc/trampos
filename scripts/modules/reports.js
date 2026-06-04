/**
 * Módulo: Relatórios
 * Relatório financeiro completo: bruto x líquido, formas de pagamento,
 * fiados, produtos mais vendidos, horários de pico, entregas, doses/copão.
 */
import { db, fmt, icon, clearNode, manausNow, auth } from '../core.js';
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
  { id: '7',   label: '7 dias' },
  { id: '30',  label: '30 dias' },
  { id: 'mes', label: 'Este mês' }
];

let state = { period: '30', data: null };

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
        <button class="btn btn-ghost" id="rep-print">${icon('print', { size: 16 })}<span>Imprimir</span></button>
      </div>
    </div>
    <div id="rep-body"><div class="rep-loading">Carregando dados…</div></div>
  `;

  root.querySelectorAll('#rep-period .seg-btn').forEach(b => {
    b.onclick = () => {
      state.period = b.dataset.p;
      root.querySelectorAll('#rep-period .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      paint();
    };
  });
  root.querySelector('#rep-print').onclick = () => window.print();

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
    if (settings.feeDebito != null) fees.debito = Number(settings.feeDebito);
    if (settings.feeCredito != null) fees.credito = Number(settings.feeCredito);
  }
  const costMap = {};
  products.forEach(p => { costMap[p.id] = Number(p.costPrice) || 0; });
  const doseIds = new Set(products.filter(p => p.category === 'Dose').map(p => p.id));
  state.data = { sales, products, fees, costMap, doseIds };
}

function rangeStart() {
  const { startOfMonth, startOfDay } = manausNow();
  if (state.period === 'mes') return startOfMonth;
  const days = Number(state.period);
  return startOfDay - (days - 1) * 24 * 60 * 60 * 1000;
}

function paint() {
  const box = document.getElementById('rep-body');
  const { sales, fees, costMap, doseIds } = state.data;
  const start = rangeStart();
  const list = sales.filter(s => s.createdAt >= start && s.status !== 'cancelled');

  if (list.length === 0) {
    box.innerHTML = `<div class="empty-state">${icon('trendUp', { size: 56 })}
      <h4>Sem vendas no período</h4><p>Nenhuma venda registrada nesse intervalo.</p></div>`;
    return;
  }

  // ---- agregados ----
  let bruto = 0, descontos = 0, taxasEntrega = 0, taxasCartao = 0, custoProdutos = 0;
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
      custoProdutos += qty * (costMap[it.productId] || 0);
      if (doseIds.has(it.productId)) { doseQty += qty; doseRevenue += rev; }
    });

    if (s.delivery) entregaCount++;
    if (s.paymentMethod === 'fiado' && !s.fiadoSettled) fiadoOpen.push(s);
  });

  const liquido = bruto - taxasCartao;
  const lucro = bruto - custoProdutos - taxasCartao - taxasEntrega;
  const ticket = bruto / list.length;
  const fiadoTotal = fiadoOpen.reduce((a, s) => a + (Number(s.total) || 0), 0);

  const topProd = Object.values(prodAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // dias ordenados
  const dayEntries = Object.entries(byDay).map(([ts, v]) => ({ ts: +ts, v }))
    .sort((a, b) => a.ts - b.ts);

  box.innerHTML = `
    <section class="rep-kpis">
      ${kpi('money', 'Faturamento Bruto', fmt.currency(bruto), `${list.length} vendas`)}
      ${kpi('trendUp', 'Faturamento Líquido', fmt.currency(liquido), `− ${fmt.currency(taxasCartao)} em taxas de cartão`)}
      ${kpi('box', 'Lucro Estimado', fmt.currency(lucro), `margem ${bruto ? (lucro / bruto * 100).toFixed(1) : 0}%`)}
      ${kpi('cart', 'Ticket Médio', fmt.currency(ticket), `${list.length} pedidos`)}
      ${kpi('alert', 'Descontos', fmt.currency(descontos), 'concedidos no período')}
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
          : `<div class="list-compact">${fiadoOpen.slice(0, 6).map(s => `
              <div class="list-row">
                <div class="list-rank">${icon('user', { size: 13 })}</div>
                <div class="list-row-body">
                  <div class="list-row-title">${fmt.escape(s.customer?.name || 'Cliente avulso')}</div>
                  <div class="list-row-sub">${s.code || ''} · ${fmt.date(s.createdAt)}</div>
                </div>
                <div class="list-row-meta">${fmt.currency(s.total)}</div>
              </div>`).join('')}
              ${fiadoOpen.length > 6 ? `<div class="text-mute small" style="padding:6px 4px">+ ${fiadoOpen.length - 6} outros</div>` : ''}
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
  `;

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
  const today = allSales.filter(s => (s.createdAt?.seconds || 0) * 1000 >= startOfDay);

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
                const time = s.createdAt?.seconds
                  ? new Date(s.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' })
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
