/**
 * Módulo: Banners do Carrossel
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';

export const meta = {
  id: 'banners',
  label: 'Banners',
  icon: 'image',
  title: 'Banners do Carrossel',
  subtitle: 'Imagens da tela inicial',
  roles: ['admin']
};

let state = { list: [], products: [] };

/* ── Firebase Storage ───────────────────────────────────────── */
let _storage = null;
async function getStorage() {
  if (_storage) return _storage;
  const [{ getApp }, { getStorage: gs }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js'),
  ]);
  _storage = gs(getApp());
  return _storage;
}

async function uploadBanner(blob) {
  const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js');
  const storage = await getStorage();
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob);
  return getDownloadURL(r);
}

/* ── Banner image resize (16:7) ─────────────────────────────── */
function resizeBanner(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const W = 1200, H = Math.round(W * 7 / 16);
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ── Render ─────────────────────────────────────────────────── */
export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Banners do carrossel</h3>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-new">
          ${icon('plus', { size: 16 })} <span>Novo banner</span>
        </button>
      </div>
    </div>
    <div id="banners-list"></div>
  `;

  document.getElementById('btn-new').onclick = () => openForm();

  const [bannersRes, productsRes] = await Promise.allSettled([
    db.list('banners', { orderBy: 'order' }),
    db.list('products', { orderBy: 'name' }),
  ]);
  state.list     = bannersRes.status     === 'fulfilled' ? bannersRes.value     : [];
  state.products = productsRes.status === 'fulfilled' ? productsRes.value : [];
  paint();
}

function paint() {
  const wrap = document.getElementById('banners-list');
  if (!wrap) return;

  if (state.list.length === 0) {
    wrap.innerHTML = `<div class="empty-state">${icon('image', { size: 56 })}<h4>Nenhum banner</h4><p>Adicione o primeiro banner do carrossel.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="banner-admin-grid">
      ${state.list.map(b => {
        const prod = b.productId ? state.products.find(p => p.id === b.productId) : null;
        return `
          <div class="banner-admin-card${b.active === false ? ' inactive' : ''}" data-id="${b.id}">
            <div class="banner-admin-img">
              ${b.imageUrl ? `<img src="${fmt.escape(b.imageUrl)}" alt="" />` : '<span class="banner-admin-empty">Sem imagem</span>'}
              <span class="banner-admin-order">#${b.order ?? 0}</span>
            </div>
            <div class="banner-admin-info">
              <div class="banner-admin-title">${fmt.escape(b.title || 'Banner')}</div>
              ${prod ? `<div class="banner-admin-prod">${icon('products', { size: 12 })} ${fmt.escape(prod.name)}</div>` : '<div class="banner-admin-prod text-mute">Sem produto vinculado</div>'}
            </div>
            <div class="banner-admin-actions">
              <label class="switch switch-sm" title="${b.active === false ? 'Ativar' : 'Desativar'}">
                <input type="checkbox" class="toggle-active" data-id="${b.id}" ${b.active !== false ? 'checked' : ''}>
                <span class="switch-knob"></span>
              </label>
              <button class="btn-icon-ghost" data-edit="${b.id}" title="Editar">${icon('edit', { size: 16 })}</button>
              ${auth.isAdmin() ? `<button class="btn-icon-ghost" data-del="${b.id}" title="Excluir">${icon('trash', { size: 16 })}</button>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  wrap.querySelectorAll('.toggle-active').forEach(chk => {
    chk.onchange = async () => {
      const id = chk.dataset.id;
      const active = chk.checked;
      await db.update('banners', id, { active });
      const b = state.list.find(x => x.id === id);
      if (b) b.active = active;
      paint();
    };
  });

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); openForm(btn.dataset.edit); };
  });

  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const b = state.list.find(x => x.id === btn.dataset.del);
      const ok = await ui.confirm({ title: 'Excluir banner', message: `Excluir "${b.title || 'este banner'}"?`, okText: 'Excluir', danger: true });
      if (ok) {
        await db.remove('banners', b.id);
        state.list = state.list.filter(x => x.id !== b.id);
        paint();
        ui.toast('Banner excluído.', 'success');
      }
    };
  });
}

