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

/* ── Firebase Storage (lazy import) ─────────────────────────── */
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

async function uploadFile(file) {
  const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js');
  const storage = await getStorageInstance();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
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
              <th>Produto</th>
              <th>Categoria</th>
              <th class="cell-num">Preço</th>
              <th class="cell-num">Estoque</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-new').onclick = () => openForm();
  document.getElementById('search-input').oninput = (e) => {
    state.search = e.target.value.toLowerCase();
    paint();
  };
  document.getElementById('filter-cat').onchange = (e) => {
    state.category = e.target.value;
    paint();
  };

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
  const rows = filtered();
  count.textContent = `${rows.length} produto${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">${icon('products', { size: 56 })}
        <h4>Nenhum produto</h4><p>Cadastre o primeiro produto.</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(p => {
    const low = p.stock != null && p.minStock != null && p.stock <= p.minStock;
    const zero = p.stock === 0;
    const imgCount = Array.isArray(p.images) ? p.images.length : (p.image ? 1 : 0);
    return `
      <tr class="clickable" data-id="${p.id}">
        <td data-label="Produto">
          <div class="prod-cell">
            ${productImage(p, { cls: 'prod-img-sm' })}
            <div>
              <strong>${fmt.escape(p.name)}</strong>
              ${p.brand ? `<div class="text-mute small">${fmt.escape(p.brand)}</div>` : ''}
              ${imgCount > 1 ? `<div class="text-mute small">${imgCount} fotos</div>` : ''}
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
            <button class="btn-icon-ghost" data-edit="${p.id}" title="Editar">${icon('edit', { size: 16 })}</button>
            ${auth.isAdmin() ? `<button class="btn-icon-ghost" data-del="${p.id}" title="Excluir">${icon('trash', { size: 16 })}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = (e) => { e.stopPropagation(); openForm(b.dataset.edit); });
  tbody.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async (e) => {
      e.stopPropagation();
      const p = state.list.find(x => x.id === b.dataset.del);
      const ok = await ui.confirm({
        title: 'Excluir produto',
        message: `Deseja realmente excluir "${p.name}"?`,
        okText: 'Excluir', danger: true
      });
      if (ok) {
        await db.remove('products', p.id);
        state.list = state.list.filter(x => x.id !== p.id);
        paint();
        ui.toast('Produto excluído.', 'success');
      }
    });
  tbody.querySelectorAll('tr.clickable').forEach(tr =>
    tr.onclick = () => openForm(tr.dataset.id));
}

async function openForm(id = null) {
  const isEdit = !!id;
  const p = isEdit ? state.list.find(x => x.id === id) : {};

  // Image state (scoped per modal instance)
  let formImgs = [];
  if (Array.isArray(p?.images)) {
    formImgs = p.images.filter(Boolean).map(url => ({ url, file: null, blobUrl: null }));
  } else if (p?.image) {
    formImgs = [{ url: p.image, file: null, blobUrl: null }];
  }

  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column: span 2">
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
          ${['un', 'lt', 'ml', 'kg', 'cx', 'pct'].map(u => `<option value="${u}" ${p?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="field-label">SKU/Código</span>
        <input name="sku" value="${fmt.escape(p?.sku || '')}" />
      </label>
    </div>

    <div class="divider-text">Imagens</div>
    <div class="img-upload-wrap">
      <div id="img-preview-list" class="img-preview-list"></div>
      <label class="img-add-btn">
        + Adicionar imagem
        <input type="file" id="img-file-input" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none" />
      </label>
      <p class="field-hint">A primeira imagem aparece como principal. Arraste para reordenar usando as setas.</p>
    </div>

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
      <textarea name="description" placeholder="Uma descrição divertida e informativa…" style="min-height:72px">${fmt.escape(p?.description || '')}</textarea>
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

    <label class="switch" style="margin-top: var(--sp-4)">
      <input name="active" type="checkbox" ${p?.active !== false ? 'checked' : ''}>
      <span class="switch-knob"></span>
      <span>Produto ativo (aparece no PDV e na loja)</span>
    </label>
  `;

  // ── Image preview rendering ──────────────────────────────────
  function renderPreviews() {
    const list = form.querySelector('#img-preview-list');
    if (!list) return;
    if (formImgs.length === 0) {
      list.innerHTML = `<p class="img-preview-empty">Nenhuma imagem adicionada.</p>`;
      return;
    }
    list.innerHTML = formImgs.map((item, i) => `
      <div class="img-thumb">
        <img src="${item.blobUrl || fmt.escape(item.url)}" alt="" />
        <div class="img-thumb-footer">
          <span class="img-thumb-num">${i + 1}ª</span>
          <div class="img-thumb-btns">
            ${i > 0 ? `<button type="button" class="img-order-btn" data-up="${i}" title="Mover para cima">↑</button>` : ''}
            ${i < formImgs.length - 1 ? `<button type="button" class="img-order-btn" data-dn="${i}" title="Mover para baixo">↓</button>` : ''}
            <button type="button" class="img-del-btn" data-del="${i}" title="Remover">✕</button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-up]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.up;
        [formImgs[i - 1], formImgs[i]] = [formImgs[i], formImgs[i - 1]];
        renderPreviews();
      };
    });
    list.querySelectorAll('[data-dn]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.dn;
        [formImgs[i], formImgs[i + 1]] = [formImgs[i + 1], formImgs[i]];
        renderPreviews();
      };
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.del;
        if (formImgs[i].blobUrl) URL.revokeObjectURL(formImgs[i].blobUrl);
        formImgs.splice(i, 1);
        renderPreviews();
      };
    });
  }
  renderPreviews();

  form.querySelector('#img-file-input').onchange = (e) => {
    Array.from(e.target.files).forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      formImgs.push({ url: '', file, blobUrl });
    });
    e.target.value = '';
    renderPreviews();
  };

  // ── Buttons ──────────────────────────────────────────────────
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => {
      formImgs.forEach(item => { if (item.blobUrl) URL.revokeObjectURL(item.blobUrl); });
      ui.closeModal(false);
    }
  }, 'Cancelar');
  const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, isEdit ? 'Salvar' : 'Cadastrar');
  form.appendChild(el('div', { class: 'hidden' }, saveBtn));

  // ── Submit ───────────────────────────────────────────────────
  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';

    try {
      // Upload any new files
      const finalUrls = [];
      for (const item of formImgs) {
        if (item.file) {
          const url = await uploadFile(item.file);
          if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
          finalUrls.push(url);
        } else if (item.url) {
          finalUrls.push(item.url);
        }
      }

      const fd = Object.fromEntries(new FormData(form));
      const payload = {
        name:        fd.name.trim(),
        brand:       fd.brand.trim(),
        category:    fd.category,
        unit:        fd.unit,
        sku:         fd.sku.trim(),
        images:      finalUrls,
        image:       finalUrls[0] || '',
        teor:        fd.teor.trim(),
        origem:      fd.origem.trim(),
        description: fd.description.trim(),
        price:       parseFloat(fd.price) || 0,
        costPrice:   parseFloat(fd.costPrice) || 0,
        stock:       parseInt(fd.stock) || 0,
        minStock:    parseInt(fd.minStock) || 0,
        active:      form.querySelector('[name="active"]').checked
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
    footer: [cancelBtn, saveBtn]
  });
}
