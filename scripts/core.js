/**
 * CORE — Empório das Bebidas
 * ===========================================================
 * Reúne toda a infraestrutura do app:
 *   - Icons   (biblioteca SVG)
 *   - Format  (moeda, data, telefone, CPF/CEP)
 *   - UI      (toast, modal, confirm)
 *   - Router  (hash-based)
 *   - DB      (Firestore OU localStorage em DEMO_MODE)
 *   - Auth    (Firebase Auth OU usuário local em DEMO_MODE)
 * ===========================================================
 */

import { firebaseConfig, DEMO_MODE } from './firebase-config.js';

/* =================================================================
 * ICONS — biblioteca SVG (paths inline, fácil reuso)
 * ================================================================= */
export const Icons = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
  customers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  products: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  sales: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  deliveries: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  deliverers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  mapPin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  trendUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  trendDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
  beer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5S5.5 8 5 8.5V21a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5c-.5-.5-1.5-1-2-1s-1.5.5-2 0z"/><path d="M5 8c0-1.5 2.5-1.5 2.5-3.5C7.5 3 8 2 9.5 2c1 0 1 .5 2 .5s1.5-.5 2.5-.5c1.5 0 2 1 2 2.5C16 6.5 18.5 6.5 18.5 8"/></svg>`,
  delivery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  stock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="17"/><polyline points="9 14.5 12 12 15 14.5"/></svg>`,
  barcode: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><line x1="2" y1="4" x2="2" y2="20"/><line x1="4" y1="4" x2="4" y2="20"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="8.5" y1="4" x2="8.5" y2="20"/><line x1="11" y1="4" x2="11" y2="20"/><line x1="13" y1="4" x2="13" y2="20"/><line x1="15.5" y1="4" x2="15.5" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/><line x1="22" y1="4" x2="22" y2="20"/></svg>`,
};

export function icon(name, opts = {}) {
  const svg = Icons[name] || '';
  const size = opts.size || 18;
  const cls = opts.cls || '';
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" class="${cls}" `);
}

/* =================================================================
 * FORMAT — moeda, datas, máscaras
 * ================================================================= */
