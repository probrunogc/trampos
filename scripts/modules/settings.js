/**
 * Módulo: Configurações
 * Dados da empresa, taxa de entrega, etc.
 */
import { db, fmt, ui, icon, el, clearNode, isDemoMode } from '../core.js';

export const meta = {
  id: 'settings',
  label: 'Configurações',
  icon: 'settings',
  title: 'Configurações',
  subtitle: 'Dados e preferências do empório',
  roles: ['admin']
};

export async function render(root) {
  clearNode(root);
  const company = await db.get('settings', 'company') || {};

  root.innerHTML = `
    <div class="settings-grid">
      <aside class="settings-side">
        <button class="settings-tab active" data-tab="company">Dados do Empório</button>
        <button class="settings-tab" data-tab="delivery">Entrega</button>
        <button class="settings-tab" data-tab="payments">Pagamentos</button>
        <button class="settings-tab" data-tab="system">Sistema</button>
      </aside>
      <div id="settings-content"></div>
    </div>
  `;

  const tabs = root.querySelectorAll('.settings-tab');
  const content = document.getElementById('settings-content');

  function activate(tab) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'company') content.innerHTML = renderCompanyForm(company);
    if (tab === 'delivery') content.innerHTML = renderDeliveryForm(company);
    if (tab === 'payments') content.innerHTML = renderPaymentsForm(company);
    if (tab === 'system') content.innerHTML = renderSystemPanel(company);
    wire(tab, content, company);
  }

  tabs.forEach(t => t.onclick = () => activate(t.dataset.tab));
  activate('company');
}

