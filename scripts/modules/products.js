/**
 * Módulo: Produtos / Estoque
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';
import { productImage } from '../product-art.js';

export const meta = {
  id: 'products',
  label: 'Produtos',
  icon: 'products',
  title: 'Produtos & Estoque',
  subtitle: 'Catálogo de bebidas',
  roles: ['admin', 'vendedor']
};

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Cigarro', 'Outros'];

/* ── Cosmos Bluesoft lookup ─────────────────────────────────── */
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
function cosmosCat(desc) {
  const d = (desc || '').toLowerCase();
  const map = [
    ['cerveja','Cerveja'],['chopp','Cerveja'],['refrigerante','Refrigerante'],
    ['suco','Suco'],['água','Água'],['agua','Água'],
    ['energético','Energético'],['energy','Energético'],
    ['vodka','Destilado'],['whisky','Destilado'],['whiskey','Destilado'],
    ['gin','Destilado'],['rum','Destilado'],['cachaça','Destilado'],['conhaque','Destilado'],
    ['vinho','Vinho'],['dose','Dose'],
  ];
  return map.find(([k]) => d.includes(k))?.[1] || null;
}

let state = { search: '', category: 'all', sort: 'az', list: [], salesCount: {} };

/* ── Firebase Storage ───────────────────────────────────────── */
let _storageInstance = null;
async function getStorageInstance() {
  if (_storageInstance) return _storageInstance;
  const [{ getApp }, { getStorage }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js'),
  ]);
  _storageInstance = getStorage(getApp());
  return _storageInstance;
}

async function uploadFile(blob, ext = 'png') {
  const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js');
  const storage = await getStorageInstance();
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/* ── Image processing (Canvas — funciona em todos os browsers) ── */

/**
 * Remove fundo branco/claro via flood-fill a partir dos 4 cantos.
 * Funciona para fotos de produto em fundo branco/cinza estúdio.
 * tolerance: 0–255 — quão "branco" conta como fundo (35 = até ~220/255)
 */
function removeWhiteBackground(blob, tolerance = 40) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      // Limita a 1600px para performance em mobile
      const MAX = 1600;
      let sw = img.naturalWidth, sh = img.naturalHeight;
      if (sw > MAX || sh > MAX) {
        const s = MAX / Math.max(sw, sh);
        sw = Math.round(sw * s); sh = Math.round(sh * s);
      }
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sw, sh);
      URL.revokeObjectURL(url);

      const imgData = ctx.getImageData(0, 0, sw, sh);
      const d = imgData.data;
      const visited = new Uint8Array(sw * sh);

      function isBg(p) {
        const i = p * 4;
        if (d[i + 3] < 10) return true;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const bright = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        return bright >= (255 - tolerance) && sat <= tolerance;
      }

      // Flood fill iterativo (sem recursão)
      const stack = [];
      function fill(sx, sy) {
        const sp = sy * sw + sx;
        if (visited[sp] || !isBg(sp)) return;
        stack.push(sx, sy);
        while (stack.length) {
          const y = stack.pop(), x = stack.pop();
          if (x < 0 || x >= sw || y < 0 || y >= sh) continue;
          const p = y * sw + x;
          if (visited[p]) continue;
          visited[p] = 1;
          if (!isBg(p)) continue;
          d[p * 4 + 3] = 0; // transparente
          stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }
      }

      fill(0, 0); fill(sw - 1, 0); fill(0, sh - 1); fill(sw - 1, sh - 1);
      // Meio das bordas para fundos que não chegam exatamente nos cantos
      fill(Math.floor(sw / 2), 0); fill(Math.floor(sw / 2), sh - 1);
      fill(0, Math.floor(sh / 2)); fill(sw - 1, Math.floor(sh / 2));

      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob(b => resolve(b || blob), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

function squareCrop(blob, size = 600) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height) * 0.88;
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b || blob), 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

async function processProductImage(file, onStatus) {
  onStatus('Removendo fundo…');
  const nobg = await removeWhiteBackground(file);
  onStatus('Ajustando tamanho…');
  const cropped = await squareCrop(nobg, 600);
  onStatus('done');
  return cropped;
}

