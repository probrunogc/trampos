/**
 * Módulo: Usuários (admin only)
 * Cadastra vendedores, entregadores e outros admins.
 *
 * Em DEMO_MODE: cria usuários no localStorage com senha em texto.
 * Em produção: usa app Firebase secundário para criar Auth user sem encerrar
 * a sessão do admin logado, depois salva perfil em users/{uid}.
 */
import { db, fmt, ui, icon, el, clearNode, auth, isDemoMode } from '../core.js';
import { firebaseConfig } from '../firebase-config.js';

let _secApp = null;
async function getSecondaryAuth() {
  const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js')
  ]);
  if (!_secApp) {
    const existing = getApps().find(a => a.name === 'users-helper');
    _secApp = existing || initializeApp(firebaseConfig, 'users-helper');
  }
  return getAuth(_secApp);
}

export const meta = {
  id: 'users',
  label: 'Usuários',
  icon: 'users',
  title: 'Usuários do sistema',
  subtitle: 'Equipe e permissões',
  roles: ['admin']
};

const ROLES = [
  { id: 'admin',      label: 'Administrador', desc: 'Acesso total ao sistema' },
  { id: 'vendedor',   label: 'Vendedor',      desc: 'PDV, clientes, produtos, entregas' },
  { id: 'entregador', label: 'Entregador',    desc: 'Vê apenas suas entregas atribuídas' }
];

let state = { list: [], search: '' };

export async function render(root) {
  clearNode(root);
  root.innerHTML = `
    <div class="page-header">
      <h3>Usuários cadastrados</h3>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-new">${icon('plus', { size: 16 })} <span>Novo usuário</span></button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search">${icon('search')}<input id="search-input" type="search" placeholder="Buscar..." /></div>
        <span id="count" class="text-mute small"></span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th>
          </tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('btn-new').onclick = () => openForm();
  document.getElementById('search-input').oninput = (e) => { state.search = e.target.value.toLowerCase(); paint(); };
  state.list = await db.list('users', { orderBy: 'name' });
  paint();
}

function paint() {
  const tbody = document.getElementById('tbody');
  let arr = state.list;
  if (state.search) arr = arr.filter(u =>
    (u.name || '').toLowerCase().includes(state.search) ||
    (u.email || '').toLowerCase().includes(state.search));
  document.getElementById('count').textContent = `${arr.length} usuário${arr.length === 1 ? '' : 's'}`;

  if (arr.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      ${icon('users', { size: 56 })}<h4>Nenhum usuário</h4>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = arr.map(u => {
    const role = ROLES.find(r => r.id === u.role);
    return `
      <tr class="clickable" data-id="${u.id}">
        <td data-label="Nome"><strong>${fmt.escape(u.name)}</strong></td>
        <td class="cell-mono" data-label="E-mail">${fmt.escape(u.email)}</td>
        <td data-label="Perfil"><span class="badge">${fmt.escape(role?.label || u.role)}</span></td>
        <td data-label="Status">${u.active !== false ? '<span class="badge badge-success badge-dot">Ativo</span>' : '<span class="badge badge-mute">Inativo</span>'}</td>
        <td>
          <div class="cell-actions">
            <button class="btn-icon-ghost" data-edit="${u.id}">${icon('edit', { size: 16 })}</button>
            <button class="btn-icon-ghost" data-del="${u.id}">${icon('trash', { size: 16 })}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openForm(b.dataset.edit); });
  tbody.querySelectorAll('[data-del]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    const u = state.list.find(x => x.id === b.dataset.del);
    if (u.id === auth.currentUser()?.id) { ui.toast('Você não pode excluir o próprio usuário.', 'warning'); return; }
    const ok = await ui.confirm({ title: 'Excluir usuário', message: `Excluir "${u.name}"?`, okText: 'Excluir', danger: true });
    if (ok) {
      await db.remove('users', u.id);
      state.list = state.list.filter(x => x.id !== u.id);
      paint();
      ui.toast('Usuário excluído.', 'success');
    }
  });
  tbody.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => openForm(tr.dataset.id));
}