export const fmt = {
  currency(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  number(value, decimals = 2) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  date(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('pt-BR');
  },
  time(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
  datetime(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },
  phone(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return v || '';
  },
  cep(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 8) return `${d.slice(0,5)}-${d.slice(5)}`;
    return v || '';
  },
  cpf(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    return v || '';
  },
  saleCode(seq) {
    const year = new Date().getFullYear();
    return `EMP-${year}-${String(seq).padStart(4, '0')}`;
  },
  escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
};

/* =================================================================
 * UI — toast, modal, confirm
 * ================================================================= */
const toastHost = () => document.getElementById('toast-host');
let toastSeq = 0;

export const ui = {
  toast(message, type = 'info', opts = {}) {
    const host = toastHost();
    if (!host) return;
    const id = `t${++toastSeq}`;
    const iconName = type === 'success' ? 'check'
                   : type === 'danger'  ? 'alert'
                   : type === 'warning' ? 'alert'
                   : 'info';
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.id = id;
    el.innerHTML = `
      <div class="toast-icon">${icon(iconName, { size: 20 })}</div>
      <div class="toast-body">
        ${opts.title ? `<div class="toast-title">${fmt.escape(opts.title)}</div>` : ''}
        <div>${fmt.escape(message)}</div>
      </div>
    `;
    host.appendChild(el);
    const dur = opts.duration ?? 3500;
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 260);
    }, dur);
  },

  modal({ title, body, footer, wide = false, narrow = false } = {}) {
    return new Promise((resolve) => {
      const host = document.getElementById('modal-host');
      const titleEl = document.getElementById('modal-title');
      const bodyEl = document.getElementById('modal-body');
      const footEl = document.getElementById('modal-footer');
      const win = host.querySelector('.modal-window');

      titleEl.textContent = title || '';
      bodyEl.innerHTML = '';
      footEl.innerHTML = '';

      win.classList.toggle('wide', !!wide);
      win.classList.toggle('narrow', !!narrow);

      if (typeof body === 'string') bodyEl.innerHTML = body;
      else if (body instanceof HTMLElement) bodyEl.appendChild(body);

      if (typeof footer === 'string') footEl.innerHTML = footer;
      else if (footer instanceof HTMLElement) footEl.appendChild(footer);
      else if (Array.isArray(footer)) footer.forEach(b => footEl.appendChild(b));

      const close = (result) => {
        host.classList.add('hidden');
        host.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKey);
        host.removeEventListener('click', onClick);
        resolve(result);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      const onClick = (e) => {
        if (e.target.dataset.modalClose !== undefined || e.target.closest('[data-modal-close]')) close(null);
      };

      host._resolveModal = close;
      host.classList.remove('hidden');
      host.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', onKey);
      host.addEventListener('click', onClick);

      // Auto-focus primeiro input
      setTimeout(() => {
        const f = bodyEl.querySelector('input, select, textarea, button');
        if (f) f.focus();
      }, 60);
    });
  },

  closeModal(result) {
    const host = document.getElementById('modal-host');
    if (host && host._resolveModal) host._resolveModal(result);
  },

  confirm({ title = 'Confirmar', message, okText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    return new Promise((resolve) => {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = cancelText;
      cancelBtn.onclick = () => { ui.closeModal(false); resolve(false); };

      const okBtn = document.createElement('button');
      okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      okBtn.textContent = okText;
      okBtn.onclick = () => { ui.closeModal(true); resolve(true); };

      ui.modal({
        title,
        narrow: true,
        body: `<p style="line-height:1.55;color:var(--text-2);">${fmt.escape(message)}</p>`,
        footer: [cancelBtn, okBtn]
      });
    });
  },

  // Abre câmera e lê código de barras — retorna o código ou null se cancelado.
  // Usa BarcodeDetector nativo (Chrome/Edge/Android) com fallback para ZXing.
  scanBarcode() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div id="scan-wrap" style="position:relative;background:#000;border-radius:10px;
           overflow:hidden;aspect-ratio:4/3;max-height:280px;margin-bottom:12px">
        <video id="scan-video" autoplay playsinline muted
               style="width:100%;height:100%;object-fit:cover;display:block"></video>
        <div style="position:absolute;inset:0;pointer-events:none;
                    background:linear-gradient(rgba(0,0,0,.4) 0%,transparent 30%,transparent 70%,rgba(0,0,0,.4) 100%)">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                      width:220px;height:88px;border:2px solid #d4a843;border-radius:6px;
                      box-shadow:0 0 0 9999px rgba(0,0,0,.35)"></div>
        </div>
      </div>
      <p id="scan-hint" style="text-align:center;font-size:.82rem;color:var(--text-3);line-height:1.5">
        Aponte a câmera para o código de barras do produto
      </p>
    `;

    return new Promise(async (resolve) => {
      let stream = null;
      let active = true;

      const finish = (code) => {
        active = false;
        if (stream) stream.getTracks().forEach(t => t.stop());
        ui.closeModal(code);
        resolve(code);
      };

      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
        onClick: () => finish(null) }, 'Cancelar');

      ui.modal({ title: '📷 Escanear código de barras', narrow: true, body, footer: [cancelBtn] })
        .then(() => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()); });

      const setHint = (t) => { const h = document.getElementById('scan-hint'); if (h) h.textContent = t; };
      const setError = (msg) => {
        const w = document.getElementById('scan-wrap');
        if (w) w.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                      height:200px;gap:10px;color:var(--danger)">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <strong style="font-size:.95rem">${fmt.escape(msg)}</strong>
          </div>`;
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
        });
        const video = document.getElementById('scan-video');
        if (!video || !active) return;
        video.srcObject = stream;
        await video.play();

        // 1ª opção: BarcodeDetector nativo (Chrome ≥83, Edge ≥83, Android Chrome)
        if ('BarcodeDetector' in window) {
          const formats = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'];
          const det = new BarcodeDetector({ formats });
          const loop = async () => {
            if (!active) return;
            try {
              const hits = await det.detect(video);
              if (hits.length) { finish(hits[0].rawValue); return; }
            } catch {}
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
          return;
        }

        // Fallback: ZXing (carregado dinamicamente)
        setHint('Carregando leitor de câmera…');
        if (!window.ZXing) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        setHint('Aponte a câmera para o código de barras do produto');
        const reader = new window.ZXing.BrowserMultiFormatReader();
        reader.decodeFromVideoDevice(undefined, video, (result, err) => {
          if (!active) { try { reader.reset(); } catch {} return; }
          if (result) { reader.reset(); finish(result.getText()); }
        });

      } catch (err) {
        const msg = err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere nas configurações do navegador.'
          : err?.name === 'NotFoundError'
          ? 'Nenhuma câmera encontrada no dispositivo.'
          : (err?.message || 'Câmera indisponível.');
        setError(msg);
        setHint('Use o leitor USB ou digite o código manualmente.');
      }
    });
  }
};

