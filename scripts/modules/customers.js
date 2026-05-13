/**
 * Módulo: Clientes
 * CRUD completo com endereço de entrega
 */
import { db, fmt, ui, icon, el, clearNode, auth } from '../core.js';

export const meta = {
  id: 'customers',
  label: 'Clientes',
  icon: 'customers',
  title: 'Clientes',
  subtitle: 'Cadastro e gerenciamento',
  roles: ['admin', 'vendedor']
};

let state = { search: '', list: [] };

export async function render(root) {
  clearNode(root);

  root.innerHTML = `
    <div class="page-header">
      <h3>Clientes cadastrados</h3>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-new-customer">
          ${icon('plus', { size: 16 })} <span>Novo cliente</span>
        </button>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search">
          ${icon('search')}
          <input id="search-input" type="search" placeholder="Buscar por nome, telefone ou bairro..." />
        </div>
        <span id="count" class="text-mute small"></span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Endereço</th>
              <th>Cadastrado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-new-customer').onclick = () => openForm();
  document.getElementById('search-input').oninput = (e) => {
    state.search = e.target.value.toLowerCase();
    paint();
  };

  state.list = await db.list('customers', { orderBy: 'name' });
  paint();
}

function filtered() {
  const s = state.search;
  if (!s) return state.list;
  return state.list.filter(c => {
    return (c.name || '').toLowerCase().includes(s)
      || (c.phone || '').includes(s)
      || (c.address?.neighborhood || '').toLowerCase().includes(s)
      || (c.address?.city || '').toLowerCase().includes(s);
  });
}

function paint() {
  const tbody = document.getElementById('tbody');
  const count = document.getElementById('count');
  if (!tbody) return;
  const rows = filtered();
  count.textContent = `${rows.length} cliente${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        ${icon('customers', { size: 56 })}
        <h4>Nenhum cliente encontrado</h4>
        <p>${state.search ? 'Tente outro termo de busca.' : 'Clique em "Novo cliente" para começar.'}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const addr = c.address || {};
    const addrLine = [addr.street, addr.number].filter(Boolean).join(', ');
    const sub = [addr.neighborhood, addr.city].filter(Boolean).join(' — ');
    return `
      <tr class="clickable" data-id="${c.id}">
        <td><strong>${fmt.escape(c.name)}</strong></td>
        <td class="cell-mono">${fmt.phone(c.phone)}</td>
        <td>
          ${addrLine ? `<div>${fmt.escape(addrLine)}</div>` : '<span class="cell-mute">Sem endereço</span>'}
          ${sub ? `<div class="text-mute small">${fmt.escape(sub)}</div>` : ''}
        </td>
        <td class="text-mute small">${fmt.date(c.createdAt)}</td>
        <td>
          <div class="cell-actions">
            <button class="btn-icon-ghost" data-edit="${c.id}" title="Editar">${icon('edit', { size: 16 })}</button>
            ${auth.isAdmin() ? `<button class="btn-icon-ghost" data-del="${c.id}" title="Excluir">${icon('trash', { size: 16 })}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = (e) => { e.stopPropagation(); openForm(b.dataset.edit); }
  );
  tbody.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async (e) => {
      e.stopPropagation();
      const c = state.list.find(x => x.id === b.dataset.del);
      if (!c) return;
      const ok = await ui.confirm({
        title: 'Excluir cliente',
        message: `Deseja realmente excluir o cliente "${c.name}"? Esta ação não pode ser desfeita.`,
        okText: 'Excluir', danger: true
      });
      if (ok) {
        await db.remove('customers', c.id);
        state.list = state.list.filter(x => x.id !== c.id);
        paint();
        ui.toast(`Cliente "${c.name}" excluído.`, 'success');
      }
    }
  );
  tbody.querySelectorAll('tr.clickable').forEach(tr =>
    tr.onclick = () => openForm(tr.dataset.id)
  );
}

