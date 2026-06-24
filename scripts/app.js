/**
 * APP BOOT — Empório das Bebidas
 * Inicializa: seed (demo), restaura sessão, registra rotas, monta sidebar,
 * conecta login/logout, gerencia tela inicial.
 */
import { auth, router, ui, icon, fmt, seedDemoIfNeeded, kioskPrefs, $, $$ } from './core.js';

import * as Dashboard   from './modules/dashboard.js';
import * as Customers   from './modules/customers.js';
import * as Products    from './modules/products.js';
import * as Banners     from './modules/banners.js';
import * as Sales       from './modules/sales.js';
import * as Reports     from './modules/reports.js';
import * as Deliveries  from './modules/deliveries.js';
import * as Deliverers  from './modules/deliverers.js';
import * as Users       from './modules/users.js';
import * as Settings    from './modules/settings.js';
import * as Stock       from './modules/stock.js';
import * as Register    from './modules/register.js';

const MODULES = [
  Dashboard, Sales, Reports, Customers, Products, Banners, Deliveries, Deliverers, Users, Settings, Stock, Register
];

const SECTIONS = [
  { title: 'Operação',  ids: ['dashboard', 'sales', 'register', 'stock', 'reports', 'deliveries'] },
  { title: 'Cadastros', ids: ['customers', 'products', 'banners', 'deliverers'] },
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

  // Sidebar toggle
  const closeSidebar = () => $('#app-shell').classList.remove('mobile-open');
  $('#btn-sidebar-toggle').onclick = () => {
    const shell = $('#app-shell');
    if (window.innerWidth <= 600) {
      shell.classList.toggle('mobile-open');
    } else {
      shell.classList.toggle('sidebar-collapsed');
    }
  };
  $('#sidebar-overlay').onclick = closeSidebar;

  // Theme toggle
  initTheme();

  // Date in topbar
  const dateEl = $('#topbar-date');
  const updateDate = () => {
    const d = new Date();
    dateEl.textContent = d.toLocaleString('pt-BR', {
      timeZone: 'America/Manaus',
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
  if (localStorage.getItem('_km')) { $('#app-shell').classList.add('kiosk-mode'); setupKioskNav(); }

  // Avatar + chip
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  $('#user-avatar').textContent = initial;
  $('#user-name').textContent = user.name || user.email;
  $('#user-role').textContent = user.role || '—';

  buildSidebar(user);

  // Start router após login — quiosque sempre abre no PDV
  if (!router.current()) {
    if (localStorage.getItem('_km') && !location.hash) location.hash = '#/sales';
    router.start();
  } else {
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

function setupKioskNav() {
  const nav = $('#kiosk-nav');

  // Bloqueia cliques em linhas de tabela — permite botões dentro da linha
  document.addEventListener('click', e => {
    if (e.target.closest('tr.clickable') && !e.target.closest('button, a, [role="button"]')) e.stopImmediatePropagation();
  }, true);

  $('#kiosk-tabs').querySelectorAll('.kiosk-tab').forEach(btn => {
    btn.onclick = () => router.navigate('/' + btn.dataset.mod);
  });

  $('#kiosk-logout').onclick = async () => {
    const ok = await ui.confirm({ title: 'Sair do quiosque', message: 'Encerrar a sessão?', okText: 'Sair' });
    if (!ok) return;
    localStorage.removeItem('_km');
    localStorage.removeItem('_kk');
    await auth.signOut();
    location.href = './kiosk.html';
  };

  // Configurações rápidas do quiosque
  $('#kiosk-settings').onclick = openKioskSettings;

  // Exit fullscreen
  $('#kiosk-fullscreen-exit').onclick = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Minimize → lock screen overlay
  const lockEl = $('#kiosk-lock');
  $('#kiosk-minimize').onclick = () => {
    lockEl.classList.remove('hidden');
    lockEl.setAttribute('aria-hidden', 'false');
  };
  lockEl.onclick = () => {
    lockEl.classList.add('hidden');
    lockEl.setAttribute('aria-hidden', 'true');
  };

  const clockEl = $('#kiosk-clock');
  const tick = () => {
    const n = new Date();
    clockEl.textContent = n.toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' })
      + '  ' + n.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus', weekday: 'short', day: '2-digit', month: 'short' });
  };
  tick();
  setInterval(tick, 15000);

  router.onChange(path => {
    nav.querySelectorAll('.kiosk-tab').forEach(b => {
      b.classList.toggle('active', path === '/' + b.dataset.mod);
    });
  });
}

/* Configurações rápidas do quiosque — preferências locais do terminal */
function openKioskSettings() {
  const autoPrint = kioskPrefs.get('autoPrint');

  const body = document.createElement('div');
  body.className = 'kset-body';
  body.innerHTML = `
    <div class="kset-row">
      <div class="kset-row-text">
        <span class="kset-row-title">Imprimir cupom automaticamente</span>
        <span class="kset-row-desc">
          Quando ligado, o cupom imprime sozinho ao finalizar a venda.
          Desligado, o sistema pergunta antes de imprimir.
        </span>
      </div>
      <label class="switch">
        <input type="checkbox" id="kset-autoprint" ${autoPrint ? 'checked' : ''}>
        <span class="switch-knob"></span>
      </label>
    </div>
  `;

  body.querySelector('#kset-autoprint').onchange = (e) => {
    kioskPrefs.set('autoPrint', e.target.checked);
    ui.toast(
      e.target.checked ? 'Impressão automática ligada' : 'Impressão com confirmação',
      'success'
    );
  };

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-primary';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Pronto';
  closeBtn.onclick = () => ui.closeModal(null);

  ui.modal({ title: 'Configurações do quiosque', body, footer: [closeBtn], narrow: true });
}

async function renderModule(module) {
  const user = auth.currentUser();
  if (!user) return;
  // Garante que nenhum modal fique aberto ao trocar de tela
  ui.closeModal(null);
  if (!userCan(module, user)) {
    ui.toast('Você não tem permissão para acessar este módulo.', 'warning');
    router.navigate('/dashboard');
    return;
  }
  $('#page-title').textContent = module.meta.title || module.meta.label;
  $('#page-subtitle').textContent = module.meta.subtitle || '';
  const content = $('#page-content');
  content.style.animation = 'none';
  void content.offsetWidth;
  content.style.animation = '';
  await module.render(content);
  content.animate([
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 180, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' });
}

function initTheme() {
  const btn = $('#btn-theme');
  const meta = document.getElementById('meta-theme-color');

  const iconSun = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;
  const iconMoon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    btn.innerHTML = theme === 'dark' ? iconSun : iconMoon;
    btn.title = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    if (meta) meta.content = theme === 'light' ? '#f5f0e8' : '#0A1628';
  }

  const saved = localStorage.getItem('emporio:theme') || 'dark';
  apply(saved);

  btn.onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('emporio:theme', next);
    apply(next);
  };
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