/* ── Render ─────────────────────────────────────────────────── */
export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Catálogo de produtos</h3>
      <div class="page-header-actions">
        <button class="btn btn-danger btn-sm" id="btn-cleanup" style="display:none">
          🧹 Limpar inválidos
        </button>
        <button class="btn btn-primary" id="btn-new">
          ${icon('plus', { size: 16 })} <span>Novo produto</span>
        </button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search">
          ${icon('search')}
          <input id="search-input" type="search" placeholder="Buscar produto..." />
        </div>
        <select id="filter-cat" class="input" style="max-width:180px">
          <option value="all">Todas as categorias</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select id="filter-sort" class="input" style="max-width:180px">
          <option value="az">A → Z</option>
          <option value="recent">Mais recentes</option>
          <option value="sold">Mais vendidos</option>
          <option value="nophoto">Sem foto</option>
        </select>
        <span id="count" class="text-mute small"></span>
        <button class="btn btn-primary btn-sm" id="btn-new2">
          ${icon('plus', { size: 14 })} <span>Novo produto</span>
        </button>
      </div>
      <div id="alerts-wrap"></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th><th>Categoria</th>
              <th class="cell-num">Preço</th><th class="cell-num">Estoque</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-new').onclick = () => openForm();
  document.getElementById('btn-new2').onclick = () => openForm();
  document.getElementById('search-input').oninput = e => { state.search = e.target.value.toLowerCase(); paint(); };
  document.getElementById('filter-cat').onchange = e => { state.category = e.target.value; paint(); };
  document.getElementById('filter-sort').onchange = e => { state.sort = e.target.value; paint(); };
  document.getElementById('filter-sort').value = state.sort;

  // Botão de limpeza — visível só para admin
  const role = auth.currentUser()?.role;
  if (role === 'admin') {
    const cleanBtn = document.getElementById('btn-cleanup');
    cleanBtn.style.display = '';
    cleanBtn.onclick = () => runCleanup();
  }

  const [products, sales] = await Promise.all([
    db.list('products', { orderBy: 'name' }),
    db.list('sales', { orderBy: 'createdAt', orderDir: 'desc' })
  ]);
  state.list = products;
  // Contagem de vendas por produto
  state.salesCount = {};
  sales.forEach(s => (s.items || []).forEach(i => {
    state.salesCount[i.productId] = (state.salesCount[i.productId] || 0) + (i.qty || 1);
  }));
  paint();
}

