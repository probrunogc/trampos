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

const CATEGORIES = ['Cerveja', 'Refrigerante', 'Água', 'Energético', 'Destilado', 'Vinho', 'Suco', 'Dose', 'Outros'];

let state = { search: '', category: 'all', list: [] };

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

/* ── Image processing ───────────────────────────────────────── */
let _removeBg = null;

async function loadBgRemover() {
  if (_removeBg) return _removeBg;
  try {
    const CDN = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/browser/index.js';
    const mod = await import(CDN);
    _removeBg = mod.removeBackground ?? mod.default?.removeBackground ?? null;
    return _removeBg;
  } catch { return null; }
}

function squareCrop(blob, size = 600) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // transparent background — no fillRect
      const scale = Math.min(size / img.width, size / img.height) * 0.88;
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b || blob), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

async function processProductImage(file, onStatus) {
  onStatus('Carregando IA…');
  const removeBg = await loadBgRemover();
  let result = file;
  if (removeBg) {
    try {
      onStatus('Removendo fundo…');
      result = await removeBg(file, {
        publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/browser/',
        output: { format: 'image/png', quality: 0.95 },
        progress: (key, cur, tot) => {
          if (key === 'compute:inference') onStatus(`Processando ${Math.round(cur / tot * 100)}%`);
        },
      });
    } catch { result = file; }
  }
  onStatus('Ajustando tamanho…');
  const cropped = await squareCrop(result instanceof Blob ? result : file, 600);
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
        <select id="filter-cat" class="input" style="max-width:200px">
          <option value="all">Todas as categorias</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <span id="count" class="text-mute small"></span>
      </div>
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
  document.getElementById('search-input').oninput = e => { state.search = e.target.value.toLowerCase(); paint(); };
  document.getElementById('filter-cat').onchange = e => { state.category = e.target.value; paint(); };

  state.list = await db.list('products', { orderBy: 'name' });
  paint();
}

function filtered() {
  let arr = state.list;
  if (state.category !== 'all') arr = arr.filter(p => p.category === state.category);
  if (state.search) {
    const s = state.search;
    arr = arr.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.brand || '').toLowerCase().includes(s)
    );
  }
  return arr;
}

function paint() {
  const tbody = document.getElementById('tbody');
  const count = document.getElementById('count');
  const rows  = filtered();
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

  const existingImgs    = Array.isArray(p?.images) ? p.images.filter(Boolean) : (p?.image ? [p.image] : []);
  const existingBanner  = p?.bannerImage || '';

  // Each image: { url, file (processed Blob), blobUrl (preview), isBanner, processing, status }
  let images = existingImgs.map(url => ({
    url, file: null, blobUrl: null,
    isBanner: url === existingBanner,
    processing: false, status: '',
  }));

  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column:span 2">
        <span class="field-label">Nome *</span>
        <input name="name" required value="${fmt.escape(p?.name || '')}" />
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
      <textarea name="description" style="min-height:72px" placeholder="Descrição divertida e informativa…">${fmt.escape(p?.description || '')}</textarea>
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

    <label class="switch" style="margin-top:var(--sp-4)">
      <input name="active" type="checkbox" ${p?.active !== false ? 'checked' : ''}>
      <span class="switch-knob"></span>
      <span>Produto ativo (aparece no PDV e na loja)</span>
    </label>
  `;

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
            <div class="img-free-card${img.isBanner ? ' is-banner' : ''}">
              <div class="img-free-preview">
                <img src="${fmt.escape(src)}" alt="" />
                ${busy ? `
                  <div class="img-slot-busy">
                    <div class="img-slot-spinner"></div>
                    <span class="img-slot-status-text">${fmt.escape(img.status)}</span>
                  </div>` : ''}
                ${img.isBanner ? '<span class="img-banner-badge">Banner</span>' : ''}
              </div>
              <div class="img-free-actions">
                <button type="button" class="img-action-btn" data-ajust="${i}" ${busy ? 'disabled' : ''} title="Remove fundo e corta quadrado">Ajustar</button>
                <button type="button" class="img-action-btn${img.isBanner ? ' is-active' : ''}" data-banner="${i}" title="${img.isBanner ? 'Remover do banner' : 'Usar no banner'}">★</button>
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

    wrap.querySelectorAll('[data-banner]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.banner;
        const was = images[i].isBanner;
        images.forEach(img => img.isBanner = false);
        images[i].isBanner = !was;
        renderImages();
      };
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
  renderImages();

  /* ── Add file ───────────────────────────────────────────── */
  function addFile(file) {
    const blobUrl = URL.createObjectURL(file);
    images.push({ url: '', file, blobUrl, isBanner: false, processing: false, status: '' });
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

  const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit' },
    isEdit ? 'Salvar' : 'Cadastrar');
  form.appendChild(el('div', { class: 'hidden' }, saveBtn));

  /* ── Submit ──────────────────────────────────────────────── */
  form.onsubmit = async e => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    try {
      // Upload new/processed blobs; keep existing URLs as-is
      const finalImages = [];
      for (const img of images) {
        if (img.file) {
          const ext = img.file.type === 'image/jpeg' ? 'jpg' : 'png';
          const url = await uploadFile(img.file, ext);
          if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
          finalImages.push({ url, isBanner: img.isBanner });
        } else if (img.url) {
          finalImages.push({ url: img.url, isBanner: img.isBanner });
        }
      }

      const finalUrls   = finalImages.map(x => x.url);
      const bannerEntry = finalImages.find(x => x.isBanner);

      const fd = Object.fromEntries(new FormData(form));
      const payload = {
        name:        fd.name.trim(),
        brand:       fd.brand.trim(),
        category:    fd.category,
        unit:        fd.unit,
        sku:         fd.sku.trim(),
        images:      finalUrls,
        image:       finalUrls[0] || '',
        bannerImage: bannerEntry?.url || '',
        teor:        fd.teor.trim(),
        origem:      fd.origem.trim(),
        description: fd.description.trim(),
        price:       parseFloat(fd.price) || 0,
        costPrice:   parseFloat(fd.costPrice) || 0,
        stock:       parseInt(fd.stock) || 0,
        minStock:    parseInt(fd.minStock) || 0,
        active:      form.querySelector('[name="active"]').checked,
      };

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

  await ui.modal({
    title: isEdit ? 'Editar produto' : 'Novo produto',
    wide: true,
    body: form,
    footer: [cancelBtn, saveBtn],
  });
}
