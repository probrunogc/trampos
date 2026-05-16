/**
 * APP BOOT — Empório das Bebidas
 * Inicializa: seed (demo), restaura sessão, registra rotas, monta sidebar,
 * conecta login/logout, gerencia tela inicial.
 */
import { auth, router, ui, icon, fmt, seedDemoIfNeeded, $, $$ } from './core.js';

import * as Dashboard   from './modules/dashboard.js';
import * as Customers   from './modules/customers.js';
import * as Products    from './modules/products.js';
import * as Sales       from './modules/sales.js';
import * as Reports     from './modules/reports.js';
import * as Deliveries  from './modules/deliveries.js';
import * as Deliverers  from './modules/deliverers.js';
import * as Users       from './modules/users.js';
import * as Settings    from './modules/settings.js';

const MODULES = [
  Dashboard, Sales, Reports, Customers, Products, Deliveries, Deliverers, Users, Settings
];

const SECTIONS = [
  { title: 'Operação',  ids: ['dashboard', 'sales', 'reports', 'deliveries'] },
  { title: 'Cadastros', ids: ['customers', 'products', 'deliverers'] },
  { title: 'Sistema',   ids: ['users', 'settings'] }
];

// =============================================================
// Boot
// =============================================================
async function boot() {
  await seedDemoIfNeeded();
  await auth.restore();

  // Registrar rotas
  MODULES.forEach(m => {
    router.register('/' + m.meta.id, async () => {
      await renderModule(m);
    });
  });
  router.register('/', () => router.navigate('/dashboard'));

  // Auth state → mostra login ou app
  auth.onChange(user => {
    const splash = $('#boot-splash');
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 360);
    }
    if (user) {
      showApp(user);
    } else {
      showLogin();
    }
  });

  // Login form
  $('#form-login').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const pass = $('#login-password').value;
    const errEl = $('#login-error');
    const btn = $('#login-submit');
    errEl.textContent = '';
    btn.disabled = true;
    try {
      await auth.signIn(email, pass);
    } catch (err) {
      errEl.textContent = err.message || 'Falha no login';
      btn.disabled = false;
    }
  };

  // Bootstrap: primeiro acesso
  $('#link-bootstrap').onclick = (e) => {
    e.preventDefault();
    $('#screen-login').classList.add('hidden');
    $('#screen-bootstrap').classList.remove('hidden');
    $('#bs-name').focus();
  };
  $('#link-back-login').onclick = (e) => {
    e.preventDefault();
    $('#screen-bootstrap').classList.add('hidden');
    $('#screen-login').classList.remove('hidden');
  };
  $('#form-bootstrap').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#bs-name').value.trim();
    const email = $('#bs-email').value.trim();
    const p1 = $('#bs-password').value;
    const p2 = $('#bs-password2').value;
    const errEl = $('#bootstrap-error');
    const btn = $('#bs-submit');
    errEl.textContent = '';
    if (p1 !== p2) { errEl.textContent = 'As senhas não coincidem.'; return; }
    if (p1.length < 6) { errEl.textContent = 'Senha deve ter no mínimo 6 caracteres.'; return; }
    btn.disabled = true;
    try {
      await auth.bootstrapAdmin(name, email, p1);
      ui.toast(`Administrador "${name}" criado com sucesso!`, 'success', { title: 'Bem-vindo' });
      // showApp será chamado automaticamente pelo listener de auth
    } catch (err) {
      errEl.textContent = err.message || 'Erro ao criar administrador';
      btn.disabled = false;
    }
  };

  // Logout
  $('#btn-logout').onclick = async () => {
    const ok = await ui.confirm({
      title: 'Sair do sistema',
      message: 'Deseja realmente sair?',
      okText: 'Sair'
    });
    if (ok) {
      await auth.signOut();
    }
  };

  // Sidebar toggle (mobile)
  $('#btn-sidebar-toggle').onclick = () => {
    const shell = $('#app-shell');
    if (window.innerWidth <= 600) {
      shell.classList.toggle('mobile-open');
    } else {
      shell.classList.toggle('sidebar-collapsed');
    }
  };

  // Date in topbar
  const dateEl = $('#topbar-date');
  const updateDate = () => {
    const d = new Date();
    dateEl.textContent = d.toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  };
  updateDate();
  setInterval(updateDate, 30000);

  // Start router (mas só se logado — caso contrário aguarda login)
  if (auth.currentUser()) {
    router.start();
  }
}

function showLogin() {
  $('#app-shell').classList.add('hidden');
  $('#screen-bootstrap').classList.add('hidden');
  $('#screen-login').classList.remove('hidden');
  $('#login-email').focus();
  $('#login-error').textContent = '';
  $('#login-submit').disabled = false;
}

function showApp(user) {
  $('#screen-login').classList.add('hidden');
  $('#screen-bootstrap').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');

  // Avatar + chip
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  $('#user-avatar').textContent = initial;
  $('#user-name').textContent = user.name || user.email;
  $('#user-role').textContent = user.role || '—';

  buildSidebar(user);

  // Start router após login
  if (!router.current()) {
    router.start();
  } else {
    // re-render rota atual com user atual
    router._handleRoute();
  }
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
    const allowedMods = section.ids
      .map(id => MODULES.find(m => m.meta.id === id))
      .filter(m => m && userCan(m, user));
    if (allowedMods.length === 0) return;

    const title = document.createElement('div');
    title.className = 'nav-section';
    title.textContent = section.title;
    nav.appendChild(title);

    allowedMods.forEach(m => {
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

  // Marcar ativo conforme rota
  router.onChange((path) => {
    $$('.nav-item').forEach(n => {
      const id = n.dataset.module;
      n.classList.toggle('active', path === '/' + id);
    });
    // Fechar mobile menu
    if (window.innerWidth <= 600) $('#app-shell').classList.remove('mobile-open');
  });
}

async function renderModule(module) {
  const user = auth.currentUser();
  if (!user) return;
  if (!userCan(module, user)) {
    ui.toast('Você não tem permissão para acessar este módulo.', 'warning');
    router.navigate('/dashboard');
    return;
  }
  $('#page-title').textContent = module.meta.title || module.meta.label;
  $('#page-subtitle').textContent = module.meta.subtitle || '';
  const content = $('#page-content');
  content.style.animation = 'none';
  // force reflow
  void content.offsetWidth;
  content.style.animation = '';
  await module.render(content);
}

// Boot
boot().catch(err => {
  console.error('Boot error:', err);
  const splash = $('#boot-splash');
  if (splash) splash.innerHTML = `
    <div style="text-align: center; max-width: 420px; padding: 32px">
      <h1 class="gold-text" style="font-family: var(--font-brand)">Erro ao iniciar</h1>
      <p style="color: var(--text-3); margin: 16px 0">${err.message || err}</p>
      <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
    </div>
  `;
});