/* =================================================================
 * ROUTER — Hash-based
 * ================================================================= */
const routes = new Map();
let currentRoute = null;
let routerListeners = [];

export const router = {
  register(path, handler) { routes.set(path, handler); },
  current() { return currentRoute; },
  onChange(fn) { routerListeners.push(fn); },
  navigate(path) {
    if (location.hash !== `#${path}`) {
      location.hash = path;
    } else {
      this._handleRoute();
    }
  },
  _handleRoute() {
    const path = location.hash.replace(/^#/, '') || '/dashboard';
    currentRoute = path;
    // Match exato OU prefixo com parâmetros (ex: /sales/edit/123)
    let handler = routes.get(path);
    let params = {};
    if (!handler) {
      for (const [pattern, fn] of routes.entries()) {
        if (pattern.includes(':')) {
          const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
          const m = path.match(re);
          if (m) {
            handler = fn;
            const keys = [...pattern.matchAll(/:(\w+)/g)].map(x => x[1]);
            keys.forEach((k, i) => params[k] = m[i + 1]);
            break;
          }
        }
      }
    }
    if (handler) {
      routerListeners.forEach(fn => fn(path, params));
      handler(params);
    } else {
      router.navigate('/dashboard');
    }
  },
  start() {
    window.addEventListener('hashchange', () => router._handleRoute());
    router._handleRoute();
  }
};

/* =================================================================
 * DB — Wrapper Firestore / localStorage
 * ================================================================= */

let _fb = null;     // { app, db, auth, firestore SDK funcs }
let _ready = null;

async function initFirebase() {
  if (_fb) return _fb;
  if (DEMO_MODE) {
    _fb = { demo: true };
    return _fb;
  }
  if (_ready) return _ready;
  _ready = (async () => {
    const [{ initializeApp }, fs, au] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js")
    ]);
    const app = initializeApp(firebaseConfig);
    const fsDb = fs.getFirestore(app);
    try {
      await fs.enableIndexedDbPersistence(fsDb).catch(() => {});
    } catch (_) {}
    const auth = au.getAuth(app);
    _fb = { app, db: fsDb, auth, fs, au, demo: false };
    return _fb;
  })();
  return _ready;
}

// --- Demo storage helpers ---
const LS_KEY = (col) => `emporio:${col}`;
function lsAll(col)   { try { return JSON.parse(localStorage.getItem(LS_KEY(col)) || '[]'); } catch { return []; } }
function lsSave(col, arr) { localStorage.setItem(LS_KEY(col), JSON.stringify(arr)); }
function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Listeners para watch() em modo demo
const demoWatchers = new Map(); // col -> [cb,cb...]
function notifyWatchers(col) {
  const cbs = demoWatchers.get(col) || [];
  const data = lsAll(col);
  cbs.forEach(cb => cb(data));
}