/* ── Limpeza de dados inválidos ─────────────────────────────── */
async function runCleanup() {
  // IDs levantados em 07/06/2026 — remova esta função após a limpeza ser confirmada
  const TO_DELETE = [
    '7DGgBJWZkZA5XqWGC1VT', // sem nome, sem código
    '95icTNiOQN8yUs9nixnc',  // sem nome, sem código
    'ShhInGg95yIITHLPfzuw',  // sem nome, sem código
    'bt4aNcAt5A8T1hZTgGTQ',  // sem nome, sem código
    'jPqOk8adXVnGufe7ydSI',  // sem nome, sem código
    'vW102jHR06fO5VEOnsZR',  // sem nome, sem código
    'pod2ZXqUXo670Zbl2Zxq',  // sem nome, código como nome
    'TbAdd4wFLGYvuH4A0fxW',  // nome = código (5000281004020)
    's5IPsKOoNrPaGxMP7ZIg',  // JW Black Label duplicado
    'Ouo3PubIFOQRFVRGRHZT',  // JW Black Label duplicado
  ];

  const TO_CLEAR_BARCODE = [
    { id: '75ahhbvYZG7ashmy2SxR', name: 'HEINEKEN' },
    { id: 'jN4vlCeo6qiApuqDjJD6', name: 'ANTARTICA' },
    { id: 'B7bgEpbvYClHHnsphUoC', name: 'BUNDUREISER (Budweiser)' },
    { id: 'sUn2hPiingL4yGt72wfU', name: 'IMPERIO PURO MALTE' },
    { id: '4VRDuXm7kwZcxONVjIoJ', name: 'BRAHMA DUPLO MALTE' },
    { id: 'l2baGzTjMTMWZHhKhEcG', name: 'BALLENA ORIGINAL' },
    { id: 's6b9yigN5HQ1VzjozL1f', name: 'ORIGINAL' },
    { id: 's8KkwgZbMNjuYm6SyeuC', name: 'PASSPORT' },
  ];

  const body = el('div');
  body.innerHTML = `
    <p style="color:var(--text-2);margin-bottom:var(--sp-4);line-height:1.6">
      As seguintes operações serão executadas:
    </p>
    <div style="background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.2);border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <div style="font-weight:700;color:var(--danger);margin-bottom:8px">🗑 Deletar ${TO_DELETE.length} registros inválidos/duplicados</div>
      <ul style="margin:0;padding-left:18px;font-size:.84rem;color:var(--text-2);line-height:1.9">
        <li>6 entradas completamente em branco</li>
        <li>1 entrada sem nome (só código como barcode)</li>
        <li>1 produto com código como nome (5000281004020)</li>
        <li>2 Johnnie Walker Black Label duplicados (mantém 1)</li>
      </ul>
    </div>
    <div style="background:rgba(243,156,18,0.08);border:1px solid rgba(243,156,18,0.2);border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <div style="font-weight:700;color:var(--warning);margin-bottom:8px">🔧 Limpar código de barras inválido em ${TO_CLEAR_BARCODE.length} produtos</div>
      <ul style="margin:0;padding-left:18px;font-size:.84rem;color:var(--text-2);line-height:1.9">
        ${TO_CLEAR_BARCODE.map(p => `<li>${p.name}</li>`).join('')}
      </ul>
      <p style="font-size:.78rem;color:var(--text-3);margin:8px 0 0">Esses produtos ficam no sistema sem código — re-escaneie cada um para associar o código correto.</p>
    </div>
    <div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.2);border-radius:8px;padding:12px 16px">
      <div style="font-weight:700;color:#7CC5EE;margin-bottom:4px">✏️ Corrigir código duplicado</div>
      <p style="font-size:.84rem;color:var(--text-2);margin:0">GIN LONDON DRY TANQUERAY: <code>50002910207065000291020706</code> → <code>5000291020706</code></p>
    </div>
  `;

  const ok = await new Promise(resolve => {
    const cancel = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { ui.closeModal(false); resolve(false); } }, 'Cancelar');
    const confirm = el('button', { class: 'btn btn-danger', type: 'button', onClick: () => { ui.closeModal(true); resolve(true); } }, 'Executar limpeza');
    ui.modal({ title: '🧹 Limpeza de dados', body, footer: [cancel, confirm] });
  });

  if (!ok) return;

  let done = 0, errors = 0;
  const total = TO_DELETE.length + TO_CLEAR_BARCODE.length + 1;
  ui.toast(`Executando limpeza (0/${total})…`, 'info');

  // Deletar
  for (const id of TO_DELETE) {
    try { await db.remove('products', id); done++; } catch { errors++; }
  }

  // Limpar barcodes inválidos
  for (const { id } of TO_CLEAR_BARCODE) {
    try { await db.update('products', id, { barcode: '' }); done++; } catch { errors++; }
  }

  // Corrigir Tanqueray
  try { await db.update('products', 'MSwmgT81VGvyVKafAPW1', { barcode: '5000291020706' }); done++; } catch { errors++; }

  if (errors === 0) {
    ui.toast(`✔ Limpeza concluída — ${done} operações executadas.`, 'success', { title: 'Sucesso' });
  } else {
    ui.toast(`Concluído com ${errors} erro(s). ${done} operações ok.`, 'warning');
  }

  // Recarregar lista
  state.list = await db.list('products', { orderBy: 'name' });
  paint();
}

function filtered() {
  let arr = [...state.list];
  if (state.category !== 'all') arr = arr.filter(p => p.category === state.category);
  if (state.sort === 'nophoto') arr = arr.filter(p => !p.image && !(p.images?.length));
  if (state.sort === 'zero')    arr = arr.filter(p => (p.stock ?? 0) === 0);
  if (state.sort === 'noprice') arr = arr.filter(p => !p.price || p.price <= 0);
  if (state.search) {
    const s = state.search;
    arr = arr.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.brand || '').toLowerCase().includes(s)
    );
  }
  if (state.sort === 'az')     arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (state.sort === 'recent') arr.sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
  if (state.sort === 'sold')   arr.sort((a, b) => ((state.salesCount[b.id] || 0) - (state.salesCount[a.id] || 0)));
  return arr;
}

