/* ─── DEV RULER v3 ────────────────────────────────────────────
   Ferramenta temporária de alinhamento.
   Para remover: apague este arquivo e o <script> no loja.html.

   • Arrastar guias — precisão 1 px, área de toque 28 px
   • Auto-seleciona ao soltar o arraste (mostra opções de cor/delete)
   • Botão ✓ no painel fecha a seleção sem apagar a guia
   • ↩  Desfazer — remove a última guia adicionada
   • 💾 / 📂 Salvar e carregar esquemas (localStorage)
   • 🖼  Imagem de referência em tela cheia (segurar = ciclar opacidade)
   ─────────────────────────────────────────────────────────────── */

(function () {
  /* ── Paleta ─────────────────────────────────────────────────── */
  const COLORS = [
    { id: 'red',    solid: '#DC1414', line: 'rgba(220,20,20,0.82)'  },
    { id: 'blue',   solid: '#1E64FF', line: 'rgba(30,100,255,0.82)' },
    { id: 'green',  solid: '#14B43C', line: 'rgba(20,180,60,0.82)'  },
    { id: 'orange', solid: '#FF8C00', line: 'rgba(255,140,0,0.82)'  },
    { id: 'cyan',   solid: '#00C8D2', line: 'rgba(0,200,210,0.82)'  },
    { id: 'purple', solid: '#8C1EC8', line: 'rgba(140,30,200,0.82)' },
  ];
  const STORAGE_KEY = 'dev-ruler-schemes';
  const OPACITIES   = [0.4, 0.7, 1.0];

  let active       = false;
  let addMode      = 'h';
  let currentColor = COLORS[0];
  let guides       = [];
  let addHistory   = [];   // stack para desfazer — só rastreia adições
  let selected     = null;

  /* ── localStorage ───────────────────────────────────────────── */
  function getSchemes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function putSchemes(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

  /* ── Canvas (grid azul) ─────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '8990', display: 'none',
  });

  function drawGrid() {
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(30,120,255,0.07)';
    for (let x = 10; x < W; x += 10) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 10; y < H; y += 10) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.lineWidth = 1; ctx.font = '9px monospace';
    for (let x = 0; x <= W; x += 50) {
      ctx.strokeStyle = 'rgba(30,120,255,0.22)'; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)'; ctx.fillText(x, x+2, 11);
    }
    for (let y = 50; y <= H; y += 50) {
      ctx.strokeStyle = 'rgba(30,120,255,0.22)'; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)'; ctx.fillText(y, 2, y-2);
    }
  }

  /* ── Imagem de referência ────────────────────────────────────── */
  const refImg = document.createElement('img');
  Object.assign(refImg.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    objectFit: 'contain', zIndex: '8985',
    display: 'none', opacity: '0.7',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.08)',
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  let refOpacityIdx = 1; // começa em 70%
  let refLoaded     = false;
  let refVisible    = false;

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    refImg.src = url;
    refLoaded = true; refVisible = true;
    refImg.style.display = 'block';
    updateRefBtn();
    fileInput.value = '';
  });

  function updateRefBtn() {
    btnRef.style.background = refLoaded && refVisible
      ? `rgba(220,100,10,0.88)` : 'rgba(55,55,55,0.78)';
    const pct = Math.round(OPACITIES[refOpacityIdx] * 100);
    btnRef.title = refLoaded ? `Referência — ${pct}% opacidade` : 'Carregar imagem de referência';
  }

  /* ── Camada de guias ─────────────────────────────────────────── */
  const guideLayer = document.createElement('div');
  Object.assign(guideLayer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none',
    zIndex: '9000', display: 'none',
  });

  /* ── Painel de seleção ───────────────────────────────────────── */
  const selPanel = document.createElement('div');
  Object.assign(selPanel.style, {
    position: 'fixed', zIndex: '9003', display: 'none',
    flexDirection: 'column', gap: '7px', alignItems: 'center',
    background: 'rgba(8,4,28,0.96)',
    borderRadius: '13px', padding: '9px 11px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.13)',
  });

  /* Linha de nudge + dismiss */
  const nudgeRow = document.createElement('div');
  Object.assign(nudgeRow.style, { display: 'flex', gap: '4px', alignItems: 'center' });

  const posLabel = document.createElement('span');
  Object.assign(posLabel.style, {
    color: '#fff', fontFamily: 'monospace', fontSize: '12px', fontWeight: '900',
    minWidth: '48px', textAlign: 'center',
  });

  function mkSmBtn(txt, bg) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, {
      height: '30px', padding: '0 7px', borderRadius: '7px',
      background: bg || 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.16)',
      color: '#fff', fontSize: '11px', fontWeight: '800',
      fontFamily: 'monospace', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    return b;
  }

  const bM10   = mkSmBtn('−10');
  const bM1    = mkSmBtn('−1');
  const bP1    = mkSmBtn('+1');
  const bP10   = mkSmBtn('+10');
  const bDel   = mkSmBtn('🗑', 'rgba(200,30,30,0.65)');
  const bClose = mkSmBtn('✓', 'rgba(30,160,30,0.65)'); // fechar sem apagar

  function nudge(d) {
    if (!selected) return;
    selected.pos = Math.max(0, selected.pos + d);
    syncGuideDOM(selected);
    posLabel.textContent = selected.pos + 'px';
    positionSelPanel();
  }
  bM10.addEventListener  ('click', () => nudge(-10));
  bM1.addEventListener   ('click', () => nudge(-1));
  bP1.addEventListener   ('click', () => nudge(+1));
  bP10.addEventListener  ('click', () => nudge(+10));
  bDel.addEventListener  ('click', () => { removeGuide(selected); deselect(); });
  bClose.addEventListener('click', () => deselect());

  nudgeRow.append(bM10, bM1, posLabel, bP1, bP10, bDel, bClose);

  /* Linha de cores */
  const selColorRow = document.createElement('div');
  Object.assign(selColorRow.style, { display: 'flex', gap: '5px' });

  const selSwatches = COLORS.map(c => {
    const sw = document.createElement('button');
    Object.assign(sw.style, {
      width: '20px', height: '20px', borderRadius: '50%',
      background: c.solid, border: '2px solid rgba(255,255,255,0.2)',
      cursor: 'pointer', padding: '0',
    });
    sw.addEventListener('click', () => {
      if (!selected) return;
      selected.colorDef = c;
      selected.line.style.background = c.line;
      selected.badge.style.color = c.solid;
      refreshSelSwatches();
    });
    return sw;
  });
  selSwatches.forEach(sw => selColorRow.appendChild(sw));

  function refreshSelSwatches() {
    selSwatches.forEach((sw, i) => {
      sw.style.border = selected && COLORS[i] === selected.colorDef
        ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.18)';
    });
  }

  selPanel.append(nudgeRow, selColorRow);

  function positionSelPanel() {
    if (!selected) return;
    const W = window.innerWidth, H = window.innerHeight;
    const PW = 268, PH = 94;
    if (selected.type === 'h') {
      let top = selected.pos + 12;
      if (top + PH > H - 20) top = selected.pos - PH - 12;
      selPanel.style.left      = Math.max(4, (W - PW) / 2) + 'px';
      selPanel.style.top       = Math.max(4, top) + 'px';
      selPanel.style.transform = '';
    } else {
      let left = selected.pos + 12;
      if (left + PW > W - 4) left = selected.pos - PW - 12;
      selPanel.style.left      = Math.max(4, left) + 'px';
      selPanel.style.top       = Math.max(4, H * 0.28) + 'px';
      selPanel.style.transform = '';
    }
    selPanel.style.display = 'flex';
  }

  function selectGuide(g) {
    selected = g;
    posLabel.textContent = g.pos + 'px';
    refreshSelSwatches();
    positionSelPanel();
  }
  function deselect() {
    selected = null;
    selPanel.style.display = 'none';
  }

  /* ── Gerenciamento de guias ──────────────────────────────────── */
  function syncGuideDOM(g) {
    if (g.type === 'h') { g.line.style.top  = g.pos + 'px'; g.hit.style.top  = (g.pos - 14) + 'px'; }
    else                { g.line.style.left = g.pos + 'px'; g.hit.style.left = (g.pos - 14) + 'px'; }
    g.badge.textContent = g.pos + 'px';
  }

  function addGuide(type, pos, colorDef, skipHistory) {
    pos      = Math.round(pos);
    colorDef = colorDef || currentColor;

    const line  = document.createElement('div');
    const hit   = document.createElement('div');
    const badge = document.createElement('span');

    badge.textContent = pos + 'px';
    Object.assign(badge.style, {
      position: 'absolute', fontSize: '10px', fontFamily: 'monospace', fontWeight: '800',
      color: colorDef.solid, background: 'rgba(255,255,255,0.92)',
      padding: '1px 5px', borderRadius: '3px',
      whiteSpace: 'nowrap', pointerEvents: 'none', lineHeight: '1.5',
    });

    if (type === 'h') {
      Object.assign(line.style, { position: 'absolute', left: '0', right: '0',
        top: pos + 'px', height: '1px', background: colorDef.line, pointerEvents: 'none' });
      Object.assign(hit.style, { position: 'absolute', left: '0', right: '0',
        top: (pos - 14) + 'px', height: '28px',
        pointerEvents: 'auto', cursor: 'ns-resize', background: 'transparent' });
      Object.assign(badge.style, { left: '8px', top: '-16px' });
    } else {
      Object.assign(line.style, { position: 'absolute', top: '0', bottom: '0',
        left: pos + 'px', width: '1px', background: colorDef.line, pointerEvents: 'none' });
      Object.assign(hit.style, { position: 'absolute', top: '0', bottom: '0',
        left: (pos - 14) + 'px', width: '28px',
        pointerEvents: 'auto', cursor: 'ew-resize', background: 'transparent' });
      Object.assign(badge.style, { top: '8px', left: '4px', writingMode: 'vertical-rl', transform: 'rotate(180deg)' });
    }

    line.appendChild(badge);
    guideLayer.appendChild(line);
    guideLayer.appendChild(hit);

    const g = { type, pos, line, hit, badge, colorDef };
    guides.push(g);
    if (!skipHistory) addHistory.push(g);

    /* Arrasto com precisão de 1 px */
    let t0, p0, hasMoved;
    hit.addEventListener('touchstart', e => {
      t0 = e.touches[0]; p0 = g.pos; hasMoved = false;
      e.stopPropagation();
    }, { passive: true });

    hit.addEventListener('touchmove', e => {
      const t = e.touches[0]; hasMoved = true;
      if (type === 'h') g.pos = Math.max(0, Math.round(p0 + t.clientY - t0.clientY));
      else              g.pos = Math.max(0, Math.round(p0 + t.clientX - t0.clientX));
      syncGuideDOM(g);
      if (selected === g) { posLabel.textContent = g.pos + 'px'; positionSelPanel(); }
      e.stopPropagation(); e.preventDefault();
    }, { passive: false });

    hit.addEventListener('touchend', e => {
      // Sempre seleciona ao soltar — seja toque ou arraste
      selectGuide(g);
      e.stopPropagation();
    });

    return g;
  }

  function removeGuide(g) {
    if (!g) return;
    g.line.remove(); g.hit.remove();
    guides     = guides.filter(x => x !== g);
    addHistory = addHistory.filter(x => x !== g);
  }

  function clearAll() {
    guides.forEach(g => { g.line.remove(); g.hit.remove(); });
    guides = []; addHistory = [];
    deselect();
  }

  function undoLast() {
    if (!addHistory.length) return;
    const g = addHistory[addHistory.length - 1];
    if (selected === g) deselect();
    g.line.remove(); g.hit.remove();
    guides     = guides.filter(x => x !== g);
    addHistory = addHistory.filter(x => x !== g);
  }

  /* ── Tap layer ───────────────────────────────────────────────── */
  const tapLayer = document.createElement('div');
  Object.assign(tapLayer.style, { position: 'fixed', inset: '0', zIndex: '8995', display: 'none' });
  tapLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    deselect();
    addGuide(addMode, addMode === 'h' ? t.clientY : t.clientX);
    e.preventDefault();
  }, { passive: false });

  /* ── Modal salvar / carregar ─────────────────────────────────── */
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.68)',
    zIndex: '9010', display: 'none', alignItems: 'center', justifyContent: 'center',
  });
  const mBox = document.createElement('div');
  Object.assign(mBox.style, {
    background: 'rgba(10,5,32,0.98)', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '16px', padding: '18px', width: '268px', maxWidth: '88vw',
    color: '#fff', fontFamily: 'monospace',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: '0 6px 28px rgba(0,0,0,0.65)',
  });
  const mTitle  = document.createElement('div');
  Object.assign(mTitle.style, { fontWeight: '900', fontSize: '12px', letterSpacing: '.8px', color: 'rgba(255,255,255,0.6)' });
  const mInput  = document.createElement('input');
  Object.assign(mInput.style, {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '8px', padding: '8px 11px',
    color: '#fff', fontSize: '13px', fontFamily: 'monospace',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  });
  mInput.placeholder = 'nome do esquema…';
  const mList = document.createElement('div');
  Object.assign(mList.style, { display: 'none', flexDirection: 'column', gap: '5px', maxHeight: '210px', overflowY: 'auto' });
  const mActions = document.createElement('div');
  Object.assign(mActions.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });

  function mkMBtn(txt, bg) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, {
      padding: '7px 15px', borderRadius: '8px', background: bg,
      color: '#fff', border: 'none', fontFamily: 'monospace',
      fontWeight: '700', fontSize: '12px', cursor: 'pointer',
    });
    return b;
  }
  const mCancel = mkMBtn('Cancelar', 'rgba(80,80,80,0.60)');
  const mSaveOK = mkMBtn('Salvar',   'rgba(30,100,255,0.90)');
  mCancel.addEventListener('click', () => { modal.style.display = 'none'; });
  mSaveOK.addEventListener('click', () => {
    const name = mInput.value.trim() || ('esquema ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    const s = getSchemes();
    s[name] = guides.map(g => ({ type: g.type, pos: g.pos, colorId: g.colorDef.id }));
    putSchemes(s);
    modal.style.display = 'none';
  });
  mActions.append(mCancel, mSaveOK);
  mBox.append(mTitle, mInput, mList, mActions);
  modal.appendChild(mBox);
  modal.addEventListener('touchend', e => { if (e.target === modal) modal.style.display = 'none'; });

  function openModal(mode) {
    mTitle.textContent    = mode === 'save' ? 'SALVAR ESQUEMA' : 'CARREGAR ESQUEMA';
    mInput.style.display  = mode === 'save' ? 'block' : 'none';
    mSaveOK.style.display = mode === 'save' ? 'block' : 'none';
    mInput.value = ''; mList.innerHTML = ''; mList.style.display = 'none';

    if (mode === 'load') {
      const schemes = getSchemes();
      const names   = Object.keys(schemes);
      if (!names.length) {
        const empty = document.createElement('div');
        empty.textContent = 'Nenhum esquema salvo ainda.';
        Object.assign(empty.style, { color: 'rgba(255,255,255,0.35)', fontSize: '12px', padding: '6px 0' });
        mList.appendChild(empty);
      } else {
        names.forEach(name => {
          const row = document.createElement('div');
          Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });
          const lBtn = document.createElement('button');
          lBtn.textContent = name;
          Object.assign(lBtn.style, {
            flex: '1', padding: '8px 10px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontFamily: 'monospace', fontSize: '12px',
            cursor: 'pointer', textAlign: 'left',
          });
          lBtn.addEventListener('click', () => {
            clearAll();
            schemes[name].forEach(d => {
              const c = COLORS.find(x => x.id === d.colorId) || COLORS[0];
              addGuide(d.type, d.pos, c, true); // skipHistory: guias carregadas não entram no undo
            });
            modal.style.display = 'none';
          });
          const dBtn = document.createElement('button');
          dBtn.textContent = '✕';
          Object.assign(dBtn.style, {
            width: '30px', height: '30px', flexShrink: '0',
            borderRadius: '7px', background: 'rgba(200,30,30,0.55)',
            border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer',
          });
          dBtn.addEventListener('click', () => { const s2 = getSchemes(); delete s2[name]; putSchemes(s2); row.remove(); });
          row.append(lBtn, dBtn);
          mList.appendChild(row);
        });
      }
      mList.style.display = 'flex';
    }
    modal.style.display = 'flex';
    if (mode === 'save') setTimeout(() => mInput.focus(), 80);
  }

  /* ── Painel de controles ─────────────────────────────────────── */
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', bottom: '140px',
    zIndex: '9001', display: 'none',
    flexDirection: 'column', gap: '6px', alignItems: 'center',
  });

  function mkPBtn(label, bg) {
    const b = document.createElement('button');
    b.innerHTML = label;
    Object.assign(b.style, {
      width: '36px', height: '36px', borderRadius: '50%',
      border: '1.5px solid rgba(255,255,255,0.22)',
      background: bg, color: '#fff',
      fontSize: '13px', fontWeight: '800', fontFamily: 'monospace',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    return b;
  }

  const btnH    = mkPBtn('H',  COLORS[0].solid);
  const btnV    = mkPBtn('V',  'rgba(80,80,80,0.55)');
  const btnUndo = mkPBtn('↩',  'rgba(80,40,140,0.80)');
  const btnClr  = mkPBtn('✕',  'rgba(55,55,55,0.78)');
  const btnSav  = mkPBtn('💾', 'rgba(25,90,200,0.82)');
  const btnLod  = mkPBtn('📂', 'rgba(15,130,15,0.82)');
  const btnRef  = mkPBtn('🖼', 'rgba(55,55,55,0.78)');

  /* Indicador de cor no botão H */
  const colorDot = document.createElement('div');
  Object.assign(colorDot.style, {
    width: '9px', height: '9px', borderRadius: '50%',
    background: currentColor.solid,
    border: '1.5px solid rgba(255,255,255,0.7)',
    position: 'absolute', bottom: '1px', right: '1px',
    pointerEvents: 'none',
  });
  const btnHWrap = document.createElement('div');
  Object.assign(btnHWrap.style, { position: 'relative', display: 'inline-flex' });
  btnHWrap.append(btnH, colorDot);

  /* Mini seletor de cor (segurar H ou V) */
  const colorPick = document.createElement('div');
  Object.assign(colorPick.style, {
    position: 'fixed', right: '56px', bottom: '140px',
    zIndex: '9002', display: 'none',
    flexDirection: 'column', gap: '5px',
    background: 'rgba(8,4,28,0.95)', borderRadius: '11px', padding: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 3px 14px rgba(0,0,0,0.5)',
  });
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    Object.assign(sw.style, {
      width: '24px', height: '24px', borderRadius: '50%',
      background: c.solid, border: '2px solid rgba(255,255,255,0.2)',
      cursor: 'pointer', padding: '0',
    });
    sw.addEventListener('click', () => {
      currentColor = c;
      colorDot.style.background = c.solid;
      colorPick.style.display = 'none';
      updateModeBtns();
    });
    colorPick.appendChild(sw);
  });

  function updateModeBtns() {
    btnH.style.background = addMode === 'h' ? currentColor.solid : 'rgba(80,80,80,0.55)';
    btnV.style.background = addMode === 'v' ? currentColor.solid : 'rgba(80,80,80,0.55)';
  }

  let holdTimer;
  [btnH, btnV].forEach(b => {
    b.addEventListener('touchstart', () => {
      holdTimer = setTimeout(() => {
        colorPick.style.display = colorPick.style.display === 'flex' ? 'none' : 'flex';
      }, 500);
    }, { passive: true });
    b.addEventListener('touchend', () => clearTimeout(holdTimer));
  });

  /* Segurar 🖼 cicla opacidade */
  let refHoldTimer;
  btnRef.addEventListener('touchstart', () => {
    refHoldTimer = setTimeout(() => {
      if (!refLoaded) return;
      refOpacityIdx = (refOpacityIdx + 1) % OPACITIES.length;
      refImg.style.opacity = OPACITIES[refOpacityIdx];
      updateRefBtn();
    }, 500);
  }, { passive: true });
  btnRef.addEventListener('touchend', () => clearTimeout(refHoldTimer));

  btnH.addEventListener   ('click', () => { addMode = 'h'; updateModeBtns(); });
  btnV.addEventListener   ('click', () => { addMode = 'v'; updateModeBtns(); });
  btnUndo.addEventListener('click', undoLast);
  btnClr.addEventListener ('click', clearAll);
  btnSav.addEventListener ('click', () => openModal('save'));
  btnLod.addEventListener ('click', () => openModal('load'));
  btnRef.addEventListener ('click', () => {
    if (!refLoaded) {
      fileInput.click();
    } else {
      refVisible = !refVisible;
      refImg.style.display = refVisible ? 'block' : 'none';
      updateRefBtn();
    }
  });

  panel.append(btnRef, btnLod, btnSav, btnUndo, btnClr, btnV, btnHWrap);

  /* ── Botão principal de ativação ─────────────────────────────── */
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'dev-ruler-btn';
  toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="7"  y1="7"  x2="7"  y2="17"/>
    <line x1="12" y1="7"  x2="12" y2="17"/>
    <line x1="17" y1="7"  x2="17" y2="17"/>
    <line x1="7"  y1="12" x2="12" y2="12"/>
  </svg>`;
  Object.assign(toggleBtn.style, {
    position: 'fixed', right: '12px', bottom: '80px',
    zIndex: '9002', width: '40px', height: '40px', borderRadius: '50%',
    background: 'rgba(6,2,26,0.78)', color: '#fff',
    border: '1.5px solid rgba(255,255,255,0.14)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  toggleBtn.addEventListener('click', () => {
    active = !active;
    canvas.style.display     = active ? 'block' : 'none';
    guideLayer.style.display = active ? 'block' : 'none';
    tapLayer.style.display   = active ? 'block' : 'none';
    panel.style.display      = active ? 'flex'  : 'none';
    colorPick.style.display  = 'none';
    if (!active) { deselect(); }
    if (active && refLoaded && refVisible) refImg.style.display = 'block';
    if (!active) refImg.style.display = 'none';
    toggleBtn.style.background = active ? 'rgba(220,20,20,0.85)' : 'rgba(6,2,26,0.78)';
    if (active) drawGrid();
  });

  window.addEventListener('resize', () => { if (active) drawGrid(); });

  document.body.append(refImg, fileInput, canvas, guideLayer, tapLayer, panel, colorPick, selPanel, modal, toggleBtn);
})();
