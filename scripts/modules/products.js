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
    return `
      <tr class="clickable" data-id="${p.id}">
        <td data-label="Produto">
          <div class="prod-cell">
            ${productImage(p, { cls: 'prod-img-sm' })}
            <div>
              <strong>${fmt.escape(p.name)}</strong>
              ${p.brand ? `<div class="text-mute small">${fmt.escape(p.brand)}</div>` : ''}
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

    <label class="field" style="margin-top: var(--sp-3)">
      <span class="field-label">URL da foto (opcional)</span>
      <input name="image" value="${fmt.escape(p?.image || '')}" placeholder="https://… — vazio usa ilustração automática" />
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
      <span>Produto ativo (aparece no PDV)</span>
    </label>
  `;

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, isEdit ? 'Salvar' : 'Cadastrar');
  form.appendChild(el('div', { class: 'hidden' }, saveBtn));

  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    const fd = Object.fromEntries(new FormData(form));
    const payload = {
      name: fd.name.trim(),
      brand: fd.brand.trim(),
      category: fd.category,
      unit: fd.unit,
      sku: fd.sku.trim(),
      image: fd.image.trim(),
      price: parseFloat(fd.price) || 0,
      costPrice: parseFloat(fd.costPrice) || 0,
      stock: parseInt(fd.stock) || 0,
      minStock: parseInt(fd.minStock) || 0,
      active: form.querySelector('[name="active"]').checked
    };
    try {
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
    }
  };

  await ui.modal({
    title: isEdit ? 'Editar produto' : 'Novo produto',
    wide: true,
    body: form,
    footer: [cancelBtn, saveBtn]
  });
}
