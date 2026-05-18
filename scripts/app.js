/**
 * APP — CAIXA (Empório das Bebidas)
 * Sistema do balcão. O operador escolhe o nome (Rafael / Neto) e opera.
 * Login no Firebase é anônimo e automático — sem senha.
 */
import { auth, router, ui, icon, seedDemoIfNeeded, $, $$ } from './core.js';

import * as Sales       from './modules/sales.js';
import * as Customers   from './modules/customers.js';
import * as Products    from './modules/products.js';
import * as Deliveries  from './modules/deliveries.js';
import * as Deliverers  from './modules/deliverers.js';

const OPERATORS = ['Rafael', 'Neto'];

const MODULES = [Sales, Customers, Products, Deliveries, Deliverers];
const SECTIONS = [
  { title: 'Operação',  ids: ['sales', 'deliveries'] },
  { title: 'Cadastros', ids: ['customers', 'products', 'deliverers'] }
];

// =============================================================
async function boot() {
  await seedDemoIfNeeded();

  try {
    await auth.ensureAnon();
  } catch (err) {
    return showFatal('Sem conexão com o servidor. Verifique a internet e recarregue.');
  }

  // Rotas
  MODULES.forEach(m => {
    router.register('/' + m.meta.id, async () => { await renderModule(m); });
  });
  router.register('/', () => router.navigate('/sales'));
  router.register('/dashboard', () => router.navigate('/sales'));

  buildOperatorPicker();

  // Restaura operador salvo ANTES de registrar o listener (evita piscar)
  const saved = auth.operator();
  if (saved && OPERATORS.includes(saved)) auth.setOperator(saved);

  auth.onChange(user => {
    hideSplash();
    if (user) showApp(user);
    else showOperatorPicker();
  });

  // Trocar operador
  $('#btn-logout').onclick = async () => {
    const ok = await ui.confirm({
      title: 'Trocar operador',
      message: 'Deseja sair e trocar o operador do caixa?',
      okText: 'Trocar'
    });
    if (ok) auth.clearOperator();
  };

  // Sidebar toggle
  $('#btn-sidebar-toggle').onclick = () => {
    const shell = $('#app-shell');
    if (window.innerWidth <= 600) shell.classList.toggle('mobile-open');
    else shell.classList.toggle('sidebar-collapsed');
  };

  // Relógio na topbar
  const dateEl = $('#topbar-date');
  const updateDate = () => {
    dateEl.textContent = new Date().toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };
  updateDate();
  setInterval(updateDate, 30000);
}

function hideSplash() {
  const splash = $('#boot-splash');
  if (splash && !splash.classList.contains('fade-out')) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 360);
  }
}

function showFatal(msg) {
  const splash = $('#boot-splash');
  if (splash) splash.innerHTML = `
    <div style="text-align:center;max-width:420px;padding:32px">
      <h1 class="gold-text" style="font-family:var(--font-brand)">Ops…</h1>
      <p style="color:var(--text-3);margin:16px 0">${msg}</p>
      <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
    </div>`;
}

// =============================================================
// Seletor de operador
// =============================================================
function buildOperatorPicker() {
  const grid = $('#op-grid');
  if (!grid) return;
  grid.innerHTML = OPERATORS.map(name => `
    <button class="op-btn" data-op="${name}">
      <span class="op-avatar">${name.charAt(0).toUpperCase()}</span>
      <span class="op-name">${name}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.op-btn').forEach(b => {
    b.onclick = () => auth.setOperator(b.dataset.op);
  });
}

function showOperatorPicker() {
  $('#app-shell').classList.add('hidden');
  $('#screen-operator').classList.remove('hidden');
}

function showApp(user) {
  $('#screen-operator').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');

  $('#user-avatar').textContent = (user.name || '?').trim().charAt(0).toUpperCase();
  $('#user-name').textContent = user.name || 'Operador';
  $('#user-role').textContent = 'Operador de caixa';

  buildSidebar(user);

  if (!router.current()) router.start();
  else router._handleRoute();
}

function userCan(module, user) {
  const roles = module.meta.roles || [];
  if (roles.length === 0) return true;
  return roles.includes(user.role);
}

function buildSidebar(user) {
  const nav = $('#sidebar-nav');
  nav.innerHTML = '';

  SECTIONS.forEach(section => {
    const mods = section.ids
      .map(id => MODULES.find(m => m.meta.id === id))
      .filter(m => m && userCan(m, user));
    if (mods.length === 0) return;

    const title = document.createElement('div');
    title.className = 'nav-section';
    title.textContent = section.title;
    nav.appendChild(title);

    mods.forEach(m => {
      const item = document.createElement('button');
      item.className = 'nav-item';
      item.dataset.module = m.meta.id;
      item.innerHTML = `
        <span class="nav-icon">${icon(m.meta.icon, { size: 18 })}</span>
        <span class="nav-item-label">${m.meta.label}</span>
      `;
      item.onclick = () => router.navigate('/' + m.meta.id);
      nav.appendChild(item);
    });
  });

  router.onChange((path) => {
    $$('.nav-item').forEach(n => {
      n.classList.toggle('active', path === '/' + n.dataset.module);
    });
    if (window.innerWidth <= 600) $('#app-shell').classList.remove('mobile-open');
  });
}

async function renderModule(module) {
  const user = auth.currentUser();
  if (!user) return;
  $('#page-title').textContent = module.meta.title || module.meta.label;
  $('#page-subtitle').textContent = module.meta.subtitle || '';
  const content = $('#page-content');
  content.style.animation = 'none';
  void content.offsetWidth;
  content.style.animation = '';
  await module.render(content);
}

boot().catch(err => {
  console.error('Boot error:', err);
  showFatal(err.message || String(err));
});
