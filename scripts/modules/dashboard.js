/**
 * Módulo: Dashboard
 * Visão geral do empório — KPIs, top produtos, top clientes, vendas recentes
 */
import { db, fmt, icon, el, clearNode, manausNow } from '../core.js';
import { productImage } from '../product-art.js';

export const meta = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'dashboard',
  title: 'Dashboard',
  subtitle: 'Visão geral do empório',
  roles: ['admin', 'vendedor']
};

export async function render(root) {
  clearNode(root);

  // Loading skeleton
  root.innerHTML = `<div class="dash-grid">
    ${Array.from({ length: 4 }, () => `<div class="kpi" style="height:130px"></div>`).join('')}
  </div>`;

  const [sales, products, customers, deliveries] = await Promise.all([
    db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' }),
    db.list('products'),
    db.list('customers'),
    db.list('deliverers')
  ]);

  const { startOfDay, startOfMonth, startOfPrevMonth } = manausNow();

  const todaySales = sales.filter(s => s.createdAt >= startOfDay && s.status !== 'cancelled');
  const monthSales = sales.filter(s => s.createdAt >= startOfMonth && s.status !== 'cancelled');
  const prevMonthSales = sales.filter(s => s.createdAt >= startOfPrevMonth && s.createdAt < startOfMonth && s.status !== 'cancelled');

  const revenueToday = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const revenueMonth = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const revenuePrevMonth = prevMonthSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const monthDelta = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null;

  const lowStock = products.filter(p => p.stock != null && p.minStock != null && p.stock <= p.minStock);
  const pendingDeliveries = sales.filter(s => s.delivery && s.delivery.status === 'pending').length;

  // Top produtos do mês
  const productSales = {};
  monthSales.forEach(s => {
    (s.items || []).forEach(i => {
      const key = i.productId || i.name;
      if (!productSales[key]) {
        const prod = products.find(p => p.id === i.productId) || {};
        productSales[key] = { name: i.name, art: prod.art, image: prod.image, category: prod.category, qty: 0, revenue: 0 };
      }
      productSales[key].qty += Number(i.qty) || 0;
      productSales[key].revenue += (Number(i.qty) || 0) * (Number(i.unitPrice) || 0);
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Top clientes do mês
  const customerSales = {};
  monthSales.forEach(s => {
    if (!s.customer) return;
    const key = s.customer.id || s.customer.name;
    if (!customerSales[key]) customerSales[key] = { name: s.customer.name, count: 0, revenue: 0 };
    customerSales[key].count += 1;
    customerSales[key].revenue += s.total || 0;
  });
  const topCustomers = Object.values(customerSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Sparkline últimas 14 dias
  const days = 14;
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return { ts: d.getTime(), label: String(d.getDate()).padStart(2, '0'), value: 0 };
  });
  sales.forEach(s => {
    if (s.status === 'cancelled') return;
    const d = new Date(s.createdAt);
    d.setHours(0, 0, 0, 0);
    const b = buckets.find(b => b.ts === d.getTime());
    if (b) b.value += s.total || 0;
  });
  const maxBucket = Math.max(...buckets.map(b => b.value), 1);

  root.innerHTML = `
    <section class="dash-grid">
      <div class="kpi">
        <div class="kpi-icon">${icon('money', { size: 22 })}</div>
        <div class="kpi-label">Faturamento Hoje</div>
        <div class="kpi-value">${fmt.currency(revenueToday)}</div>
        <div class="kpi-foot">${todaySales.length} venda${todaySales.length === 1 ? '' : 's'} hoje</div>
      </div>

      <div class="kpi">
        <div class="kpi-icon">${icon('trendUp', { size: 22 })}</div>
        <div class="kpi-label">Faturamento Mês</div>
        <div class="kpi-value">${fmt.currency(revenueMonth)}</div>
        <div class="kpi-foot">
          ${monthDelta == null
            ? '<span class="text-mute">sem comparativo</span>'
            : `<span class="kpi-delta ${monthDelta >= 0 ? 'up' : 'down'}">
                 ${icon(monthDelta >= 0 ? 'trendUp' : 'trendDown', { size: 12 })}
                 ${Math.abs(monthDelta).toFixed(1)}% vs mês passado
               </span>`}
        </div>
      </div>

      <div class="kpi">
        <div class="kpi-icon">${icon('customers', { size: 22 })}</div>
        <div class="kpi-label">Clientes</div>
        <div class="kpi-value">${customers.length}</div>
        <div class="kpi-foot">${monthSales.filter(s => s.customer).length} pedidos com cliente este mês</div>
      </div>

      <div class="kpi">
        <div class="kpi-icon">${icon('delivery', { size: 22 })}</div>
        <div class="kpi-label">Entregas Pendentes</div>
        <div class="kpi-value">${pendingDeliveries}</div>
        <div class="kpi-foot">${deliveries.length} entregador${deliveries.length === 1 ? '' : 'es'} ativo${deliveries.length === 1 ? '' : 's'}</div>
      </div>
    </section>

    <section class="dash-shortcuts" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:var(--sp-5)">
      <a href="/cadastro" target="_blank" rel="noopener" class="shortcut-card" style="
          display:flex;align-items:center;gap:14px;padding:16px 18px;
          background:var(--surface-2);border:1px solid var(--line);border-radius:12px;
          text-decoration:none;color:inherit;transition:border-color .15s,box-shadow .15s;cursor:pointer"
        onmouseover="this.style.borderColor='var(--gold-400)';this.style.boxShadow='0 0 0 2px rgba(212,175,55,.18)'"
        onmouseout="this.style.borderColor='var(--line)';this.style.boxShadow=''">
        <div style="font-size:1.7rem;line-height:1">📦</div>
        <div>
          <div style="font-weight:600;font-size:.88rem;margin-bottom:2px">Registro Rápido</div>
          <div style="font-size:.75rem;color:var(--text-3)">Escanear e cadastrar produtos</div>
        </div>
        <div style="margin-left:auto;color:var(--text-3);font-size:.8rem">↗</div>
      </a>
    </section>

    <section class="dash-row">
      <div class="panel">
        <div class="panel-head">
          <h4>Vendas — últimos 14 dias</h4>
          <span class="text-mute small">Total: <strong class="text-gold">${fmt.currency(buckets.reduce((s, b) => s + b.value, 0))}</strong></span>
        </div>
        <div class="spark">
          ${buckets.map(b => `
            <div class="spark-bar" style="height:${Math.max(4, (b.value / maxBucket) * 100)}%" data-label="${b.label}" title="${b.label}: ${fmt.currency(b.value)}"></div>
          `).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h4>Atenção</h4></div>
        ${lowStock.length === 0
          ? `<p class="text-mute small">✅ Estoques OK. Nenhum produto abaixo do mínimo.</p>`
          : `<div class="list-compact">
              ${lowStock.slice(0, 5).map(p => `
                <div class="list-row">
                  <div class="list-rank">!</div>
                  <div class="list-row-body">
                    <div class="list-row-title">${fmt.escape(p.name)}</div>
                    <div class="list-row-sub">Estoque: ${p.stock} · Mín: ${p.minStock}</div>
                  </div>
                  <span class="badge badge-warning">Baixo</span>
                </div>
              `).join('')}
            </div>`}
      </div>
    </section>

    <section class="dash-row" style="margin-top: var(--sp-4)">
      <div class="panel">
        <div class="panel-head"><h4>Top produtos do mês</h4></div>
        ${topProducts.length === 0
          ? '<p class="text-mute small">Sem vendas neste mês ainda.</p>'
          : `<div class="list-compact">
              ${topProducts.map((p, i) => `
                <div class="list-row">
                  <div class="list-rank">${i + 1}</div>
                  ${productImage(p, { cls: 'prod-img-sm' })}
                  <div class="list-row-body">
                    <div class="list-row-title">${fmt.escape(p.name)}</div>
                    <div class="list-row-sub">${p.qty} unidades vendidas</div>
                  </div>
                  <div class="list-row-meta">${fmt.currency(p.revenue)}</div>
                </div>
              `).join('')}
             </div>`}
      </div>
      <div class="panel">
        <div class="panel-head"><h4>Top clientes do mês</h4></div>
        ${topCustomers.length === 0
          ? '<p class="text-mute small">Sem pedidos vinculados a clientes este mês.</p>'
          : `<div class="list-compact">
              ${topCustomers.map((c, i) => `
                <div class="list-row">
                  <div class="list-rank">${i + 1}</div>
                  <div class="list-row-body">
                    <div class="list-row-title">${fmt.escape(c.name)}</div>
                    <div class="list-row-sub">${c.count} pedido${c.count === 1 ? '' : 's'}</div>
                  </div>
                  <div class="list-row-meta">${fmt.currency(c.revenue)}</div>
                </div>
              `).join('')}
             </div>`}
      </div>
    </section>
  `;
}