export const db = {
  async list(col, { orderBy: ob = null, orderDir = 'asc', where: w = null, limit: lim = null } = {}) {
    await initFirebase();
    if (_fb.demo) {
      let arr = lsAll(col);
      if (w) arr = arr.filter(r => r[w.field] === w.value);
      if (ob) arr.sort((a, b) => {
        const av = a[ob], bv = b[ob];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return orderDir === 'asc' ? -1 : 1;
        if (av > bv) return orderDir === 'asc' ? 1 : -1;
        return 0;
      });
      if (lim) arr = arr.slice(0, lim);
      return arr;
    }
    const { fs, db: fsDb } = _fb;
    const constraints = [];
    if (w) constraints.push(fs.where(w.field, w.op || '==', w.value));
    if (ob) constraints.push(fs.orderBy(ob, orderDir));
    if (lim) constraints.push(fs.limit(lim));
    const q = constraints.length ? fs.query(fs.collection(fsDb, col), ...constraints) : fs.collection(fsDb, col);
    const snap = await fs.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async get(col, id) {
    await initFirebase();
    if (_fb.demo) {
      const arr = lsAll(col);
      return arr.find(r => r.id === id) || null;
    }
    const { fs, db: fsDb } = _fb;
    const snap = await fs.getDoc(fs.doc(fsDb, col, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async create(col, data) {
    await initFirebase();
    const payload = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
    if (_fb.demo) {
      const arr = lsAll(col);
      const rec = { id: uid(), ...payload };
      arr.push(rec);
      lsSave(col, arr);
      notifyWatchers(col);
      return rec;
    }
    const { fs, db: fsDb } = _fb;
    const ref = await fs.addDoc(fs.collection(fsDb, col), payload);
    return { id: ref.id, ...payload };
  },

  async createWithId(col, id, data) {
    await initFirebase();
    const payload = { ...data, updatedAt: Date.now() };
    if (_fb.demo) {
      const arr = lsAll(col);
      const idx = arr.findIndex(r => r.id === id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...payload };
      } else {
        arr.push({ id, createdAt: Date.now(), ...payload });
      }
      lsSave(col, arr);
      notifyWatchers(col);
      return arr.find(r => r.id === id);
    }
    const { fs, db: fsDb } = _fb;
    await fs.setDoc(fs.doc(fsDb, col, id), { createdAt: Date.now(), ...payload }, { merge: true });
    return { id, ...payload };
  },

  async update(col, id, data) {
    await initFirebase();
    const payload = { ...data, updatedAt: Date.now() };
    if (_fb.demo) {
      const arr = lsAll(col);
      const idx = arr.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Not found');
      arr[idx] = { ...arr[idx], ...payload };
      lsSave(col, arr);
      notifyWatchers(col);
      return arr[idx];
    }
    const { fs, db: fsDb } = _fb;
    await fs.updateDoc(fs.doc(fsDb, col, id), payload);
    return { id, ...payload };
  },

  async remove(col, id) {
    await initFirebase();
    if (_fb.demo) {
      const arr = lsAll(col).filter(r => r.id !== id);
      lsSave(col, arr);
      notifyWatchers(col);
      return;
    }
    const { fs, db: fsDb } = _fb;
    await fs.deleteDoc(fs.doc(fsDb, col, id));
  },

  // Real-time subscription
  watch(col, cb, opts = {}) {
    let cancelled = false;
    initFirebase().then(() => {
      if (cancelled) return;
      if (_fb.demo) {
        const list = demoWatchers.get(col) || [];
        list.push(cb);
        demoWatchers.set(col, list);
        cb(lsAll(col));
        return;
      }
      const { fs, db: fsDb } = _fb;
      const constraints = [];
      if (opts.where) constraints.push(fs.where(opts.where.field, opts.where.op || '==', opts.where.value));
      if (opts.orderBy) constraints.push(fs.orderBy(opts.orderBy, opts.orderDir || 'asc'));
      if (opts.limit) constraints.push(fs.limit(opts.limit));
      const q = constraints.length ? fs.query(fs.collection(fsDb, col), ...constraints) : fs.collection(fsDb, col);
      const unsub = fs.onSnapshot(q, snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cb(data);
      });
      _unsubscribes.push(unsub);
    });
    return () => { cancelled = true; };
  },

  async batchUpdate(col, updates) {
    await initFirebase();
    if (_fb.demo) {
      const arr = lsAll(col);
      for (const { id, data } of updates) {
        const idx = arr.findIndex(r => r.id === id);
        if (idx >= 0) arr[idx] = { ...arr[idx], ...data, updatedAt: Date.now() };
      }
      lsSave(col, arr);
      notifyWatchers(col);
      return;
    }
    const { fs, db: fsDb } = _fb;
    const batch = fs.writeBatch(fsDb);
    for (const { id, data } of updates) {
      batch.update(fs.doc(fsDb, col, id), { ...data, updatedAt: Date.now() });
    }
    await batch.commit();
  },

  async nextSaleCode() {
    const counter = await this.get('settings', 'counter') || { id: 'counter', saleSeq: 0 };
    const next = (counter.saleSeq || 0) + 1;
    await this.createWithId('settings', 'counter', { saleSeq: next });
    return next;
  }
};

const _unsubscribes = [];

/* =================================================================
 * AUTH — Firebase Auth ou demo
 * ================================================================= */

const AUTH_LS_KEY = 'emporio:authUser';
let _currentUser = null;
let _authListeners = [];

export const auth = {
  currentUser() { return _currentUser; },
  isAdmin()     { return _currentUser?.role === 'admin'; },
  isSeller()    { return _currentUser?.role === 'vendedor' || _currentUser?.role === 'admin'; },
  isDeliverer() { return _currentUser?.role === 'entregador'; },

  onChange(fn) { _authListeners.push(fn); fn(_currentUser); },

  async signIn(email, password) {
    await initFirebase();
    if (_fb.demo) {
      // Demo: usuários estão em localStorage (semeados na primeira execução)
      const users = lsAll('users');
      const user = users.find(u => u.email === email && u.password === password && u.active !== false);
      if (!user) throw new Error('E-mail ou senha incorretos');
      _currentUser = { ...user, password: undefined };
      localStorage.setItem(AUTH_LS_KEY, JSON.stringify(_currentUser));
      _authListeners.forEach(fn => fn(_currentUser));
      return _currentUser;
    }
    const { au, auth: fbAuth } = _fb;
    try {
      const cred = await au.signInWithEmailAndPassword(fbAuth, email, password);
      const profile = await db.get('users', cred.user.uid);
      if (!profile) throw new Error('Usuário sem perfil. Contate o administrador.');
      if (profile.active === false) throw new Error('Usuário desativado.');
      _currentUser = { ...profile, uid: cred.user.uid, email: cred.user.email };
      _authListeners.forEach(fn => fn(_currentUser));
      return _currentUser;
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error('E-mail ou senha incorretos');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas. Tente novamente em alguns minutos.');
      }
      throw err;
    }
  },

  async signOut() {
    await initFirebase();
    _currentUser = null;
    if (_fb.demo) {
      localStorage.removeItem(AUTH_LS_KEY);
    } else {
      await _fb.au.signOut(_fb.auth);
    }
    _authListeners.forEach(fn => fn(null));
    _unsubscribes.forEach(u => { try { u(); } catch {} });
    _unsubscribes.length = 0;
  },

  async restore() {
    await initFirebase();
    if (_fb.demo) {
      try {
        const u = JSON.parse(localStorage.getItem(AUTH_LS_KEY) || 'null');
        if (u) {
          _currentUser = u;
          _authListeners.forEach(fn => fn(u));
        }
      } catch {}
      return _currentUser;
    }
    return new Promise((resolve) => {
      const { au, auth: fbAuth } = _fb;
      const unsub = au.onAuthStateChanged(fbAuth, async (u) => {
        if (u) {
          const profile = await db.get('users', u.uid);
          if (profile && profile.active !== false) {
            _currentUser = { ...profile, uid: u.uid, email: u.email };
          } else {
            _currentUser = null;
          }
        } else {
          _currentUser = null;
        }
        _authListeners.forEach(fn => fn(_currentUser));
        resolve(_currentUser);
        unsub();
      });
    });
  },

  // Apenas demo: criar usuário admin
  async demoCreateAdmin(name, email, password) {
    const users = lsAll('users');
    if (users.find(u => u.email === email)) throw new Error('E-mail já cadastrado');
    const rec = {
      id: uid(),
      name, email, password,
      role: 'admin',
      active: true,
      createdAt: Date.now()
    };
    users.push(rec);
    lsSave('users', users);
    return rec;
  },

  /**
   * BOOTSTRAP: cria o primeiro administrador do sistema.
   * Funciona apenas se `system/config` ainda não existir (controlado por rules).
   * Em modo demo, simplesmente cria o admin no localStorage.
   */
  async bootstrapAdmin(name, email, password) {
    await initFirebase();
    if (_fb.demo) {
      // Demo: simplesmente cria
      return auth.demoCreateAdmin(name, email, password);
    }
    const { au, fs, auth: fbAuth, db: fsDb } = _fb;

    // 1. Verifica se o setup já foi feito (system/config existe?)
    const setupSnap = await fs.getDoc(fs.doc(fsDb, 'system', 'config'));
    if (setupSnap.exists()) {
      throw new Error('O sistema já foi configurado. Faça login normalmente ou peça acesso ao administrador.');
    }

    // 2. Cria usuário no Firebase Auth
    let cred;
    try {
      cred = await au.createUserWithEmailAndPassword(fbAuth, email, password);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // Já existe no Auth — tenta logar com ele
        try {
          cred = await au.signInWithEmailAndPassword(fbAuth, email, password);
        } catch (_) {
          throw new Error('Este e-mail já está cadastrado no Authentication. Use a senha existente ou outro e-mail.');
        }
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Senha muito fraca. Use no mínimo 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('E-mail inválido.');
      } else {
        throw err;
      }
    }
    const uidNew = cred.user.uid;

    // 3. Cria documento users/{uid} como admin
    await fs.setDoc(fs.doc(fsDb, 'users', uidNew), {
      name, email, role: 'admin', active: true,
      createdAt: Date.now(), updatedAt: Date.now()
    });

    // 4. Marca o setup como concluído (system/config)
    await fs.setDoc(fs.doc(fsDb, 'system', 'config'), {
      initialized: true,
      initializedAt: Date.now(),
      initializedBy: uidNew
    });

    // 5. Atualiza estado interno
    _currentUser = { uid: uidNew, name, email, role: 'admin', active: true };
    _authListeners.forEach(fn => fn(_currentUser));
    return _currentUser;
  }
};