/* ── Form ───────────────────────────────────────────────────── */
async function openForm(id = null) {
  const isEdit = !!id;
  const b = isEdit ? state.list.find(x => x.id === id) : {};

  let imgState = { url: b?.imageUrl || '', file: null, blobUrl: null, processing: false };

  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column:span 2">
        <span class="field-label">Título (referência interna)</span>
        <input name="title" placeholder="Ex.: Brahma – Promoção junho" value="${fmt.escape(b?.title || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Ordem</span>
        <input name="order" type="number" min="0" step="1" value="${b?.order ?? state.list.length}" style="max-width:100px" />
      </label>
    </div>

    <div class="divider-text">Imagem do banner</div>
    <div id="banner-img-wrap"></div>
    <p class="field-hint" style="margin-top:4px">Proporção ideal: 16×7 (ex.: 1200×525 px). Qualquer imagem horizontal serve — será ajustada automaticamente.</p>

    <div class="divider-text">Produto vinculado</div>
    <label class="field">
      <span class="field-label">Ao clicar no banner, abre este produto (opcional)</span>
      <select name="productId">
        <option value="">— Nenhum —</option>
        ${state.products.map(p => `<option value="${p.id}" ${b?.productId === p.id ? 'selected' : ''}>${fmt.escape(p.name)}</option>`).join('')}
      </select>
    </label>

    <label class="switch" style="margin-top:var(--sp-4)">
      <input name="active" type="checkbox" ${b?.active !== false ? 'checked' : ''}>
      <span class="switch-knob"></span>
      <span>Banner ativo (aparece no carrossel)</span>
    </label>
  `;

  /* ── Image slot ──────────────────────────────────────────── */
  function renderImg() {
    const wrap = form.querySelector('#banner-img-wrap');
    if (!wrap) return;
    const src = imgState.blobUrl || imgState.url;
    const busy = imgState.processing;
    wrap.innerHTML = `
      <div class="banner-slot-preview${src ? '' : ' empty'}">
        ${src ? `<img src="${fmt.escape(src)}" alt="" />` : '<span>Sem imagem</span>'}
        ${busy ? `<div class="img-slot-busy"><div class="img-slot-spinner"></div><span class="img-slot-status-text">Processando…</span></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <label class="btn btn-ghost" style="cursor:pointer">
          ${src ? 'Trocar imagem' : '+ Adicionar imagem'}
          <input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" />
        </label>
        ${src && !busy ? `<button type="button" class="btn btn-ghost" id="btn-clear-img" style="color:#e05">Remover</button>` : ''}
      </div>
    `;
    wrap.querySelector('input[type="file"]').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (imgState.blobUrl) URL.revokeObjectURL(imgState.blobUrl);
      imgState = { url: '', file, blobUrl: URL.createObjectURL(file), processing: true };
      renderImg();
      const resized = await resizeBanner(file);
      URL.revokeObjectURL(imgState.blobUrl);
      imgState = { url: '', file: resized, blobUrl: URL.createObjectURL(resized), processing: false };
      renderImg();
    };
    const clearBtn = wrap.querySelector('#btn-clear-img');
    if (clearBtn) clearBtn.onclick = () => {
      if (imgState.blobUrl) URL.revokeObjectURL(imgState.blobUrl);
      imgState = { url: '', file: null, blobUrl: null, processing: false };
      renderImg();
    };
  }
  renderImg();

  /* ── Buttons ─────────────────────────────────────────────── */
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => { if (imgState.blobUrl) URL.revokeObjectURL(imgState.blobUrl); ui.closeModal(false); }
  }, 'Cancelar');

  const saveBtn = el('button', { class: 'btn btn-primary', type: 'button',
    onClick: () => form.requestSubmit(),
  }, isEdit ? 'Salvar' : 'Criar banner');

  /* ── Submit ──────────────────────────────────────────────── */
  form.onsubmit = async e => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando…';
    try {
      let imageUrl = imgState.url;
      if (imgState.file) {
        imageUrl = await uploadBanner(imgState.file);
        if (imgState.blobUrl) URL.revokeObjectURL(imgState.blobUrl);
      }
      const fd = Object.fromEntries(new FormData(form));
      const payload = {
        title:     fd.title.trim() || 'Banner',
        order:     parseInt(fd.order) || 0,
        productId: fd.productId || '',
        imageUrl,
        active:    form.querySelector('[name="active"]').checked,
      };
      if (isEdit) {
        const updated = await db.update('banners', id, payload);
        const idx = state.list.findIndex(x => x.id === id);
        state.list[idx] = { ...state.list[idx], ...updated };
        ui.toast('Banner atualizado.', 'success');
      } else {
        const created = await db.create('banners', payload);
        state.list.push(created);
        ui.toast('Banner criado.', 'success');
      }
      state.list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      paint();
      ui.closeModal(true);
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar banner.', 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Salvar' : 'Criar banner';
    }
  };

  await ui.modal({
    title: isEdit ? 'Editar banner' : 'Novo banner',
    wide: true,
    body: form,
    footer: [cancelBtn, saveBtn],
  });
}