async function openForm(id = null) {
  const isEdit = !!id;
  const c = isEdit ? state.list.find(x => x.id === id) : {};
  const a = c?.address || {};

  const form = el('form', { class: 'customer-form', autocomplete: 'off' });
  form.innerHTML = `
    <div class="divider-text">Identificação</div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Nome completo *</span>
        <input name="name" required value="${fmt.escape(c?.name || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Telefone *</span>
        <input name="phone" required value="${fmt.phone(c?.phone || '')}" placeholder="(11) 99999-0000" />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">CPF/CNPJ (opcional)</span>
        <input name="document" value="${fmt.escape(c?.document || '')}" />
      </label>
      <label class="field">
        <span class="field-label">E-mail (opcional)</span>
        <input name="email" type="email" value="${fmt.escape(c?.email || '')}" />
      </label>
    </div>

    <div class="divider-text">Endereço de Entrega</div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">CEP</span>
        <input name="cep" value="${fmt.cep(a.cep || '')}" placeholder="00000-000" maxlength="9" />
      </label>
      <label class="field" style="grid-column: span 2;">
        <span class="field-label">Rua / Logradouro</span>
        <input name="street" value="${fmt.escape(a.street || '')}" />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Número</span>
        <input name="number" value="${fmt.escape(a.number || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Complemento</span>
        <input name="complement" value="${fmt.escape(a.complement || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Bairro</span>
        <input name="neighborhood" value="${fmt.escape(a.neighborhood || '')}" />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Cidade</span>
        <input name="city" value="${fmt.escape(a.city || 'São Paulo')}" />
      </label>
      <label class="field">
        <span class="field-label">Estado</span>
        <input name="state" maxlength="2" value="${fmt.escape(a.state || 'SP')}" style="text-transform:uppercase" />
      </label>
      <label class="field" style="grid-column: span 2;">
        <span class="field-label">Ponto de referência</span>
        <input name="reference" value="${fmt.escape(a.reference || '')}" />
      </label>
    </div>

    <div class="divider-text">Observações</div>
    <label class="field">
      <span class="field-label">Notas internas</span>
      <textarea name="notes" placeholder="Preferências, frequência, observações...">${fmt.escape(c?.notes || '')}</textarea>
    </label>
  `;

  // Máscara telefone
  const phoneInput = form.querySelector('[name="phone"]');
  phoneInput.addEventListener('input', () => phoneInput.value = fmt.phone(phoneInput.value));
  const cepInput = form.querySelector('[name="cep"]');
  cepInput.addEventListener('input', () => cepInput.value = fmt.cep(cepInput.value));

  // CEP autocomplete via ViaCEP
  cepInput.addEventListener('blur', async () => {
    const digits = cepInput.value.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await r.json();
      if (data.erro) return;
      const set = (n, v) => { const i = form.querySelector(`[name="${n}"]`); if (i && !i.value) i.value = v || ''; };
      set('street', data.logradouro);
      set('neighborhood', data.bairro);
      set('city', data.localidade);
      const stateInput = form.querySelector('[name="state"]');
      if (stateInput && !stateInput.value) stateInput.value = data.uf || '';
    } catch (_) {}
  });

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button',
    onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit', form: 'customer-form-tag' },
    isEdit ? 'Salvar alterações' : 'Cadastrar cliente');

  form.id = 'customer-form-tag';
  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    const payload = {
      name: data.name.trim(),
      phone: (data.phone || '').replace(/\D/g, ''),
      document: data.document.trim(),
      email: (data.email || '').trim(),
      address: {
        cep: (data.cep || '').replace(/\D/g, ''),
        street: data.street.trim(),
        number: data.number.trim(),
        complement: data.complement.trim(),
        neighborhood: data.neighborhood.trim(),
        city: data.city.trim(),
        state: data.state.trim().toUpperCase(),
        reference: data.reference.trim()
      },
      notes: data.notes.trim()
    };
    try {
      if (isEdit) {
        const updated = await db.update('customers', id, payload);
        const idx = state.list.findIndex(x => x.id === id);
        state.list[idx] = { ...state.list[idx], ...updated };
        ui.toast(`Cliente "${payload.name}" atualizado.`, 'success');
      } else {
        const created = await db.create('customers', payload);
        state.list.push(created);
        ui.toast(`Cliente "${payload.name}" cadastrado.`, 'success');
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
    title: isEdit ? 'Editar cliente' : 'Novo cliente',
    wide: true,
    body: form,
    footer: [cancelBtn, saveBtn]
  });
}