function renderCompanyForm(c) {
  return `
    <div class="card">
      <div class="card-title">Identificação</div>
      <form id="company-form">
        <div class="field-row">
          <label class="field" style="grid-column: span 2">
            <span class="field-label">Nome fantasia *</span>
            <input name="name" required value="${fmt.escape(c.name || 'Empório das Bebidas')}" />
          </label>
          <label class="field">
            <span class="field-label">CNPJ</span>
            <input name="cnpj" value="${fmt.escape(c.cnpj || '')}" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Slogan</span>
          <input name="slogan" value="${fmt.escape(c.slogan || '')}" />
        </label>
        <div class="field-row">
          <label class="field" style="grid-column: span 2">
            <span class="field-label">Endereço</span>
            <input name="address" value="${fmt.escape(c.address || '')}" />
          </label>
          <label class="field">
            <span class="field-label">Telefone</span>
            <input name="phone" value="${fmt.phone(c.phone || '')}" />
          </label>
        </div>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

function renderDeliveryForm(c) {
  return `
    <div class="card">
      <div class="card-title">Configurações de entrega</div>
      <form id="delivery-form">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Taxa padrão de entrega (R$)</span>
            <input name="deliveryFee" type="number" min="0" step="0.01" value="${c.deliveryFee || 0}" />
            <span class="field-hint">Pré-preenche o campo no PDV quando "gerar nota de entrega" estiver ativo.</span>
          </label>
          <label class="field">
            <span class="field-label">Raio de entrega (km)</span>
            <input name="deliveryRadius" type="number" min="0" step="0.5" value="${c.deliveryRadius || 5}" />
          </label>
        </div>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

function renderPaymentsForm(c) {
  return `
    <div class="card">
      <div class="card-title">Taxas de cartão</div>
      <p class="text-mute small" style="margin-bottom: var(--sp-4); line-height: 1.5">
        Informe as taxas cobradas pela maquininha. O Relatório usa elas pra calcular
        o <strong>faturamento líquido</strong> — quanto entra de fato após as taxas.
      </p>
      <form id="payments-form">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Taxa no débito (%)</span>
            <input name="feeDebito" type="number" min="0" step="0.01" value="${c.feeDebito ?? 1.99}" />
          </label>
          <label class="field">
            <span class="field-label">Taxa no crédito (%)</span>
            <input name="feeCredito" type="number" min="0" step="0.01" value="${c.feeCredito ?? 3.49}" />
          </label>
        </div>
        <span class="field-hint" style="display:block;margin-bottom:var(--sp-3)">
          Dinheiro, PIX e fiado não têm taxa.
        </span>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

function renderSystemPanel(c = {}) {
  const demo = isDemoMode();
  return `
    <div class="card">
      <div class="card-title">Status do sistema</div>
      <div class="flex flex-col gap-3">
        <div class="flex justify-between items-center">
          <span>Backend</span>
          ${demo
            ? '<span class="badge badge-warning badge-dot">Modo Demo (localStorage)</span>'
            : '<span class="badge badge-success badge-dot">Firebase conectado</span>'}
        </div>
        <div class="flex justify-between items-center">
          <span>Versão</span><span class="badge badge-mute">v1.2.0</span>
        </div>
      </div>

      <div class="divider"></div>
      <h4 class="card-title">Painel financeiro</h4>
      <form id="pin-form">
        <label class="field">
          <span class="field-label">PIN de acesso (4 dígitos)</span>
          <input name="financePin" inputmode="numeric" maxlength="4" value="${fmt.escape(String(c.financePin || '1234'))}" />
          <span class="field-hint">Código que abre o painel financeiro no celular (endereço /financeiro).</span>
        </label>
        <button class="btn btn-primary" type="submit">Salvar PIN</button>
      </form>
      ${demo ? `
        <div style="margin-top: var(--sp-4); padding: var(--sp-3); background: rgba(243,156,18,0.08); border: 1px solid rgba(243,156,18,0.3); border-radius: var(--r-md); font-size: .88rem; line-height: 1.5;">
          <strong class="text-gold">⚠ Modo Demo ativo</strong><br>
          Os dados estão sendo salvos apenas no navegador (localStorage). Para usar o Firebase:<br>
          1. Configure <code>scripts/firebase-config.js</code> com os dados do seu projeto<br>
          2. Mude <code>DEMO_MODE</code> para <code>false</code><br>
          3. Recarregue a página
        </div>` : ''}
      ${demo ? `
        <div class="divider"></div>
        <h4 class="card-title">Manutenção</h4>
        <button class="btn btn-danger" id="reset-demo">${icon('refresh', { size: 14 })} Limpar dados (demo)</button>
      ` : ''}
    </div>
  `;
}

function wire(tab, content, c) {
  if (tab === 'company') {
    content.querySelector('#company-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const payload = {
        name: fd.name.trim(),
        cnpj: fd.cnpj.trim(),
        slogan: fd.slogan.trim(),
        address: fd.address.trim(),
        phone: (fd.phone || '').replace(/\D/g, '')
      };
      await db.createWithId('settings', 'company', { ...c, ...payload });
      ui.toast('Dados atualizados.', 'success');
    };
  }
  if (tab === 'delivery') {
    content.querySelector('#delivery-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const payload = {
        deliveryFee: parseFloat(fd.deliveryFee) || 0,
        deliveryRadius: parseFloat(fd.deliveryRadius) || 0
      };
      await db.createWithId('settings', 'company', { ...c, ...payload });
      ui.toast('Configurações atualizadas.', 'success');
    };
  }
  if (tab === 'payments') {
    content.querySelector('#payments-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const payload = {
        feeDebito: parseFloat(fd.feeDebito) || 0,
        feeCredito: parseFloat(fd.feeCredito) || 0
      };
      await db.createWithId('settings', 'company', { ...c, ...payload });
      ui.toast('Taxas atualizadas.', 'success');
    };
  }
  if (tab === 'system') {
    const pinForm = content.querySelector('#pin-form');
    if (pinForm) pinForm.onsubmit = async (e) => {
      e.preventDefault();
      const pin = String(new FormData(pinForm).get('financePin') || '').replace(/\D/g, '').slice(0, 4);
      if (pin.length !== 4) { ui.toast('O PIN precisa ter 4 dígitos.', 'warning'); return; }
      await db.createWithId('settings', 'company', { ...c, financePin: pin });
      ui.toast('PIN do painel atualizado.', 'success');
    };
    const btn = content.querySelector('#reset-demo');
    if (btn) btn.onclick = async () => {
      const ok = await ui.confirm({
        title: 'Limpar todos os dados',
        message: 'TODOS os dados locais (clientes, produtos, vendas, usuários) serão APAGADOS. Esta ação não pode ser desfeita.',
        okText: 'Apagar tudo', danger: true
      });
      if (ok) {
        Object.keys(localStorage).filter(k => k.startsWith('emporio:')).forEach(k => localStorage.removeItem(k));
        ui.toast('Dados limpos. Recarregando...', 'info');
        setTimeout(() => location.reload(), 800);
      }
    };
  }
}
