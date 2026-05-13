/**
 * Módulo: Entregadores
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';

export const meta = {
  id: 'deliverers',
  label: 'Entregadores',
  icon: 'deliverers',
  title: 'Entregadores',
  subtitle: 'Equipe de entrega',
  roles: ['admin', 'vendedor']
};

let state = { list: [], search: '' };

export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Equipe de entrega</h3>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-new">${icon('plus', { size: 16 })} <span>Novo entregador</span></button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search">
          ${icon('search')}
          <input id="search-input" type="search" placeholder="Buscar..." />
        </div>
        <span id="count" class="text-mute small"></span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Veículo / Placa</th>
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
  document.getElementById('search-input').oninput = (e) => { state.search = e.target.value.toLowerCase(); paint(); };
  state.list = await db.list('deliverers', { orderBy: 'name' });
  paint();
}

function paint() {
  const tbody = document.getElementById('tbody');
  let arr = state.list;
  if (state.search) arr = arr.filter(d =>
    (d.name || '').toLowerCase().includes(state.search) ||
    (d.phone || '').includes(state.search));
  document.getElementById('count').textContent = `${arr.length} entregador${arr.length === 1 ? '' : 'es'}`;

  if (arr.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">${icon('deliverers', { size: 56 })}
        <h4>Nenhum entregador cadastrado</h4><p>Clique em "Novo entregador" para começar.</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = arr.map(d => `
    <tr class="clickable" data-id="${d.id}">
      <td><strong>${fmt.escape(d.name)}</strong></td>
      <td class="cell-mono">${fmt.phone(d.phone)}</td>
      <td>${fmt.escape(d.vehicle || '—')} ${d.plate ? `<span class="text-mute small">· ${fmt.escape(d.plate)}</span>` : ''}</td>
      <td>${d.active !== false
        ? '<span class="badge badge-success badge-dot">Ativo</span>'
        : '<span class="badge badge-mute">Inativo</span>'}</td>
      <td>
        <div class="cell-actions">
          <button class="btn-icon-ghost" data-edit="${d.id}">${icon('edit', { size: 16 })}</button>
          ${auth.isAdmin() ? `<button class="btn-icon-ghost" data-del="${d.id}">${icon('trash', { size: 16 })}</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openForm(b.dataset.edit); });
  tbody.querySelectorAll('[data-del]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    const d = state.list.find(x => x.id === b.dataset.del);
    const ok = await ui.confirm({ title: 'Excluir entregador', message: `Excluir "${d.name}"?`, okText: 'Excluir', danger: true });
    if (ok) {
      await db.remove('deliverers', d.id);
      state.list = state.list.filter(x => x.id !== d.id);
      paint();
      ui.toast('Entregador excluído.', 'success');
    }
  });
  tbody.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => openForm(tr.dataset.id));
}

async function openForm(id = null) {
  const isEdit = !!id;
  const d = isEdit ? state.list.find(x => x.id === id) : {};

  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column: span 2">
        <span class="field-label">Nome completo *</span>
        <input name="name" required value="${fmt.escape(d?.name || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Telefone *</span>
        <input name="phone" required value="${fmt.phone(d?.phone || '')}" />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Documento (CPF/CNH)</span>
        <input name="document" value="${fmt.escape(d?.document || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Veículo</span>
        <select name="vehicle">
          ${['Moto', 'Bicicleta', 'Carro', 'A pé'].map(v => `<option value="${v}" ${d?.vehicle === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span class="field-label">Placa</span>
        <input name="plate" value="${fmt.escape(d?.plate || '')}" style="text-transform:uppercase" />
      </label>
    </div>
    <label class="switch" style="margin-top: var(--sp-3)">
      <input type="checkbox" name="active" ${d?.active !== false ? 'checked' : ''}>
      <span class="switch-knob"></span>
      <span>Entregador ativo</span>
    </label>
  `;
  const phone = form.querySelector('[name="phone"]');
  phone.addEventListener('input', () => phone.value = fmt.phone(phone.value));

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, isEdit ? 'Salvar' : 'Cadastrar');

  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    const fd = Object.fromEntries(new FormData(form));
    const payload = {
      name: fd.name.trim(),
      phone: (fd.phone || '').replace(/\D/g, ''),
      document: fd.document.trim(),
      vehicle: fd.vehicle,
      plate: fd.plate.trim().toUpperCase(),
      active: form.querySelector('[name="active"]').checked
    };
    try {
      if (isEdit) {
        const u = await db.update('deliverers', id, payload);
        const idx = state.list.findIndex(x => x.id === id);
        state.list[idx] = { ...state.list[idx], ...u };
        ui.toast('Entregador atualizado.', 'success');
      } else {
        const c = await db.create('deliverers', payload);
        state.list.push(c);
        ui.toast('Entregador cadastrado.', 'success');
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
    title: isEdit ? 'Editar entregador' : 'Novo entregador',
    body: form,
    footer: [cancelBtn, saveBtn]
  });
}