async function openForm(id = null) {
  const isEdit = !!id;
  const u = isEdit ? state.list.find(x => x.id === id) : {};

  const form = el('form', { autocomplete: 'off' });
  form.innerHTML = `
    <div class="field-row">
      <label class="field" style="grid-column: span 2">
        <span class="field-label">Nome *</span>
        <input name="name" required value="${fmt.escape(u?.name || '')}" />
      </label>
      <label class="field">
        <span class="field-label">E-mail *</span>
        <input name="email" type="email" required ${isEdit ? 'readonly' : ''} value="${fmt.escape(u?.email || '')}" />
      </label>
    </div>
    ${!isEdit ? `
      <div class="field-row">
        <label class="field">
          <span class="field-label">Senha *</span>
          <input name="password" type="password" minlength="6" required autocomplete="new-password" />
          <span class="field-hint">Mínimo 6 caracteres.</span>
        </label>
      </div>
    ` : ''}

    <div class="divider-text">Perfil de acesso</div>
    <div class="flex flex-col gap-2">
      ${ROLES.map(r => `
        <label class="role-radio" style="display:flex;gap:var(--sp-3);padding:var(--sp-3);border:1px solid var(--line);border-radius:var(--r-md);cursor:pointer">
          <input type="radio" name="role" value="${r.id}" ${u?.role === r.id || (!u?.role && r.id === 'vendedor') ? 'checked' : ''} style="margin-top:2px">
          <div>
            <div class="bold" style="color:var(--cream)">${r.label}</div>
            <div class="text-mute small">${r.desc}</div>
          </div>
        </label>
      `).join('')}
    </div>

    <label class="switch" style="margin-top: var(--sp-4)">
      <input type="checkbox" name="active" ${u?.active !== false ? 'checked' : ''}>
      <span class="switch-knob"></span>
      <span>Usuário ativo</span>
    </label>
  `;

  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ui.closeModal(false) }, 'Cancelar');
  const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, isEdit ? 'Salvar' : 'Cadastrar');

  const doSave = async () => {
    if (saveBtn.disabled) return;
    // Validação manual (compatível com todos os browsers/iOS)
    const nameVal  = form.querySelector('[name="name"]').value.trim();
    const emailVal = form.querySelector('[name="email"]').value.trim();
    const roleVal  = form.querySelector('[name="role"]:checked')?.value;
    const passVal  = form.querySelector('[name="password"]')?.value || '';
    if (!nameVal)  { ui.toast('Informe o nome.', 'warning');  return; }
    if (!emailVal) { ui.toast('Informe o e-mail.', 'warning'); return; }
    if (!isEdit && passVal.length < 6) { ui.toast('Senha deve ter mínimo 6 caracteres.', 'warning'); return; }

    saveBtn.disabled = true;
    const payload = {
      name:   nameVal,
      email:  emailVal.toLowerCase(),
      role:   roleVal || 'vendedor',
      active: form.querySelector('[name="active"]').checked
    };
    try {
      if (isEdit) {
        const upd = await db.update('users', id, payload);
        const idx = state.list.findIndex(x => x.id === id);
        state.list[idx] = { ...state.list[idx], ...upd };
        ui.toast('Usuário atualizado.', 'success');
      } else {
        if (isDemoMode()) {
          payload.password = passVal;
          const created = await db.create('users', payload);
          state.list.push(created);
        } else {
          const { createUserWithEmailAndPassword, signOut } =
            await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js');
          const secAuth = await getSecondaryAuth();
          let cred;
          try {
            cred = await createUserWithEmailAndPassword(secAuth, payload.email, passVal);
          } catch (err) {
            const msgs = {
              'auth/email-already-in-use': 'Este e-mail já está cadastrado no sistema.',
              'auth/weak-password':        'Senha fraca — use pelo menos 6 caracteres.',
              'auth/invalid-email':        'E-mail inválido.'
            };
            throw new Error(msgs[err.code] || err.message);
          }
          const newUid = cred.user.uid;
          await signOut(secAuth);
          const created = await db.createWithId('users', newUid, payload);
          state.list.push(created);
        }
        ui.toast('Usuário cadastrado.', 'success');
      }
      state.list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      paint();
      ui.closeModal(true);
    } catch (err) {
      ui.toast(err.message || 'Erro ao salvar', 'danger');
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', doSave);
  form.addEventListener('submit', (e) => { e.preventDefault(); doSave(); });

  await ui.modal({
    title: isEdit ? 'Editar usuário' : 'Novo usuário',
    body: form,
    footer: [cancelBtn, saveBtn]
  });
}
