/**
 * FINANCEIRO — Painel do dono (mobile-first)
 * Acesso por PIN. Resumo, relatórios, histórico de vendas e ajustes.
 * Login no Firebase é anônimo e automático.
 */
import { auth, db, icon, $, $$ } from './core.js';

import * as Dashboard from './modules/dashboard.js';
import * as Reports   from './modules/reports.js';
import * as History   from './modules/history.js';
import * as Settings  from './modules/settings.js';

const TABS = [
  { id: 'resumo',     label: 'Resumo',     icon: 'dashboard', mod: Dashboard },
  { id: 'relatorios', label: 'Relatórios', icon: 'trendUp',   mod: Reports },
  { id: 'historico',  label: 'Histórico',  icon: 'sales',     mod: History },
  { id: 'ajustes',    label: 'Ajustes',    icon: 'settings',  mod: Settings }
];

let companyPin = '1234';

async function boot() {
  try {
    await auth.ensureAnon();
  } catch (err) {
    return showFatal('Sem conexão com o servidor. Verifique a internet e recarregue.');
  }
  try {
    const company = await db.get('settings', 'company');
    if (company && company.financePin) companyPin = String(company.financePin);
  } catch (_) {}
  hideSplash();
  setupPin();
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
// PIN de acesso
// =============================================================
function setupPin() {
  $('#screen-pin').classList.remove('hidden');
  const pad = $('#pin-pad');
  const dots = $('#pin-dots');
  const err = $('#pin-error');
  let entered = '';

  const renderDots = () => {
    dots.innerHTML = [0, 1, 2, 3]
      .map(i => `<span class="pin-dot ${i < entered.length ? 'filled' : ''}"></span>`).join('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  pad.innerHTML = keys.map(k => k === ''
    ? '<span></span>'
    : `<button class="pin-key" data-k="${k}">${k}</button>`).join('');
  renderDots();

  pad.querySelectorAll('.pin-key').forEach(b => b.onclick = () => {
    err.textContent = '';
    const k = b.dataset.k;
    if (k === '⌫') entered = entered.slice(0, -1);
    else if (entered.length < 4) entered += k;
    renderDots();
    if (entered.length === 4) {
      if (entered === companyPin) {
        $('#screen-pin').classList.add('hidden');
        showApp();
      } else {
        err.textContent = 'PIN incorreto';
        entered = '';
        setTimeout(renderDots, 220);
      }
    }
  });
}

// =============================================================
// Painel
// =============================================================
function showApp() {
  $('#fin-app').classList.remove('hidden');

  const nav = $('#fin-nav');
  nav.innerHTML = TABS.map(t => `
    <button class="fin-nav-btn" data-tab="${t.id}">
      <span class="fin-nav-icon">${icon(t.icon, { size: 21 })}</span>
      <span>${t.label}</span>
    </button>`).join('');
  nav.querySelectorAll('.fin-nav-btn').forEach(b =>
    b.onclick = () => selectTab(b.dataset.tab));

  const dateEl = $('#fin-date');
  dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short'
  });

  selectTab('resumo');
}

async function selectTab(id) {
  const tab = TABS.find(t => t.id === id);
  if (!tab) return;
  $$('.fin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $('#fin-title').textContent = tab.label;

  const content = $('#fin-content');
  content.scrollTop = 0;
  content.style.animation = 'none';
  void content.offsetWidth;
  content.style.animation = '';
  try {
    await tab.mod.render(content);
  } catch (err) {
    content.innerHTML = `<div class="empty-state">
      <h4>Erro ao carregar</h4><p>${err.message || err}</p></div>`;
  }
}

boot().catch(err => showFatal(err.message || String(err)));
