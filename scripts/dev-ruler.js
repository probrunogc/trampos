/* ─── DEV RULER v4 ────────────────────────────────────────────
   Ferramenta temporária de alinhamento.
   Para remover: apague este arquivo e o <script> no loja.html.

   • Grid + guias arrastáveis (precisão 1 px)
   • Auto-seleciona guia ao soltar o arraste
   • ↩  Desfazer última guia
   • 💾 / 📂  Salvar / carregar esquemas (localStorage)
   • 🖼  Imagem de referência em tela cheia
   • 📐  Modo resize: toca qualquer elemento → borda + handles
         Arrasta para redimensionar → copia o valor em px
   ─────────────────────────────────────────────────────────────── */

(function () {
  /* ══════════════════════════════════════════════════════════════
     CONSTANTES / ESTADO
  ══════════════════════════════════════════════════════════════ */
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

  let toolActive    = false;   // régua ligada/desligada
  let addMode       = 'h';
  let currentColor  = COLORS[0];
  let guides        = [];
  let addHistory    = [];
  let selected      = null;   // guia selecionada
  let resizeMode    = false;  // modo resize ativo
  let rTarget       = null;   // elemento selecionado para resize
  let rOrigStyles   = {};     // estilos originais (para reverter)
  let rStartTouch   = null;
  let rStartRect    = null;
  let rDragType     = '';     // 'w' | 'h' | 'wh'

  /* ══════════════════════════════════════════════════════════════
     STORAGE
  ══════════════════════════════════════════════════════════════ */
  function getSchemes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function putSchemes(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

  /* ══════════════════════════════════════════════════════════════
     CANVAS (GRID AZUL)
  ══════════════════════════════════════════════════════════════ */
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
      ctx.strokeStyle = 'rgba(30,120,255,0.22)';
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)'; ctx.fillText(x, x+2, 11);
    }
    for (let y = 50; y <= H; y += 50) {
      ctx.strokeStyle = 'rgba(30,120,255,0.22)';
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)'; ctx.fillText(y, 2, y-2);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     IMAGEM DE REFERÊNCIA
  ══════════════════════════════════════════════════════════════ */
  const refImg = document.createElement('img');
  Object.assign(refImg.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    objectFit: 'contain', zIndex: '8985',
    display: 'none', opacity: '0.7', pointerEvents: 'none',
    background: 'rgba(0,0,0,0.05)',
  });
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  let refOpacityIdx = 1, refLoaded = false, refVisible = false;
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    refImg.src = URL.createObjectURL(file);
    refLoaded = true; refVisible = true;
    refImg.style.display = 'block';
    updateRefBtn(); fileInput.value = '';
  });
  function updateRefBtn() {
    btnRef.style.background = refLoaded && refVisible
      ? 'rgba(220,100,10,0.88)' : 'rgba(55,55,55,0.78)';
  }

  /* ══════════════════════════════════════════════════════════════
     CAMADA DE GUIAS
  ══════════════════════════════════════════════════════════════ */
  const guideLayer = document.createElement('div');
  Object.assign(guideLayer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none',
    zIndex: '9000', display: 'none',
  });

  /* ── Painel de seleção de guia ────────────────────────────── */
  const selPanel = document.createElement('div');
  Object.assign(selPanel.style, {
    position: 'fixed', zIndex: '9003', display: 'none',
    flexDirection: 'column', gap: '7px', alignItems: 'center',
    background: 'rgba(8,4,28,0.96)', borderRadius: '13px', padding: '9px 11px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.13)',
  });

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

  const bM10 = mkSmBtn('−10'); const bM1 = mkSmBtn('−1');
  const bP1  = mkSmBtn('+1');  const bP10 = mkSmBtn('+10');
  const bDel = mkSmBtn('🗑', 'rgba(200,30,30,0.65)');
  const bClose = mkSmBtn('✓', 'rgba(30,160,30,0.65)');

  function nudge(d) {
    if (!selected) return;
    selected.pos = Math.max(0, selected.pos + d);
    syncGuideDOM(selected);
    posLabel.textContent = selected.pos + 'px';
    positionSelPanel();
  }
  bM10.addEventListener('click',   () => nudge(-10));
  bM1.addEventListener('click',    () => nudge(-1));
  bP1.addEventListener('click',    () => nudge(+1));
  bP10.addEventListener('click',   () => nudge(+10));
  bDel.addEventListener('click',   () => { removeGuide(selected); deselect(); });
  bClose.addEventListener('click', () => deselect());
  nudgeRow.append(bM10, bM1, posLabel, bP1, bP10, bDel, bClose);

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
      selPanel.style.left = Math.max(4, (W - PW) / 2) + 'px';
      selPanel.style.top  = Math.max(4, top) + 'px';
    } else {
      let left = selected.pos + 12;
      if (left + PW > W - 4) left = selected.pos - PW - 12;
      selPanel.style.left = Math.max(4, left) + 'px';
      selPanel.style.top  = Math.max(4, H * 0.28) + 'px';
    }
    selPanel.style.display = 'flex';
  }

  function selectGuide(g) {
    selected = g;
    posLabel.textContent = g.pos + 'px';
    refreshSelSwatches();
    positionSelPanel();
  }
  function deselect() { selected = null; selPanel.style.display = 'none'; }

  /* ── Funções de guia ──────────────────────────────────────── */
  function syncGuideDOM(g) {
    if (g.type === 'h') { g.line.style.top  = g.pos + 'px'; g.hit.style.top  = (g.pos-14)+'px'; }
    else                { g.line.style.left = g.pos + 'px'; g.hit.style.left = (g.pos-14)+'px'; }
    g.badge.textContent = g.pos + 'px';
  }

  function addGuide(type, pos, colorDef, skipHistory) {
    pos = Math.round(pos); colorDef = colorDef || currentColor;
    const line = document.createElement('div');
    const hit  = document.createElement('div');
    const badge = document.createElement('span');
    badge.textContent = pos + 'px';
    Object.assign(badge.style, {
      position: 'absolute', fontSize: '10px', fontFamily: 'monospace', fontWeight: '800',
      color: colorDef.solid, background: 'rgba(255,255,255,0.92)',
      padding: '1px 5px', borderRadius: '3px',
      whiteSpace: 'nowrap', pointerEvents: 'none', lineHeight: '1.5',
    });
    if (type === 'h') {
      Object.assign(line.style, { position:'absolute', left:'0', right:'0', top:pos+'px', height:'1px', background:colorDef.line, pointerEvents:'none' });
      Object.assign(hit.style,  { position:'absolute', left:'0', right:'0', top:(pos-14)+'px', height:'28px', pointerEvents:'auto', cursor:'ns-resize', background:'transparent' });
      Object.assign(badge.style, { left:'8px', top:'-16px' });
    } else {
      Object.assign(line.style, { position:'absolute', top:'0', bottom:'0', left:pos+'px', width:'1px', background:colorDef.line, pointerEvents:'none' });
      Object.assign(hit.style,  { position:'absolute', top:'0', bottom:'0', left:(pos-14)+'px', width:'28px', pointerEvents:'auto', cursor:'ew-resize', background:'transparent' });
      Object.assign(badge.style, { top:'8px', left:'4px', writingMode:'vertical-rl', transform:'rotate(180deg)' });
    }
    line.appendChild(badge);
    guideLayer.appendChild(line); guideLayer.appendChild(hit);
    const g = { type, pos, line, hit, badge, colorDef };
    guides.push(g);
    if (!skipHistory) addHistory.push(g);

    let t0, p0, hasMoved;
    hit.addEventListener('touchstart', e => { t0 = e.touches[0]; p0 = g.pos; hasMoved = false; e.stopPropagation(); }, { passive: true });
    hit.addEventListener('touchmove', e => {
      const t = e.touches[0]; hasMoved = true;
      if (type === 'h') g.pos = Math.max(0, Math.round(p0 + t.clientY - t0.clientY));
      else              g.pos = Math.max(0, Math.round(p0 + t.clientX - t0.clientX));
      syncGuideDOM(g);
      if (selected === g) { posLabel.textContent = g.pos + 'px'; positionSelPanel(); }
      e.stopPropagation(); e.preventDefault();
    }, { passive: false });
    hit.addEventListener('touchend', e => { selectGuide(g); e.stopPropagation(); });
    return g;
  }

  function removeGuide(g) {
    if (!g) return;
    g.line.remove(); g.hit.remove();
    guides = guides.filter(x => x !== g);
    addHistory = addHistory.filter(x => x !== g);
  }
  function clearAll() {
    guides.forEach(g => { g.line.remove(); g.hit.remove(); });
    guides = []; addHistory = []; deselect();
  }
  function undoLast() {
    if (!addHistory.length) return;
    const g = addHistory[addHistory.length - 1];
    if (selected === g) deselect();
    g.line.remove(); g.hit.remove();
    guides = guides.filter(x => x !== g);
    addHistory = addHistory.filter(x => x !== g);
  }

  /* ══════════════════════════════════════════════════════════════
     TAP LAYER (coloca guias)
  ══════════════════════════════════════════════════════════════ */
  const tapLayer = document.createElement('div');
  Object.assign(tapLayer.style, { position:'fixed', inset:'0', zIndex:'8995', display:'none' });
  tapLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    deselect();
    addGuide(addMode, addMode === 'h' ? t.clientY : t.clientX);
    e.preventDefault();
  }, { passive: false });

  /* ══════════════════════════════════════════════════════════════
     MODO RESIZE — selecionar e redimensionar elementos
  ══════════════════════════════════════════════════════════════ */

  /* Camada transparente que captura toques para selecionar elemento */
  const rSelLayer = document.createElement('div');
  Object.assign(rSelLayer.style, {
    position: 'fixed', inset: '0', zIndex: '8996', display: 'none',
    background: 'transparent',
  });

  /* Borda verde ao redor do elemento selecionado */
  const rBorderEl = document.createElement('div');
  Object.assign(rBorderEl.style, {
    position: 'fixed', display: 'none', pointerEvents: 'none', zIndex: '9004',
    border: '2px solid rgba(30,210,80,0.9)', borderRadius: '4px',
    background: 'rgba(30,210,80,0.05)', boxSizing: 'border-box',
  });

  /* Badge de dimensões */
  const rDimBadge = document.createElement('div');
  Object.assign(rDimBadge.style, {
    position: 'fixed', display: 'none', pointerEvents: 'none', zIndex: '9004',
    background: 'rgba(20,180,60,0.95)', color: '#fff',
    fontFamily: 'monospace', fontSize: '12px', fontWeight: '900',
    padding: '3px 9px', borderRadius: '5px', whiteSpace: 'nowrap',
  });

  /* Handles */
  function mkHandle(cursor, label) {
    const h = document.createElement('div');
    Object.assign(h.style, {
      position: 'fixed', display: 'none', zIndex: '9005',
      background: 'rgba(20,200,70,0.92)',
      border: '2px solid rgba(255,255,255,0.7)',
      borderRadius: '5px', cursor,
      alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: '11px', fontWeight: '900',
      fontFamily: 'monospace', userSelect: 'none',
    });
    h.textContent = label;
    return h;
  }
  const rHandleR = mkHandle('ew-resize', '↔'); Object.assign(rHandleR.style, { width:'22px', height:'44px' });
  const rHandleB = mkHandle('ns-resize', '↕'); Object.assign(rHandleB.style, { width:'44px', height:'22px' });
  const rHandleC = mkHandle('nwse-resize','⤡'); Object.assign(rHandleC.style, { width:'28px', height:'28px' });

  /* Painel de resultado (classe + copiar valores) */
  const rInfoPanel = document.createElement('div');
  Object.assign(rInfoPanel.style, {
    position: 'fixed', zIndex: '9006', display: 'none',
    flexDirection: 'column', gap: '6px',
    background: 'rgba(8,4,28,0.96)',
    borderRadius: '13px', padding: '10px 12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.13)',
    bottom: '150px', left: '10px', right: '60px',
  });

  const rClassName  = document.createElement('div');
  Object.assign(rClassName.style, { color:'rgba(30,210,80,0.9)', fontFamily:'monospace', fontSize:'11px', fontWeight:'900', letterSpacing:'.4px' });

  const rValRow = document.createElement('div');
  Object.assign(rValRow.style, { display:'flex', gap:'6px', alignItems:'center' });

  const rWLabel = document.createElement('span');
  Object.assign(rWLabel.style, { color:'rgba(255,255,255,0.55)', fontFamily:'monospace', fontSize:'11px', minWidth:'14px' });
  rWLabel.textContent = 'W';
  const rWVal = document.createElement('span');
  Object.assign(rWVal.style, { color:'#fff', fontFamily:'monospace', fontSize:'13px', fontWeight:'900', minWidth:'56px' });
  const rWCopy = document.createElement('button');
  rWCopy.textContent = '📋';
  Object.assign(rWCopy.style, { background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'5px', padding:'3px 7px', cursor:'pointer', fontSize:'12px' });

  const rHLabel = document.createElement('span');
  Object.assign(rHLabel.style, { color:'rgba(255,255,255,0.55)', fontFamily:'monospace', fontSize:'11px', minWidth:'14px', marginLeft:'6px' });
  rHLabel.textContent = 'H';
  const rHVal = document.createElement('span');
  Object.assign(rHVal.style, { color:'#fff', fontFamily:'monospace', fontSize:'13px', fontWeight:'900', minWidth:'56px' });
  const rHCopy = document.createElement('button');
  rHCopy.textContent = '📋';
  Object.assign(rHCopy.style, { background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'5px', padding:'3px 7px', cursor:'pointer', fontSize:'12px' });

  const rBtnRow = document.createElement('div');
  Object.assign(rBtnRow.style, { display:'flex', gap:'6px' });

  const rBtnRevert = document.createElement('button');
  rBtnRevert.textContent = '↩ Reverter';
  Object.assign(rBtnRevert.style, { flex:'1', padding:'6px 10px', borderRadius:'7px', background:'rgba(200,30,30,0.55)', border:'none', color:'#fff', fontFamily:'monospace', fontSize:'11px', fontWeight:'700', cursor:'pointer' });

  const rBtnDesel = document.createElement('button');
  rBtnDesel.textContent = '✓ OK';
  Object.assign(rBtnDesel.style, { flex:'1', padding:'6px 10px', borderRadius:'7px', background:'rgba(30,160,30,0.65)', border:'none', color:'#fff', fontFamily:'monospace', fontSize:'11px', fontWeight:'700', cursor:'pointer' });

  function copyToClipboard(txt) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
    } else { fallbackCopy(txt); }
  }
  function fallbackCopy(txt) {
    const inp = document.createElement('input');
    inp.value = txt; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy'); inp.remove();
  }

  function updateRInfoPanel() {
    if (!rTarget) return;
    const rect = rTarget.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    rWVal.textContent = w + 'px';
    rHVal.textContent = h + 'px';
  }

  rWCopy.addEventListener('click', () => { copyToClipboard(rWVal.textContent); rWCopy.textContent = '✓'; setTimeout(() => rWCopy.textContent = '📋', 1200); });
  rHCopy.addEventListener('click', () => { copyToClipboard(rHVal.textContent); rHCopy.textContent = '✓'; setTimeout(() => rHCopy.textContent = '📋', 1200); });
  rBtnRevert.addEventListener('click', () => {
    if (!rTarget) return;
    Object.assign(rTarget.style, rOrigStyles);
    updateResizeUI();
    updateRInfoPanel();
  });
  rBtnDesel.addEventListener('click', clearResizeSelection);

  rValRow.append(rWLabel, rWVal, rWCopy, rHLabel, rHVal, rHCopy);
  rBtnRow.append(rBtnRevert, rBtnDesel);
  rInfoPanel.append(rClassName, rValRow, rBtnRow);

  /* Posicionar borda + handles em torno do elemento */
  function updateResizeUI() {
    if (!rTarget) return;
    const rect = rTarget.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;

    Object.assign(rBorderEl.style, {
      display: 'block',
      left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
    });

    const badgeY = rect.top > 28 ? rect.top - 24 : rect.bottom + 6;
    Object.assign(rDimBadge.style, {
      display: 'block',
      left: rect.left + 'px', top: badgeY + 'px',
    });
    rDimBadge.textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px';

    // Handle direito (largura)
    Object.assign(rHandleR.style, {
      display: 'flex',
      left: (rect.right - 11) + 'px',
      top:  (rect.top + (rect.height - 44) / 2) + 'px',
    });
    // Handle inferior (altura)
    Object.assign(rHandleB.style, {
      display: 'flex',
      left: (rect.left + (rect.width - 44) / 2) + 'px',
      top:  (rect.bottom - 11) + 'px',
    });
    // Handle canto inferior-direito
    Object.assign(rHandleC.style, {
      display: 'flex',
      left: (rect.right - 14) + 'px',
      top:  (rect.bottom - 14) + 'px',
    });
  }

  /* Lógica de arrastar os handles */
  function setupHandleDrag(handle, type) {
    handle.addEventListener('touchstart', e => {
      rDragType = type;
      rStartTouch = e.touches[0];
      rStartRect  = rTarget.getBoundingClientRect();
      e.stopPropagation();
    }, { passive: true });

    handle.addEventListener('touchmove', e => {
      if (!rTarget || !rStartRect) return;
      const t = e.touches[0];
      const dX = t.clientX - rStartTouch.clientX;
      const dY = t.clientY - rStartTouch.clientY;
      const newW = Math.max(20, Math.round(rStartRect.width  + dX));
      const newH = Math.max(20, Math.round(rStartRect.height + dY));

      if (type === 'w' || type === 'wh') {
        rTarget.style.width     = newW + 'px';
        rTarget.style.flexBasis = newW + 'px';
        rTarget.style.maxWidth  = newW + 'px';
        rTarget.style.minWidth  = '';
      }
      if (type === 'h' || type === 'wh') {
        rTarget.style.height    = newH + 'px';
        rTarget.style.minHeight = newH + 'px';
        rTarget.style.aspectRatio = 'unset';
      }
      updateResizeUI();
      updateRInfoPanel();
      e.stopPropagation(); e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchend', e => { e.stopPropagation(); });
  }
  setupHandleDrag(rHandleR, 'w');
  setupHandleDrag(rHandleB, 'h');
  setupHandleDrag(rHandleC, 'wh');

  /* Selecionar elemento ao tocar */
  rSelLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    rSelLayer.style.visibility = 'hidden';
    const el = document.elementFromPoint(t.clientX, t.clientY);
    rSelLayer.style.visibility = 'visible';

    if (!el || el === document.body || el === document.documentElement) return;
    // Ignorar elementos do próprio ruler
    if (el.closest('#dev-ruler-btn') ||
        el.closest('[data-ruler]')) return;

    clearResizeSelection();
    rTarget = el;
    rOrigStyles = {
      width: el.style.width, height: el.style.height,
      flexBasis: el.style.flexBasis, maxWidth: el.style.maxWidth,
      minWidth: el.style.minWidth, minHeight: el.style.minHeight,
      aspectRatio: el.style.aspectRatio,
    };

    // Nome do elemento para o painel
    const classes = Array.from(el.classList).slice(0, 3).join(' .');
    rClassName.textContent = (classes ? '.' + classes : el.tagName.toLowerCase());

    updateResizeUI();
    updateRInfoPanel();
    rInfoPanel.style.display = 'flex';
    e.preventDefault();
  }, { passive: false });

  function clearResizeSelection() {
    rTarget = null;
    rBorderEl.style.display = 'none';
    rDimBadge.style.display = 'none';
    rHandleR.style.display = rHandleB.style.display = rHandleC.style.display = 'none';
    rInfoPanel.style.display = 'none';
  }

  function setResizeMode(on) {
    resizeMode = on;
    rSelLayer.style.display  = on ? 'block' : 'none';
    tapLayer.style.display   = on ? 'none'  : (toolActive ? 'block' : 'none');
    if (!on) clearResizeSelection();
    btnResize.style.background = on ? 'rgba(20,200,70,0.85)' : 'rgba(55,55,55,0.78)';
  }

  /* ══════════════════════════════════════════════════════════════
     MODAL SALVAR / CARREGAR
  ══════════════════════════════════════════════════════════════ */
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
  const mTitle = document.createElement('div');
  Object.assign(mTitle.style, { fontWeight:'900', fontSize:'12px', letterSpacing:'.8px', color:'rgba(255,255,255,0.6)' });
  const mInput = document.createElement('input');
  Object.assign(mInput.style, {
    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.18)',
    borderRadius:'8px', padding:'8px 11px',
    color:'#fff', fontSize:'13px', fontFamily:'monospace',
    outline:'none', width:'100%', boxSizing:'border-box',
  });
  mInput.placeholder = 'nome do esquema…';
  const mList = document.createElement('div');
  Object.assign(mList.style, { display:'none', flexDirection:'column', gap:'5px', maxHeight:'210px', overflowY:'auto' });
  const mActions = document.createElement('div');
  Object.assign(mActions.style, { display:'flex', gap:'8px', justifyContent:'flex-end' });

  function mkMBtn(txt, bg) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, { padding:'7px 15px', borderRadius:'8px', background:bg, color:'#fff', border:'none', fontFamily:'monospace', fontWeight:'700', fontSize:'12px', cursor:'pointer' });
    return b;
  }
  const mCancel = mkMBtn('Cancelar', 'rgba(80,80,80,0.60)');
  const mSaveOK = mkMBtn('Salvar', 'rgba(30,100,255,0.90)');
  mCancel.addEventListener('click', () => { modal.style.display = 'none'; });
  mSaveOK.addEventListener('click', () => {
    const name = mInput.value.trim() || ('esquema ' + new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }));
    const s = getSchemes();
    s[name] = guides.map(g => ({ type:g.type, pos:g.pos, colorId:g.colorDef.id }));
    putSchemes(s); modal.style.display = 'none';
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
      const schemes = getSchemes(), names = Object.keys(schemes);
      if (!names.length) {
        const empty = document.createElement('div');
        empty.textContent = 'Nenhum esquema salvo ainda.';
        Object.assign(empty.style, { color:'rgba(255,255,255,0.35)', fontSize:'12px', padding:'6px 0' });
        mList.appendChild(empty);
      } else {
        names.forEach(name => {
          const row = document.createElement('div');
          Object.assign(row.style, { display:'flex', gap:'6px', alignItems:'center' });
          const lBtn = document.createElement('button');
          lBtn.textContent = name;
          Object.assign(lBtn.style, { flex:'1', padding:'8px 10px', borderRadius:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontFamily:'monospace', fontSize:'12px', cursor:'pointer', textAlign:'left' });
          lBtn.addEventListener('click', () => {
            clearAll();
            schemes[name].forEach(d => { const c = COLORS.find(x => x.id === d.colorId) || COLORS[0]; addGuide(d.type, d.pos, c, true); });
            modal.style.display = 'none';
          });
          const dBtn = document.createElement('button');
          dBtn.textContent = '✕';
          Object.assign(dBtn.style, { width:'30px', height:'30px', flexShrink:'0', borderRadius:'7px', background:'rgba(200,30,30,0.55)', border:'none', color:'#fff', fontSize:'13px', cursor:'pointer' });
          dBtn.addEventListener('click', () => { const s2 = getSchemes(); delete s2[name]; putSchemes(s2); row.remove(); });
          row.append(lBtn, dBtn); mList.appendChild(row);
        });
      }
      mList.style.display = 'flex';
    }
    modal.style.display = 'flex';
    if (mode === 'save') setTimeout(() => mInput.focus(), 80);
  }

  /* ══════════════════════════════════════════════════════════════
     PAINEL DE CONTROLES
  ══════════════════════════════════════════════════════════════ */
  const panel = document.createElement('div');
  panel.setAttribute('data-ruler', '1');
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', bottom: '140px',
    zIndex: '9001', display: 'none',
    flexDirection: 'column', gap: '6px', alignItems: 'center',
  });

  function mkPBtn(label, bg) {
    const b = document.createElement('button');
    b.setAttribute('data-ruler', '1');
    b.innerHTML = label;
    Object.assign(b.style, {
      width:'36px', height:'36px', borderRadius:'50%',
      border:'1.5px solid rgba(255,255,255,0.22)',
      background:bg, color:'#fff',
      fontSize:'13px', fontWeight:'800', fontFamily:'monospace',
      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    });
    return b;
  }

  const btnH      = mkPBtn('H',  COLORS[0].solid);
  const btnV      = mkPBtn('V',  'rgba(80,80,80,0.55)');
  const btnUndo   = mkPBtn('↩',  'rgba(80,40,140,0.80)');
  const btnClr    = mkPBtn('✕',  'rgba(55,55,55,0.78)');
  const btnSav    = mkPBtn('💾', 'rgba(25,90,200,0.82)');
  const btnLod    = mkPBtn('📂', 'rgba(15,130,15,0.82)');
  const btnRef    = mkPBtn('🖼', 'rgba(55,55,55,0.78)');
  const btnResize = mkPBtn('📐', 'rgba(55,55,55,0.78)');

  // Dot indicador de cor atual no botão H
  const colorDot = document.createElement('div');
  Object.assign(colorDot.style, {
    width:'9px', height:'9px', borderRadius:'50%',
    background:currentColor.solid, border:'1.5px solid rgba(255,255,255,0.7)',
    position:'absolute', bottom:'1px', right:'1px', pointerEvents:'none',
  });
  const btnHWrap = document.createElement('div');
  btnHWrap.setAttribute('data-ruler', '1');
  Object.assign(btnHWrap.style, { position:'relative', display:'inline-flex' });
  btnHWrap.append(btnH, colorDot);

  // Mini seletor de cor (segurar H ou V)
  const colorPick = document.createElement('div');
  colorPick.setAttribute('data-ruler', '1');
  Object.assign(colorPick.style, {
    position:'fixed', right:'56px', bottom:'140px', zIndex:'9002', display:'none',
    flexDirection:'column', gap:'5px',
    background:'rgba(8,4,28,0.95)', borderRadius:'11px', padding:'8px',
    border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 3px 14px rgba(0,0,0,0.5)',
  });
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.setAttribute('data-ruler', '1');
    Object.assign(sw.style, { width:'24px', height:'24px', borderRadius:'50%', background:c.solid, border:'2px solid rgba(255,255,255,0.2)', cursor:'pointer', padding:'0' });
    sw.addEventListener('click', () => { currentColor = c; colorDot.style.background = c.solid; colorPick.style.display = 'none'; updateModeBtns(); });
    colorPick.appendChild(sw);
  });

  function updateModeBtns() {
    btnH.style.background = addMode === 'h' ? currentColor.solid : 'rgba(80,80,80,0.55)';
    btnV.style.background = addMode === 'v' ? currentColor.solid : 'rgba(80,80,80,0.55)';
  }

  let holdTimer, refHoldTimer;
  [btnH, btnV].forEach(b => {
    b.addEventListener('touchstart', () => { holdTimer = setTimeout(() => { colorPick.style.display = colorPick.style.display === 'flex' ? 'none' : 'flex'; }, 500); }, { passive:true });
    b.addEventListener('touchend', () => clearTimeout(holdTimer));
  });
  btnRef.addEventListener('touchstart', () => {
    refHoldTimer = setTimeout(() => {
      if (!refLoaded) return;
      refOpacityIdx = (refOpacityIdx + 1) % OPACITIES.length;
      refImg.style.opacity = OPACITIES[refOpacityIdx];
      updateRefBtn();
    }, 500);
  }, { passive:true });
  btnRef.addEventListener('touchend', () => clearTimeout(refHoldTimer));

  btnH.addEventListener   ('click', () => { addMode = 'h'; updateModeBtns(); });
  btnV.addEventListener   ('click', () => { addMode = 'v'; updateModeBtns(); });
  btnUndo.addEventListener('click', undoLast);
  btnClr.addEventListener ('click', clearAll);
  btnSav.addEventListener ('click', () => openModal('save'));
  btnLod.addEventListener ('click', () => openModal('load'));
  btnRef.addEventListener ('click', () => {
    if (!refLoaded) { fileInput.click(); }
    else { refVisible = !refVisible; refImg.style.display = refVisible ? 'block' : 'none'; updateRefBtn(); }
  });
  btnResize.addEventListener('click', () => setResizeMode(!resizeMode));

  panel.append(btnResize, btnRef, btnLod, btnSav, btnUndo, btnClr, btnV, btnHWrap);

  /* ══════════════════════════════════════════════════════════════
     BOTÃO DE ATIVAÇÃO PRINCIPAL
  ══════════════════════════════════════════════════════════════ */
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'dev-ruler-btn';
  toggleBtn.setAttribute('data-ruler', '1');
  toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="7"  y1="7"  x2="7"  y2="17"/>
    <line x1="12" y1="7"  x2="12" y2="17"/>
    <line x1="17" y1="7"  x2="17" y2="17"/>
    <line x1="7"  y1="12" x2="12" y2="12"/>
  </svg>`;
  Object.assign(toggleBtn.style, {
    position:'fixed', right:'12px', bottom:'80px',
    zIndex:'9002', width:'40px', height:'40px', borderRadius:'50%',
    background:'rgba(6,2,26,0.78)', color:'#fff',
    border:'1.5px solid rgba(255,255,255,0.14)',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
  });

  toggleBtn.addEventListener('click', () => {
    toolActive = !toolActive;
    canvas.style.display     = toolActive ? 'block' : 'none';
    guideLayer.style.display = toolActive ? 'block' : 'none';
    panel.style.display      = toolActive ? 'flex'  : 'none';
    colorPick.style.display  = 'none';
    if (!toolActive) {
      deselect();
      setResizeMode(false);
      refImg.style.display = 'none';
    } else {
      if (refLoaded && refVisible) refImg.style.display = 'block';
      tapLayer.style.display = resizeMode ? 'none' : 'block';
      rSelLayer.style.display = resizeMode ? 'block' : 'none';
      drawGrid();
    }
    toggleBtn.style.background = toolActive ? 'rgba(220,20,20,0.85)' : 'rgba(6,2,26,0.78)';
  });

  window.addEventListener('resize', () => { if (toolActive) drawGrid(); });

  /* ══════════════════════════════════════════════════════════════
     MONTAR NO DOM
  ══════════════════════════════════════════════════════════════ */
  [panel, selPanel, colorPick, modal, rInfoPanel].forEach(el => el.setAttribute('data-ruler', '1'));
  [rBorderEl, rDimBadge, rHandleR, rHandleB, rHandleC, rSelLayer].forEach(el => el.setAttribute('data-ruler', '1'));

  document.body.append(
    refImg, fileInput,
    canvas, guideLayer, tapLayer,
    rSelLayer, rBorderEl, rDimBadge, rHandleR, rHandleB, rHandleC,
    panel, colorPick, selPanel, rInfoPanel, modal,
    toggleBtn
  );
})();