function paintAlerts() {
  const wrap = document.getElementById('alerts-wrap');
  if (!wrap || !state.list.length) return;

  const noPhoto  = state.list.filter(p => !p.image && !(p.images?.length)).length;
  const noPrice  = state.list.filter(p => !p.price || p.price <= 0).length;
  const noStock  = state.list.filter(p => (p.stock ?? 0) === 0).length;
  const noName   = state.list.filter(p => !p.name?.trim()).length;

  const chips = [
    noName   && { key: 'noprice', label: `${noName} sem nome`,   color: 'var(--danger,#e74c3c)' },
    noPrice  && { key: 'noprice', label: `${noPrice} sem preço`, color: 'var(--danger,#e74c3c)' },
    noStock  && { key: 'zero',    label: `${noStock} sem estoque`, color: '#e67e22' },
    noPhoto  && { key: 'nophoto', label: `${noPhoto} sem foto`,  color: '#3498db' },
  ].filter(Boolean);

  if (!chips.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 4px">
      ${chips.map(c => `
        <button class="alert-chip" data-filter="${c.key}"
          style="background:${c.color}18;border:1px solid ${c.color}55;color:${c.color};
                 padding:4px 10px;border-radius:20px;font-size:.78rem;font-weight:600;cursor:pointer">
          ⚠ ${c.label}
        </button>`).join('')}
      <span class="text-mute small" style="align-self:center;margin-left:4px">
        — clique para filtrar
      </span>
    </div>`;

  wrap.querySelectorAll('.alert-chip').forEach(btn => {
    btn.onclick = () => {
      const f = btn.dataset.filter;
      state.sort = (state.sort === f) ? 'az' : f;
      document.getElementById('filter-sort').value = state.sort;
      paint();
    };
  });
}

function paint() {
  const tbody = document.getElementById('tbody');
  const count = document.getElementById('count');
  const rows  = filtered();
  paintAlerts();
  count.textContent = `${rows.length} produto${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('products',{size:56})}<h4>Nenhum produto</h4><p>Cadastre o primeiro produto.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(p => {
    const low  = p.stock != null && p.minStock != null && p.stock <= p.minStock;
    const zero = p.stock === 0;
    const imgCount = Array.isArray(p.images) ? p.images.filter(Boolean).length : (p.image ? 1 : 0);
    return `
      <tr class="clickable" data-id="${p.id}">
        <td data-label="Produto">
          <div class="prod-cell">
            ${productImage(p, { cls: 'prod-img-sm' })}
            <div>
              <strong>${fmt.escape(p.name)}</strong>
              ${p.brand ? `<div class="text-mute small">${fmt.escape(p.brand)}</div>` : ''}
              ${imgCount > 0 ? `<div class="text-mute small">${imgCount} foto${imgCount > 1 ? 's' : ''}</div>` : ''}
            </div>
          </div>
        </td>
        <td data-label="Categoria"><span class="badge badge-mute">${fmt.escape(p.category || '—')}</span></td>
        <td class="cell-num text-gold bold" data-label="Preço">${fmt.currency(p.price)}</td>
        <td class="cell-num" data-label="Estoque">
          <span class="${zero ? 'text-danger' : low ? 'text-mute' : ''}">${p.stock ?? '—'}</span>
          <span class="text-mute small"> / mín ${p.minStock ?? '—'}</span>
        </td>
        <td data-label="Status">
          ${zero ? '<span class="badge badge-danger badge-dot">Esgotado</span>'
            : low ? '<span class="badge badge-warning badge-dot">Baixo</span>'
            : p.active === false ? '<span class="badge badge-mute">Inativo</span>'
            : '<span class="badge badge-success badge-dot">OK</span>'}
        </td>
        <td>
          <div class="cell-actions">
            <button class="btn-icon-ghost" data-edit="${p.id}" title="Editar">${icon('edit',{size:16})}</button>
            ${auth.isAdmin() ? `<button class="btn-icon-ghost" data-del="${p.id}" title="Excluir">${icon('trash',{size:16})}</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = e => { e.stopPropagation(); openForm(b.dataset.edit); });
  tbody.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async e => {
      e.stopPropagation();
      const p = state.list.find(x => x.id === b.dataset.del);
      const ok = await ui.confirm({ title: 'Excluir produto', message: `Excluir "${p.name}"?`, okText: 'Excluir', danger: true });
      if (ok) {
        await db.remove('products', p.id);
        state.list = state.list.filter(x => x.id !== p.id);
        paint();
        ui.toast('Produto excluído.', 'success');
      }
    });
  tbody.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => openForm(tr.dataset.id));
}

