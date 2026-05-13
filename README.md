# Empório das Bebidas — Sistema de Gestão

Sistema completo de gestão para o Empório das Bebidas. Roda 100% no navegador, com identidade visual feita sob medida (dourado + marinho + tipografia Cinzel/Dancing Script).

![Empório](assets/logo.svg)

---

## Funcionalidades

- **Dashboard** — KPIs do dia/mês, top produtos, top clientes, alertas de estoque, sparkline 14 dias
- **PDV / Vendas** — Tela ágil de venda: categoria → produto → carrinho → cliente → finalizar
- **Clientes** — Cadastro completo com endereço (autocomplete via ViaCEP)
- **Produtos & Estoque** — Catálogo com categorias, preços, estoque mínimo
- **Entregas / Notas** — Lista de pedidos com entrega, atribuição de entregador, troca de status
- **Cupom 80mm térmico** — Geração e impressão de cupom no formato padrão (impressora térmica)
- **Entregadores** — Equipe de entrega com placa e veículo
- **Usuários** — Multi-usuário com 3 perfis (admin / vendedor / entregador)
- **Configurações** — Dados da empresa, taxa de entrega, manutenção
- **Modo offline** — IndexedDB + sincronização Firestore quando online

---

## Tecnologia

- **Frontend** — HTML/CSS/JS modular (sem build step)
- **Backend** — Firebase (Firestore + Authentication + Hosting)
- **Modo demo** — localStorage (para testar sem configurar Firebase)

Arquitetura modular: cada feature em um arquivo em `scripts/modules/`. Adicionar um módulo novo é só criar `scripts/modules/<nome>.js`, exportar `meta` e `render(root)`, e registrar em `scripts/app.js`.

---

## Como rodar localmente

### Modo Demo (rápido, sem Firebase)

Já vem ativado por padrão. Basta servir o diretório:

```bash
# Opção 1: Python
python3 -m http.server 8000

# Opção 2: Node
npx serve .

# Opção 3: VS Code → extensão "Live Server"
```

Abra `http://localhost:8000` e use as credenciais demo:

| Perfil       | E-mail                     | Senha    |
|--------------|----------------------------|----------|
| Admin        | `admin@emporio.com`        | `admin123` |
| Vendedor     | `vendedor@emporio.com`     | `123456`   |
| Entregador   | `entregador@emporio.com`   | `123456`   |

> O sistema vem com produtos, clientes e entregadores de exemplo na primeira execução.

### Modo Firebase (produção)

1. **Crie o projeto** no [Firebase Console](https://console.firebase.google.com/)
2. **Adicione um app Web** e copie o objeto `firebaseConfig`
3. **Habilite Authentication** → Sign-in method → E-mail/Senha
4. **Habilite Firestore Database** → modo de produção
5. **Cole a config** em `scripts/firebase-config.js`:
   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     // ...
   };
   export const DEMO_MODE = false;  // ← desligar modo demo
   ```
6. **Crie o primeiro admin** no Firebase Auth (Console → Authentication → Users)
7. **Crie o perfil no Firestore**: coleção `users`, documento com ID = UID do passo 6, com os campos:
   ```json
   {
     "name": "Administrador",
     "email": "admin@emporio.com",
     "role": "admin",
     "active": true,
     "createdAt": 1715000000000
   }
   ```
8. Agora todos os próximos usuários podem ser criados pelo próprio sistema (Sistema → Usuários)

### Deploy no Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add  # selecione seu projeto
firebase deploy
```

As regras de segurança em `firestore.rules` são deployadas junto. Elas garantem:
- Apenas usuários autenticados acessam
- Admin: tudo
- Vendedor: opera (clientes, produtos, vendas, entregas)
- Entregador: vê apenas entregas atribuídas a ele

---

## Estrutura do projeto

```
trampos/
├── index.html              ← Shell SPA
├── firebase.json           ← Config do Hosting
├── firestore.rules         ← Regras de segurança
├── .firebaserc             ← Project ID
├── styles/
│   ├── theme.css           ← Tokens, fontes, animações
│   ├── layout.css          ← Shell, sidebar, login, boot
│   ├── components.css      ← Botões, forms, tabelas, modais
│   ├── modules.css         ← Dashboard, PDV específicos
│   └── print.css           ← Cupom térmico 80mm
└── scripts/
    ├── firebase-config.js  ← Sua config Firebase
    ├── core.js             ← DB + Auth + Router + UI + Format + Icons
    ├── app.js              ← Boot
    └── modules/
        ├── dashboard.js
        ├── sales.js        ← PDV
        ├── customers.js
        ├── products.js
        ├── deliveries.js   ← + impressão de cupom
        ├── deliverers.js
        ├── users.js
        └── settings.js
```

---

## Imprimindo cupons

O sistema gera cupom térmico **80mm** (padrão de impressoras térmicas de cupom não-fiscal).

1. Configure a impressora térmica como impressora padrão do navegador
2. No navegador, em "Imprimir", ajuste a configuração para:
   - Margens: nenhuma (ou mínimas)
   - Tamanho: 80mm × auto (ou "personalizado")
   - Cor: preto e branco
3. Pode usar **Salvar como PDF** se preferir gerar PDF do cupom

---

## Identidade visual

Cores principais:
- **Dourado**: `#D4AF37` (gradiente completo em `--grad-gold`)
- **Marinho**: `#0A1628` (fundo) → `#16294A` (cards)
- **Creme**: `#F8F4E6` (texto principal)

Tipografia:
- **Marca**: Cinzel (display serif, dourado)
- **Script**: Dancing Script ("das Bebidas")
- **Interface**: Inter

Para usar o logo PNG oficial, coloque o arquivo em `assets/logo.png` e troque as referências de `assets/logo.svg` em `index.html`.

---

## Roadmap (módulos futuros)

A arquitetura está pronta para crescer:

- [ ] Relatórios detalhados (exportar Excel/CSV)
- [ ] Integração com WhatsApp para envio de cupom ao cliente
- [ ] Múltiplas formas de pagamento na mesma venda
- [ ] Programa de fidelidade
- [ ] Empacotar como executável Windows (Electron)
- [ ] App móvel para o entregador (PWA / Capacitor)
- [ ] Integração com NFC-e (nota fiscal eletrônica)

---

**Empório das Bebidas** · ★ Since 2025 ★
