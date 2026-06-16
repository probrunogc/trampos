/**
 * Módulo: Registro Rápido (Estoque)
 * Tela limpa para escanear → checar se o produto já existe → cadastrar.
 * NÃO mexe em quantidade — produtos novos entram com stock 0.
 * Funciona com leitor USB (HID) e com a câmera (ui.scanBarcode).
 */
import { db, fmt, ui, icon, clearNode } from '../core.js';

export const meta = {
  id: 'register',
  label: 'Registro Rápido',
  icon: 'box',
  title: 'Registro Rápido de Produtos',
  subtitle: 'Escanear e cadastrar no estoque',
  roles: ['admin', 'vendedor']
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Cigarro', 'Outros'];

/* ── Cosmos ─────────────────────────────────────────────────── */
const COSMOS_TOKEN = '82haA2Xclw-x7pepzbU0Yg';
async function cosmosLookup(barcode) {
  try {
    const res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${barcode}.json`, {
      headers: { 'X-Cosmos-Token': COSMOS_TOKEN, 'User-Agent': 'Cosmos/1.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function guessCategory(text) {
  const d = norm(text);
  const map = [
    [['cerveja','chopp','pilsen','lager','ipa','weiss','stout'], 'Cerveja'],
    [['refrigerante','coca','pepsi','guarana','fanta','sprite','soda','schweppes'], 'Refrigerante'],
    [['suco','nectar','del valle','sufresh','ades'], 'Suco'],
    [['agua','mineral','crystal','bonafont','indaia'], 'Água'],
    [['energetico','energy','monster','red bull','burn','tnt','baly','fusion'], 'Energético'],
    [['vodka','whisky','whiskey','gin','rum','cachaca','tequila','conhaque','licor','aguardente','bourbon','scotch'], 'Destilado'],
    [['vinho','espumante','champagne','prosecco','frisante'], 'Vinho'],
    [['cigarro','cigarette','cigarrilha','tabaco','fumo','marlboro','winston','lucky','derby','rothmans','camel'], 'Cigarro'],
  ];
  return map.find(([ks]) => ks.some(k => d.includes(k)))?.[1] || null;
}

let _scanBuf = '';
let _scanTimer = null;
let _busy = false;
const _log = [];

export async function render(root) {
  clearNode(root);
  _log.length = 0;

  root.innerHTML = `
    <div class="reg-card">
      <div class="reg-icon">${icon('box', { size: 30 })}</div>
      <div class="reg-title">Escaneie o produto</div>
      <div class="reg-hint">Use o leitor de código de barras ou a câmera</div>

      <div class="reg-input-wrap">
        <input id="reg-input" class="reg-input" inputmode="numeric" autocomplete="off"
               placeholder="Código de barras…" autofocus />
      </div>

      <button class="btn btn-primary reg-cam-btn" id="reg-cam-btn" type="button">
        📷 Escanear com a câmera
      </button>
    </div>

    <div class="reg-result" id="reg-result"></div>

    <div class="reg-log-section">
      <div class="reg-log-title">
        <span>Atividade da sessão</span>
        <span class="reg-log-count" id="reg-log-count">0</span>
      </div>
      <div id="reg-log-list" class="reg-log-list">
        <div class="reg-log-empty">Nenhum produto escaneado ainda.</div>
      </div>
    </div>

    <style>
      .reg-card { background: var(--surface-1, #16263d); border: 1px solid var(--line, rgba(255,255,255,.08));
        border-radius: 18px; padding: 24px 20px; text-align: center; max-width: 560px; margin: 0 auto;
        box-shadow: 0 14px 36px rgba(0,0,0,.25); }
      .reg-icon { width: 60px; height: 60px; margin: 0 auto 12px; border-radius: 16px;
        background: rgba(212,175,55,.1); border: 1px solid var(--gold-400, #d4af37);
        display: flex; align-items: center; justify-content: center; color: var(--gold-400, #d4af37); }
      .reg-title { font-size: 1.15rem; font-weight: 800; margin-bottom: 4px; }
      .reg-hint { font-size: .82rem; color: var(--text-2, #93a6bd); margin-bottom: 18px; }
      .reg-input-wrap { margin-bottom: 12px; }
      .reg-input { width: 100%; font-family: monospace; font-size: 1.35rem; font-weight: 700;
        letter-spacing: 3px; text-align: center; padding: 16px; border: 2px solid var(--gold-400, #d4af37);
        border-radius: 12px; background: rgba(212,175,55,.05); color: var(--text-1, #f3f6fa); outline: none; }
      .reg-input::placeholder { font-size: .95rem; letter-spacing: 1px; opacity: .55; }
      .reg-cam-btn { width: 100%; font-size: 1rem; font-weight: 800; padding: 15px; }
      .reg-result { max-width: 560px; margin: 18px auto 0; }
      .reg-result:empty { display: none; }
      .reg-status { border-radius: 16px; padding: 20px; border: 1.5px solid; }
      .reg-status.exists { border-color: #22c55e; background: rgba(34,197,94,.1); }
      .reg-status.new    { border-color: #f59e0b; background: rgba(245,158,11,.1); }
      .reg-status.error  { border-color: #ef4444; background: rgba(239,68,68,.1); }
      .reg-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 800;
        letter-spacing: 1.2px; text-transform: uppercase; padding: 5px 12px; border-radius: 18px; margin-bottom: 12px; }
      .reg-badge.exists { background: #22c55e; color: #03260f; }
      .reg-badge.new    { background: #f59e0b; color: #2a1a00; }
      .reg-code { font-family: monospace; font-size: .85rem; color: var(--text-2, #93a6bd); letter-spacing: 1px; margin-bottom: 12px; }
      .reg-prod { display: flex; gap: 14px; align-items: center; text-align: left; }
      .reg-thumb { width: 60px; height: 60px; border-radius: 12px; flex-shrink: 0; overflow: hidden;
        background: rgba(255,255,255,.06); border: 1px solid var(--line, rgba(255,255,255,.08));
        display: flex; align-items: center; justify-content: center; font-size: 1.7rem; }
      .reg-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .reg-prod-name { font-size: 1.05rem; font-weight: 700; margin-bottom: 4px; }
      .reg-prod-meta { font-size: .8rem; color: var(--text-2, #93a6bd); display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
      .reg-chip { display: inline-block; padding: 2px 9px; border-radius: 6px; font-size: .7rem; font-weight: 600;
        background: rgba(255,255,255,.08); }
      .reg-form { display: flex; flex-direction: column; gap: 12px; text-align: left; margin-top: 4px; }
      .reg-form .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .reg-cosmos { font-size: .72rem; color: #22c55e; font-weight: 600; margin: 2px 0 4px; display: none; }
      .reg-cosmos.show { display: block; }
      .reg-actions { display: flex; gap: 10px; margin-top: 16px; }
      .reg-actions .btn { flex: 1; }
      .reg-checking { text-align: center; padding: 22px; color: var(--text-2, #93a6bd); }
      .reg-spinner { width: 22px; height: 22px; border: 2.5px solid rgba(255,255,255,.15);
        border-top-color: var(--gold-400, #d4af37); border-radius: 50%; animation: reg-spin .7s linear infinite; margin: 0 auto 10px; }
      @keyframes reg-spin { to { transform: rotate(360deg); } }
      .reg-log-section { max-width: 560px; margin: 28px auto 0; }
      .reg-log-title { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;
        color: var(--text-2, #93a6bd); margin-bottom: 12px; display: flex; justify-content: space-between; }
      .reg-log-count { background: rgba(255,255,255,.08); padding: 2px 9px; border-radius: 10px; }
      .reg-log-list { display: flex; flex-direction: column; gap: 7px; }
      .reg-log-item { display: flex; align-items: center; gap: 11px; background: var(--surface-1, #16263d);
        border: 1px solid var(--line, rgba(255,255,255,.08)); border-radius: 11px; padding: 11px 13px; }
      .reg-log-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .reg-log-dot.exists { background: #22c55e; }
      .reg-log-dot.new { background: #f59e0b; }
      .reg-log-text { flex: 1; min-width: 0; }
      .reg-log-name { font-size: .88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .reg-log-sub { font-size: .72rem; color: var(--text-2, #93a6bd); }
      .reg-log-time { font-size: .7rem; color: var(--text-3, #5d748f); }
      .reg-log-empty { text-align: center; color: var(--text-3, #5d748f); font-size: .82rem; padding: 20px 0; }
    </style>
  `;

  const input = document.getElementById('reg-input');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = input.value.trim();
      if (code.length >= 6) processCode(code);
    }
  });

  document.getElementById('reg-cam-btn').onclick = async () => {
    const code = await ui.scanBarcode();
    if (code) processCode(code);
    else focusInput();
  };

  wireScanner();
  focusInput();
}

function focusInput() {
  const input = document.getElementById('reg-input');
  if (input) setTimeout(() => input.focus(), 50);
}

/* ── Scanner USB (HID keyboard) ─────────────────────────────── */
function wireScanner() {
  if (window._regScannerHandler) document.removeEventListener('keydown', window._regScannerHandler);
  window._regScannerHandler = (e) => {
    // Se um módulo de registro não está montado, ignora
    if (!document.getElementById('reg-input')) return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    // Deixa o input/textarea/select receberem normalmente
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'Enter') {
      if (_scanBuf.length >= 6) handleBufferScan(_scanBuf.trim());
      _scanBuf = '';
      clearTimeout(_scanTimer);
      return;
    }
    if (e.key.length === 1) {
      _scanBuf += e.key;
      clearTimeout(_scanTimer);
      _scanTimer = setTimeout(() => {
        if (_scanBuf.length >= 6) handleBufferScan(_scanBuf.trim());
        _scanBuf = '';
      }, 120);
    }
  };
  document.addEventListener('keydown', window._regScannerHandler);
}
function handleBufferScan(code) {
  const input = document.getElementById('reg-input');
  if (input) input.value = code;
  processCode(code);
}

/* ── Fluxo principal ────────────────────────────────────────── */
async function processCode(code) {
  if (_busy) return;
  _busy = true;
  const input = document.getElementById('reg-input');
  if (input) input.value = '';
  const result = document.getElementById('reg-result');
  result.innerHTML = `<div class="reg-checking"><div class="reg-spinner"></div>Verificando <strong>${fmt.escape(code)}</strong>…</div>`;

  try {
    const matches = await db.list('products', { where: { field: 'barcode', op: '==', value: code } });
    if (matches.length) {
      renderExists(matches[0], code);
      addLog({ name: matches[0].name, sub: matches[0].category || matches[0].brand || '', type: 'exists' });
      _busy = false;
      return;
    }
    result.innerHTML = `<div class="reg-checking"><div class="reg-spinner"></div>Produto novo. Buscando dados na Cosmos…</div>`;
    const data = await cosmosLookup(code);
    renderNew(code, data);
  } catch (err) {
    result.innerHTML = `<div class="reg-status error">
      <span class="reg-badge" style="background:#ef4444;color:#fff">Erro</span>
      <p>${fmt.escape(err.message || 'Falha ao verificar o código.')}</p>
      <div class="reg-actions"><button class="btn btn-ghost" id="reg-retry">Voltar</button></div>
    </div>`;
    document.getElementById('reg-retry').onclick = resetScan;
  }
  _busy = false;
}

function renderExists(p, code) {
  const result = document.getElementById('reg-result');
  const img = p.image || (p.images && p.images[0]) || '';
  result.innerHTML = `
    <div class="reg-status exists">
      <span class="reg-badge exists">${icon('check', { size: 13 })} Já cadastrado</span>
      <div class="reg-code">${fmt.escape(code)}</div>
      <div class="reg-prod">
        <div class="reg-thumb">${img ? `<img src="${fmt.escape(img)}" alt="">` : '🍺'}</div>
        <div>
          <div class="reg-prod-name">${fmt.escape(p.name || 'Sem nome')}</div>
          <div class="reg-prod-meta">
            ${p.brand ? `<span><strong>${fmt.escape(p.brand)}</strong></span>` : ''}
            <span class="reg-chip">${fmt.escape(p.category || '—')}</span>
            ${p.price != null ? `<span>${fmt.currency(p.price)}</span>` : ''}
            <span class="reg-chip">Estoque: ${p.stock ?? 0}</span>
          </div>
        </div>
      </div>
      <div class="reg-actions"><button class="btn btn-primary btn-block" id="reg-next">Escanear próximo</button></div>
    </div>`;
  document.getElementById('reg-next').onclick = resetScan;
}

function renderNew(code, data) {
  const result = document.getElementById('reg-result');
  const cName  = data?.description || data?.ncm?.description || '';
  const cBrand = data?.brand?.name || '';
  const cCat   = guessCategory(`${cName} ${cBrand} ${data?.ncm?.description || ''}`) || 'Outros';
  const found  = !!data;

  result.innerHTML = `
    <div class="reg-status new">
      <span class="reg-badge new">${icon('plus', { size: 13 })} Novo produto</span>
      <div class="reg-code">${fmt.escape(code)}</div>
      <div class="reg-cosmos ${found ? 'show' : ''}">✓ Dados encontrados na Cosmos</div>
      <form class="reg-form" id="reg-form">
        <label class="field">
          <span class="field-label">Nome do produto *</span>
          <input name="name" value="${fmt.escape(cName)}" placeholder="Ex.: Brahma Chopp Lata 350ml" autocomplete="off" />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Marca</span>
            <input name="brand" value="${fmt.escape(cBrand)}" placeholder="Marca" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">Categoria *</span>
            <select name="category">
              ${CATEGORIES.map(c => `<option value="${c}" ${c === cCat ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="field">
          <span class="field-label">Preço de venda (R$)</span>
          <input name="price" type="number" min="0" step="0.01" placeholder="0,00" inputmode="decimal" autocomplete="off" />
        </label>
      </form>
      <div class="reg-actions">
        <button class="btn btn-ghost" id="reg-cancel" type="button">Cancelar</button>
        <button class="btn btn-primary" id="reg-save" type="button">Cadastrar</button>
      </div>
    </div>`;

  const form = document.getElementById('reg-form');
  const saveBtn = document.getElementById('reg-save');

  const save = async () => {
    const fd = Object.fromEntries(new FormData(form));
    const name = (fd.name || '').trim();
    if (!name) { ui.toast('Informe o nome do produto.', 'danger'); form.querySelector('[name="name"]').focus(); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando…';
    try {
      // Dupla checagem de barcode
      const dup = await db.list('products', { where: { field: 'barcode', op: '==', value: code } });
      if (dup.length) {
        ui.toast('Esse código já foi cadastrado.', 'danger');
        renderExists(dup[0], code);
        return;
      }
      await db.create('products', {
        name,
        brand:    (fd.brand || '').trim(),
        category: fd.category || 'Outros',
        price:    parseFloat(fd.price) || 0,
        barcode:  code,
        stock:    0,        // sem quantidade
        active:   true,
        images:   [],
        image:    '',
      });
      addLog({ name, sub: fd.category || '', type: 'new' });
      ui.toast(`✔ ${name} cadastrado!`, 'success');
      resetScan();
    } catch (err) {
      ui.toast(err.message || 'Erro ao cadastrar.', 'danger');
      saveBtn.disabled = false; saveBtn.textContent = 'Cadastrar';
    }
  };

  saveBtn.onclick = save;
  form.addEventListener('submit', e => { e.preventDefault(); save(); });
  document.getElementById('reg-cancel').onclick = resetScan;
  if (!cName) form.querySelector('[name="name"]').focus();
}

function resetScan() {
  const result = document.getElementById('reg-result');
  if (result) result.innerHTML = '';
  focusInput();
}

/* ── Log da sessão ──────────────────────────────────────────── */
function addLog({ name, sub, type }) {
  _log.unshift({ name, sub, type, at: Date.now() });
  const list = document.getElementById('reg-log-list');
  const count = document.getElementById('reg-log-count');
  if (count) count.textContent = _log.length;
  if (!list) return;
  list.innerHTML = _log.slice(0, 30).map(h => `
    <div class="reg-log-item">
      <span class="reg-log-dot ${h.type}"></span>
      <div class="reg-log-text">
        <div class="reg-log-name">${fmt.escape(h.name)}</div>
        <div class="reg-log-sub">${h.type === 'new' ? 'Cadastrado' : 'Já existia'}${h.sub ? ' · ' + fmt.escape(h.sub) : ''}</div>
      </div>
      <span class="reg-log-time">${new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `).join('');
}