/* ── Form ───────────────────────────────────────────────────── */
async function openForm(id = null) {
  const isEdit = !!id;
  const p = isEdit ? state.list.find(x => x.id === id) : {};

  const existingImgs = Array.isArray(p?.images) ? p.images.filter(Boolean) : (p?.image ? [p.image] : []);
  let images = existingImgs.map(url => ({ url, file: null, blobUrl: null, processing: false, status: '' }));

  const form = el('form', { autocomplete: 'off' });

  if (!isEdit) {
    // ── NOVO PRODUTO: formulário simples com barcode em destaque ──
    form.innerHTML = `
      <div style="margin-bottom:var(--sp-4)">
        <div class="field-label" style="margin-bottom:8px;font-size:.8rem;letter-spacing:.05em">
          CÓDIGO DE BARRAS — aponte o leitor e escaneie
        </div>
        <div style="position:relative;display:flex;gap:8px;align-items:center">
          <input name="barcode" id="field-barcode" autocomplete="off"
                 placeholder="🔴 Escaneie ou digite o código"
                 style="font-family:monospace;font-size:1.25rem;letter-spacing:4px;text-align:center;
                        padding:14px 16px;border:2px solid var(--gold-400,#d4af37);border-radius:8px;
                        flex:1;background:rgba(212,175,55,.06)" />
          <button type="button" id="btn-scan-barcode" class="btn btn-outline" style="white-space:nowrap">
            📷 Focar leitor
          </button>
          <button type="button" id="btn-cam-scan" class="btn btn-outline" style="white-space:nowrap">
            📱 Câmera
          </button>
        </div>
        <p class="field-hint" style="margin-top:6px;font-size:.75rem">
          Após escanear, o nome e a categoria serão preenchidos automaticamente pela Cosmos.
        </p>
      </div>

      <label class="field" style="margin-bottom:var(--sp-3)">
        <span class="field-label">Nome do produto *</span>
        <input name="name" id="field-name" autocomplete="off" placeholder="Preenchido automaticamente ou digite" style="font-size:1rem" />
      </label>

      <div class="field-row" style="margin-bottom:var(--sp-3)">
        <label class="field">
          <span class="field-label">Categoria *</span>
          <select name="category">
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Preço de venda (R$)</span>
          <input name="price" type="number" min="0" step="0.01" placeholder="0,00" />
        </label>
      </div>

      <!-- Campos extras colapsáveis -->
      <button type="button" id="btn-toggle-extra"
        style="background:none;border:none;color:var(--gold-400,#d4af37);cursor:pointer;
               font-size:.85rem;padding:4px 0;margin-bottom:var(--sp-3);display:flex;
               align-items:center;gap:6px">
        <span id="toggle-arrow">▶</span> Mais detalhes (marca, estoque, imagens…)
      </button>
      <div id="extra-fields" style="display:none">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Marca</span>
            <input name="brand" />
          </label>
          <label class="field">
            <span class="field-label">Unidade</span>
            <select name="unit">
              ${['un','lt','ml','kg','cx','pct'].map(u => `<option value="${u}">${u}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">SKU</span>
            <input name="sku" />
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Preço de custo</span>
            <input name="costPrice" type="number" min="0" step="0.01" placeholder="0,00" />
          </label>
          <label class="field">
            <span class="field-label">Estoque inicial</span>
            <input name="stock" type="number" min="0" step="1" value="0" />
          </label>
          <label class="field">
            <span class="field-label">Estoque mínimo</span>
            <input name="minStock" type="number" min="0" step="1" value="6" />
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Teor alcoólico</span>
            <input name="teor" placeholder="Ex.: 5%, 40%" />
          </label>
          <label class="field">
            <span class="field-label">Origem</span>
            <input name="origem" placeholder="Ex.: Brasil" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Descrição curta</span>
          <textarea name="description" style="min-height:60px"></textarea>
        </label>
        <div class="divider-text">Fotos</div>
        <div id="img-grid-wrap"></div>
      </div>

      <label class="switch" style="margin-top:var(--sp-4)">
        <input name="active" type="checkbox" checked>
        <span class="switch-knob"></span>
        <span>Produto ativo (aparece no PDV)</span>
      </label>
    `;

    // Toggle extra fields
    form.querySelector('#btn-toggle-extra').onclick = () => {
      const extra = form.querySelector('#extra-fields');
      const arrow = form.querySelector('#toggle-arrow');
      const open  = extra.style.display === 'none';
      extra.style.display = open ? '' : 'none';
      arrow.textContent = open ? '▼' : '▶';
      if (open) renderImages();
    };

  } else {
    // ── EDITAR PRODUTO: formulário completo ──
    form.innerHTML = `
      <div class="field-row">
        <label class="field" style="grid-column:span 2">
          <span class="field-label">Nome *</span>
          <input name="name" id="field-name" required value="${fmt.escape(p?.name || '')}" />
        </label>
        <label class="field">
          <span class="field-label">Marca</span>
          <input name="brand" value="${fmt.escape(p?.brand || '')}" />
        </label>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Categoria *</span>
          <select name="category" required>
            ${CATEGORIES.map(c => `<option value="${c}" ${p?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Unidade</span>
          <select name="unit">
            ${['un','lt','ml','kg','cx','pct'].map(u => `<option value="${u}" ${p?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field-label">SKU</span>
          <input name="sku" value="${fmt.escape(p?.sku || '')}" />
        </label>
      </div>

      <div class="divider-text">Imagens</div>
      <div id="img-grid-wrap"></div>

      <div class="divider-text">Descrição</div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Teor alcoólico</span>
          <input name="teor" placeholder="Ex.: 5%, 40%, Zero" value="${fmt.escape(p?.teor || '')}" />
        </label>
        <label class="field">
          <span class="field-label">Origem</span>
          <input name="origem" placeholder="Ex.: Brasil, México" value="${fmt.escape(p?.origem || '')}" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">Descrição curta</span>
        <textarea name="description" style="min-height:72px">${fmt.escape(p?.description || '')}</textarea>
      </label>

      <div class="divider-text">Preços</div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Preço de venda *</span>
          <input name="price" type="number" min="0" step="0.01" required value="${p?.price ?? ''}" />
        </label>
        <label class="field">
          <span class="field-label">Preço de custo</span>
          <input name="costPrice" type="number" min="0" step="0.01" value="${p?.costPrice ?? ''}" />
        </label>
      </div>

      <div class="divider-text">Estoque</div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Quantidade em estoque</span>
          <input name="stock" type="number" min="0" step="1" value="${p?.stock ?? 0}" />
        </label>
        <label class="field">
          <span class="field-label">Estoque mínimo</span>
          <input name="minStock" type="number" min="0" step="1" value="${p?.minStock ?? 0}" />
        </label>
      </div>

      <div class="divider-text">Código de barras</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input name="barcode" id="field-barcode" autocomplete="off"
               placeholder="Escaneie com o leitor ou digite manualmente"
               value="${fmt.escape(p?.barcode || '')}"
               style="font-family:monospace;font-size:1.1rem;letter-spacing:3px;
                      text-align:center;padding:12px 16px;border:2px solid var(--gold-400,#d4af37);
                      border-radius:8px;flex:1;background:rgba(212,175,55,.06)" />
        <button type="button" id="btn-scan-barcode" class="btn btn-outline">📷 Escanear</button>
      </div>

      <label class="switch" style="margin-top:var(--sp-4)">
        <input name="active" type="checkbox" ${p?.active !== false ? 'checked' : ''}>
        <span class="switch-knob"></span>
        <span>Produto ativo (aparece no PDV e na loja)</span>
      </label>
    `;
    renderImages();
  }

  /* ── Render image grid ──────────────────────────────────── */
  function renderImages() {
    const wrap = form.querySelector('#img-grid-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="img-free-grid">
        ${images.map((img, i) => {
          const src = img.blobUrl || img.url;
          const busy = img.processing;
          return `
            <div class="img-free-card">
              <div class="img-free-preview">
                <img src="${fmt.escape(src)}" alt="" />
                ${busy ? `
                  <div class="img-slot-busy">
                    <div class="img-slot-spinner"></div>
                    <span class="img-slot-status-text">${fmt.escape(img.status)}</span>
                  </div>` : ''}
              </div>
              <div class="img-free-actions">
                <button type="button" class="img-action-btn" data-ajust="${i}" ${busy ? 'disabled' : ''} title="Remove fundo e corta quadrado">Ajustar</button>
                <button type="button" class="img-action-clear" data-del="${i}" title="Remover">✕</button>
              </div>
            </div>`;
        }).join('')}
        <label class="img-add-card" title="Adicionar foto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          <span>Foto</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" multiple />
        </label>
      </div>
    `;

    wrap.querySelector('input[type="file"]').onchange = e => {
      [...e.target.files].forEach(addFile);
      e.target.value = '';
    };

    wrap.querySelectorAll('[data-ajust]').forEach(btn => {
      btn.onclick = () => ajustarImage(+btn.dataset.ajust);
    });

    wrap.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.del;
        if (images[i].blobUrl) URL.revokeObjectURL(images[i].blobUrl);
        images.splice(i, 1);
        renderImages();
      };
    });
  }
  if (isEdit) renderImages();

  /* ── Add file ───────────────────────────────────────────── */
  function addFile(file) {
    const blobUrl = URL.createObjectURL(file);
    images.push({ url: '', file, blobUrl, processing: false, status: '' });
    renderImages();
  }

  /* ── Ajustar: bg removal + transparent square crop ──────── */
  async function ajustarImage(idx) {
    const img = images[idx];
    if (img.processing) return;

    images[idx].processing = true;
    images[idx].status = 'Iniciando…';
    renderImages();

    const setStatus = s => { images[idx].status = s; renderImages(); };

    try {
      let sourceBlob;
      if (img.file) {
        sourceBlob = img.file;
      } else {
        // fetch already-saved image URL
        setStatus('Baixando…');
        const resp = await fetch(img.url);
        if (!resp.ok) throw new Error('fetch failed');
        sourceBlob = await resp.blob();
      }

      const asFile = sourceBlob instanceof File
        ? sourceBlob
        : new File([sourceBlob], 'img.png', { type: sourceBlob.type || 'image/png' });

      const processed = await processProductImage(asFile, setStatus);

      if (images[idx].blobUrl) URL.revokeObjectURL(images[idx].blobUrl);
      images[idx] = {
        ...images[idx],
        url:        images[idx].url,  // keep original URL until saved
        file:       processed,
        blobUrl:    URL.createObjectURL(processed),
        processing: false,
        status:     'done',
      };
      renderImages();
    } catch (err) {
      console.error(err);
      images[idx].processing = false;
      images[idx].status = '';
      renderImages();
      ui.toast('Erro ao ajustar imagem.', 'danger');
    }
  }

  /* ── Buttons ─────────────────────────────────────────────── */
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => {
      images.forEach(s => { if (s.blobUrl) URL.revokeObjectURL(s.blobUrl); });
      ui.closeModal(false);
    }
  }, 'Cancelar');

  // type="button" — o modal move o botão pra fora do <form>; wired manualmente abaixo
  const saveBtn = el('button', { class: 'btn btn-primary', type: 'button' },
    isEdit ? 'Salvar' : 'Cadastrar');

  /* ── Submit ──────────────────────────────────────────────── */
  const handleSubmit = async e => {
    if (e?.preventDefault) e.preventDefault();

    // Validação — nome obrigatório; preço obrigatório só no edit
    const nameVal = form.querySelector('[name="name"]').value.trim();
    if (!nameVal) { ui.toast('Informe o nome do produto.', 'warning'); form.querySelector('[name="name"]').focus(); return; }
    if (isEdit) {
      const priceVal = parseFloat(form.querySelector('[name="price"]').value);
      if (!priceVal || priceVal <= 0) { ui.toast('Informe o preço de venda.', 'warning'); return; }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    try {
      // Upload blobs (edit mode has images; new mode only if extra section was opened)
      const finalUrls = [];
      for (const img of images) {
        if (img.file) {
          const ext = img.file.type === 'image/jpeg' ? 'jpg' : 'png';
          const url = await uploadFile(img.file, ext);
          if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
          finalUrls.push(url);
        } else if (img.url) {
          finalUrls.push(img.url);
        }
      }

      const fd = Object.fromEntries(new FormData(form));
      const payload = {
        name:        nameVal,
        brand:       (fd.brand || '').trim(),
        category:    fd.category || CATEGORIES[0],
        unit:        fd.unit || 'un',
        sku:         (fd.sku || '').trim(),
        barcode:     (fd.barcode || '').trim(),
        images:      finalUrls,
        image:       finalUrls[0] || '',
        teor:        (fd.teor || '').trim(),
        origem:      (fd.origem || '').trim(),
        description: (fd.description || '').trim(),
        price:       parseFloat(fd.price) || 0,
        costPrice:   parseFloat(fd.costPrice) || 0,
        stock:       parseInt(fd.stock) || 0,
        minStock:    parseInt(fd.minStock) || 6,
        active:      form.querySelector('[name="active"]').checked,
        ...(!isEdit && { createdAt: Date.now() }),
      };

      if (payload.barcode) {
        const dup = state.list.find(x => x.barcode === payload.barcode && x.id !== id);
        if (dup) {
          ui.toast(`Código de barras já cadastrado em "${dup.name || 'produto sem nome'}". Edite-o.`, 'warning');
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? 'Salvar' : 'Cadastrar';
          return;
        }
      }

      if (isEdit) {
        const updated = await db.update('products', id, payload);
        const idx = state.list.findIndex(x => x.id === id);
        state.list[idx] = { ...state.list[idx], ...updated };
        ui.toast('Produto atualizado.', 'success');
      } else {
        const created = await db.create('products', payload);
        state.list.push(created);
        ui.toast('Produto cadastrado.', 'success');
      }
      state.list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      paint();
      ui.closeModal(true);
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar', 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Salvar' : 'Cadastrar';
    }
  };
  form.addEventListener('submit', handleSubmit);
  saveBtn.addEventListener('click', handleSubmit);

  // Botão "Escanear" — foca o campo e aguarda o leitor USB digitar
  form.querySelector('#btn-scan-barcode')?.addEventListener('click', () => {
    const field = form.querySelector('#field-barcode');
    if (!field) return;
    field.value = '';
    field.focus();
    field.placeholder = '🔴 Aponte o leitor e escaneie…';
    field.addEventListener('blur', () => {
      field.placeholder = 'Escaneie com o leitor ou digite manualmente';
    }, { once: true });
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); field.blur(); }
    }, { once: true });
  });

  // Botão "Câmera" — abre câmera do dispositivo para escanear
  form.querySelector('#btn-cam-scan')?.addEventListener('click', async () => {
    const barcode = await ui.scanBarcode();
    if (!barcode) return;
    const field = form.querySelector('#field-barcode');
    if (field) {
      field.value = barcode;
      field.dispatchEvent(new Event('blur'));
    }
  });

  // Cosmos lookup — dispara quando barcode é preenchido (blur ou Enter)
  async function triggerCosmosLookup() {
    const field = form.querySelector('#field-barcode');
    const barcode = (field?.value || '').trim();
    if (!barcode || barcode.length < 8) return;
    const nameField    = form.querySelector('[name="name"]');
    const brandField   = form.querySelector('[name="brand"]');
    const catField     = form.querySelector('[name="category"]');
    if (nameField?.value.trim()) return; // já tem nome, não sobrescreve
    const scanBtn = form.querySelector('#btn-scan-barcode');
    if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = '⏳ Buscando…'; }
    const data = await cosmosLookup(barcode);
    if (scanBtn) { scanBtn.disabled = false; scanBtn.textContent = '📷 Focar leitor'; }
    if (!data) return;
    if (nameField && !nameField.value.trim()) nameField.value = data.description || data.ncm?.description || '';
    if (brandField && !brandField.value.trim()) brandField.value = data.brand?.name || '';
    const cat = cosmosCat(data.ncm?.description || data.description || '');
    if (cat && catField) catField.value = cat;
    if (nameField?.value) {
      ui.toast('Produto encontrado na Cosmos ✓', 'success');
      nameField.focus();
    }
  }

  const barcodeField = form.querySelector('#field-barcode');
  if (barcodeField) {
    barcodeField.addEventListener('blur', triggerCosmosLookup);
    barcodeField.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); triggerCosmosLookup(); }
    });
  }

  // Se veio com barcode pré-preenchido, dispara lookup após render
  if (window._pendingBarcode && !isEdit) {
    requestAnimationFrame(() => {
      const f = form.querySelector('#field-barcode');
      if (f) { f.value = window._pendingBarcode; triggerCosmosLookup(); }
      delete window._pendingBarcode;
    });
  }

  await ui.modal({
    title: isEdit ? 'Editar produto' : 'Novo produto',
    wide: true,
    body: form,
    footer: [cancelBtn, saveBtn],
  });
}