/* =================================================================
 * SEED — Popular dados iniciais em modo demo (executa apenas 1x)
 * ================================================================= */
export async function seedDemoIfNeeded() {
  if (!DEMO_MODE) return;
  await initFirebase();
  const seeded = localStorage.getItem('emporio:seeded');
  if (seeded) return;

  // Admin padrão
  await auth.demoCreateAdmin('Administrador', 'admin@emporio.com', 'admin123');

  // Vendedor exemplo
  lsSave('users', [
    ...lsAll('users'),
    { id: uid(), name: 'João Vendedor', email: 'vendedor@emporio.com', password: '123456', role: 'vendedor', active: true, createdAt: Date.now() },
    { id: uid(), name: 'Carlos Entregador', email: 'entregador@emporio.com', password: '123456', role: 'entregador', active: true, createdAt: Date.now() }
  ]);

  // Configurações padrão
  lsSave('settings', [{
    id: 'company',
    name: 'Empório GO',
    slogan: 'A gente bota a fé que rola a sede',
    address: 'Rua da Cerveja, 100 — Centro',
    phone: '(11) 99999-0000',
    cnpj: '00.000.000/0001-00',
    deliveryFee: 5.00,
    deliveryRadius: 5
  }, { id: 'counter', saleSeq: 0 }]);

  // Produtos exemplo
  const sampleProducts = [
    { name: 'Heineken Long Neck 330ml',  category: 'Cerveja',   price: 9.50,  costPrice: 5.20,  stock: 48, minStock: 12, unit: 'un', brand: 'Heineken',  active: true },
    { name: 'Brahma Lata 350ml',          category: 'Cerveja',   price: 4.50,  costPrice: 2.40,  stock: 120, minStock: 24, unit: 'un', brand: 'Brahma',    active: true },
    { name: 'Skol Lata 350ml',            category: 'Cerveja',   price: 4.30,  costPrice: 2.30,  stock: 96, minStock: 24, unit: 'un', brand: 'Skol',      active: true },
    { name: 'Corona Long Neck 330ml',     category: 'Cerveja',   price: 11.00, costPrice: 6.50,  stock: 36, minStock: 12, unit: 'un', brand: 'Corona',    active: true },
    { name: 'Antarctica Original 600ml',  category: 'Cerveja',   price: 12.90, costPrice: 7.20,  stock: 24, minStock: 12, unit: 'un', brand: 'Antarctica',active: true },
    { name: 'Stella Artois 550ml',        category: 'Cerveja',   price: 13.50, costPrice: 8.10,  stock: 18, minStock: 12, unit: 'un', brand: 'Stella',    active: true },
    { name: 'Coca-Cola 2L',               category: 'Refrigerante', price: 11.00, costPrice: 6.50, stock: 30, minStock: 10, unit: 'un', brand: 'Coca-Cola', active: true },
    { name: 'Guaraná Antarctica 2L',      category: 'Refrigerante', price: 9.50,  costPrice: 5.50, stock: 24, minStock: 10, unit: 'un', brand: 'Antarctica', active: true },
    { name: 'Água Mineral 500ml',         category: 'Água',         price: 3.00,  costPrice: 1.20, stock: 80, minStock: 20, unit: 'un', brand: 'Crystal',   active: true },
    { name: 'Red Bull 250ml',             category: 'Energético',   price: 12.00, costPrice: 7.00, stock: 24, minStock: 12, unit: 'un', brand: 'Red Bull',  active: true },
    { name: 'Whisky Red Label 1L',        category: 'Destilado',    price: 105.00,costPrice: 72.00,stock: 8,  minStock: 4,  unit: 'un', brand: 'Johnnie Walker', active: true },
    { name: 'Vodka Smirnoff 998ml',       category: 'Destilado',    price: 49.00, costPrice: 31.00,stock: 12, minStock: 6,  unit: 'un', brand: 'Smirnoff',  active: true },
    { name: 'Gin Tanqueray 750ml',        category: 'Destilado',    price: 139.00,costPrice: 92.00,stock: 6,  minStock: 3,  unit: 'un', brand: 'Tanqueray', active: true },
    { name: 'Vinho Tinto Suave 750ml',    category: 'Vinho',        price: 24.90, costPrice: 14.50,stock: 18, minStock: 6,  unit: 'un', brand: 'Pérgola',   active: true },
    { name: 'Gelo 5kg',                   category: 'Outros',       price: 12.00, costPrice: 4.00, stock: 14, minStock: 5,  unit: 'un', brand: 'Local',     active: true }
  ];
  lsSave('products', sampleProducts.map(p => ({ id: uid(), ...p, createdAt: Date.now() })));

  // Clientes exemplo
  const sampleCustomers = [
    {
      name: 'Maria da Silva', phone: '11987654321', document: '',
      address: { street: 'Rua das Acácias', number: '120', complement: 'Apt 21', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP', cep: '04101000', reference: 'Próximo ao mercado' },
      notes: 'Sempre pede no fim de semana'
    },
    {
      name: 'José Oliveira', phone: '11912345678', document: '',
      address: { street: 'Av. Paulista', number: '900', complement: 'Sala 5', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', cep: '01310100', reference: '' },
      notes: ''
    },
    {
      name: 'Ana Souza', phone: '11955554444', document: '',
      address: { street: 'Rua Augusta', number: '500', complement: '', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', cep: '01304000', reference: 'Casa amarela' },
      notes: 'Prefere entrega à noite'
    }
  ];
  lsSave('customers', sampleCustomers.map(c => ({ id: uid(), ...c, createdAt: Date.now() })));

  // Entregadores exemplo
  lsSave('deliverers', [
    { id: uid(), name: 'Carlos Entregador', phone: '11999990001', plate: 'ABC-1234', vehicle: 'Moto', active: true, createdAt: Date.now() },
    { id: uid(), name: 'Pedro Silva',       phone: '11999990002', plate: 'XYZ-5678', vehicle: 'Moto', active: true, createdAt: Date.now() }
  ]);

  localStorage.setItem('emporio:seeded', '1');
}

/* =================================================================
 * HELPERS DOM
 * ================================================================= */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null) return;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  });
  return node;
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Manaus = UTC-4, sem horário de verão
export function manausNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Manaus',
    year: 'numeric', month: '2-digit', day: '2-digit', hour12: false
  }).formatToParts(new Date());
  const g = t => Number(parts.find(p => p.type === t).value);
  const y = g('year'), m = g('month') - 1, d = g('day');
  return {
    year: y, month: m, day: d,
    startOfDay:   Date.UTC(y, m, d, 4, 0, 0),
    startOfMonth: Date.UTC(y, m, 1, 4, 0, 0),
    startOfPrevMonth: Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1, 4, 0, 0),
  };
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* Exibe DEMO MODE flag globally para o app */
export const isDemoMode = () => DEMO_MODE;
