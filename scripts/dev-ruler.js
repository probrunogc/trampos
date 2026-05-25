/* ─── DEV RULER v6 ────────────────────────────────────────────
   Ferramenta de design — temporária, remover antes do launch.

   v6 — novidades:
   • Histórico de desfazer para alterações de elemento (canvas)
   • Cadeado proporcional: resize mantendo proporções
   • Interface redesenhada: barra horizontal inferior
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
  const GSAP_URL    = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
  const H2C_URL     = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

  const HCONF = {
    nw: { x:-1, y:-1, cursor:'nwse-resize', size:[24,24] },
    n : { x: 0, y:-1, cursor:'ns-resize',   size:[44,18] },
    ne: { x: 1, y:-1, cursor:'nesw-resize', size:[24,24] },
    e : { x: 1, y: 0, cursor:'ew-resize',   size:[18,44] },
    se: { x: 1, y: 1, cursor:'nwse-resize', size:[24,24] },
    s : { x: 0, y: 1, cursor:'ns-resize',   size:[44,18] },
    sw: { x:-1, y: 1, cursor:'nesw-resize', size:[24,24] },
    w : { x:-1, y: 0, cursor:'ew-resize',   size:[18,44] },
  };

  let toolActive    = false;
  let addMode       = 'h';
  let currentColor  = COLORS[0];
  let guides        = [];
  let addHistory    = [];
  let selected      = null;

  let canvasMode    = false;
  let distRulerOn   = false;
  let wideViewOn    = false;
  let cPanelManualPos = false;
  let cTarget       = null;
  let cOrigStyles   = {};
  let cTransX       = 0, cTransY = 0;
  let cBorderRadius = 0;

  /* ── Undo, proporção, escala ──────────────────────────────── */
  let cHistory        = [];
  let cProportional   = false;
  let cRadiusSnapTaken = false;
  /* Resize via scale: filhos escalam junto com o pai */
  let cScaleX  = 1, cScaleY  = 1;
  let cOrigW   = 0, cOrigH   = 0;

  /* ── Save State — registra todas as alterações da sessão ───── */
  const sessionChanges = new Map(); /* selector → { selector, origW, origH, scaleX, scaleY, transX, transY, borderRadius } */

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const cls = Array.from(el.classList).filter(c => !c.startsWith('gsap')).slice(0, 4);
    return cls.length ? '.' + cls.join('.') : el.tagName.toLowerCase();
  }

  function hasCanvasChanges() {
    return cScaleX !== 1 || cScaleY !== 1 || cTransX !== 0 || cTransY !== 0 || cBorderRadius > 0;
  }

  function recordChange() {
    if (!cTarget || !hasCanvasChanges()) return;
    const sel = getSelector(cTarget);
    sessionChanges.set(sel, {
      selector: sel,
      tag: cTarget.tagName.toLowerCase(),
      origW: cOrigW, origH: cOrigH,
      scaleX: cScaleX, scaleY: cScaleY,
      transX: cTransX, transY: cTransY,
      borderRadius: cBorderRadius,
      ts: Date.now(),
    });
    updateStateBtn();
  }

  function updateStateBtn() {
    const n = sessionChanges.size;
    btnState.querySelector('.dr-lbl').textContent = n ? `Estado (${n})` : 'Estado';
    btnState.classList.toggle('dr-active', n > 0);
  }

  /* ══════════════════════════════════════════════════════════════
     LIBS EXTERNAS
  ══════════════════════════════════════════════════════════════ */
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = () => resolve(s); s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  loadScript(GSAP_URL).catch(() => console.warn('[dev-ruler] GSAP não carregou'));
  loadScript(H2C_URL ).catch(() => console.warn('[dev-ruler] html2canvas não carregou'));

  function anim(target, props, dur, ease) {
    if (window.gsap) window.gsap.to(target, { ...props, duration: dur ?? 0.22, ease: ease || 'power2.out' });
    else Object.assign(target.style, props);
  }
  function animSet(target, props) {
    if (window.gsap) window.gsap.set(target, props);
    else Object.assign(target.style, props);
  }

  /* ══════════════════════════════════════════════════════════════
     STORAGE
  ══════════════════════════════════════════════════════════════ */
  function getSchemes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function putSchemes(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

  /* ══════════════════════════════════════════════════════════════
     CANVAS (GRID)
  ══════════════════════════════════════════════════════════════ */
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position:'fixed', inset:'0', width:'100%', height:'100%',
    pointerEvents:'none', zIndex:'8990', display:'none',
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
    position:'fixed', inset:'0', width:'100%', height:'100%',
    objectFit:'contain', zIndex:'8985',
    display:'none', opacity:'0.7', pointerEvents:'none',
    background:'rgba(0,0,0,0.05)',
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
      ? 'rgba(220,100,10,0.95)' : '';
    btnRef.classList.toggle('dr-active', refLoaded && refVisible);
  }

  /* ══════════════════════════════════════════════════════════════
     GUIDE LAYER
  ══════════════════════════════════════════════════════════════ */
  const guideLayer = document.createElement('div');
  Object.assign(guideLayer.style, {
    position:'fixed', inset:'0', pointerEvents:'none',
    zIndex:'9000', display:'none',
  });

  const selPanel = document.createElement('div');
  Object.assign(selPanel.style, {
    position:'fixed', zIndex:'9003', display:'none',
    flexDirection:'column', gap:'7px', alignItems:'center',
    background:'rgba(8,4,28,0.96)', borderRadius:'13px', padding:'9px 11px',
    boxShadow:'0 4px 20px rgba(0,0,0,0.55)',
    border:'1px solid rgba(255,255,255,0.13)',
  });

  const nudgeRow = document.createElement('div');
  Object.assign(nudgeRow.style, { display:'flex', gap:'4px', alignItems:'center' });
  const posLabel = document.createElement('span');
  Object.assign(posLabel.style, {
    color:'#fff', fontFamily:'monospace', fontSize:'12px', fontWeight:'900',
    minWidth:'48px', textAlign:'center',
  });

  function mkSmBtn(txt, bg) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, {
      height:'30px', padding:'0 7px', borderRadius:'7px',
      background: bg || 'rgba(255,255,255,0.12)',
      border:'1px solid rgba(255,255,255,0.16)',
      color:'#fff', fontSize:'11px', fontWeight:'800',
      fontFamily:'monospace', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
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
  Object.assign(selColorRow.style, { display:'flex', gap:'5px' });
  const selSwatches = COLORS.map(c => {
    const sw = document.createElement('button');
    Object.assign(sw.style, {
      width:'20px', height:'20px', borderRadius:'50%',
      background:c.solid, border:'2px solid rgba(255,255,255,0.2)',
      cursor:'pointer', padding:'0',
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

  function selectGuide(g) { selected = g; posLabel.textContent = g.pos + 'px'; refreshSelSwatches(); positionSelPanel(); }
  function deselect()      { selected = null; selPanel.style.display = 'none'; }

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
      position:'absolute', fontSize:'10px', fontFamily:'monospace', fontWeight:'800',
      color:colorDef.solid, background:'rgba(255,255,255,0.92)',
      padding:'1px 5px', borderRadius:'3px',
      whiteSpace:'nowrap', pointerEvents:'none', lineHeight:'1.5',
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

    let t0, p0;
    hit.addEventListener('touchstart', e => { t0 = e.touches[0]; p0 = g.pos; e.stopPropagation(); }, { passive:true });
    hit.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (type === 'h') g.pos = Math.max(0, Math.round(p0 + t.clientY - t0.clientY));
      else              g.pos = Math.max(0, Math.round(p0 + t.clientX - t0.clientX));
      syncGuideDOM(g);
      if (selected === g) { posLabel.textContent = g.pos + 'px'; positionSelPanel(); }
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
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
     TAP LAYER
  ══════════════════════════════════════════════════════════════ */
  const tapLayer = document.createElement('div');
  Object.assign(tapLayer.style, { position:'fixed', inset:'0', zIndex:'8995', display:'none' });
  tapLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    deselect();
    addGuide(addMode, addMode === 'h' ? t.clientY : t.clientX);
    e.preventDefault();
  }, { passive:false });

  /* ══════════════════════════════════════════════════════════════
     MODO CANVAS
  ══════════════════════════════════════════════════════════════ */
  const cSelLayer = document.createElement('div');
  Object.assign(cSelLayer.style, {
    position:'fixed', inset:'0', zIndex:'8996', display:'none',
    background:'transparent', touchAction:'none',
    userSelect:'none', webkitUserSelect:'none',
  });
  cSelLayer.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
  cSelLayer.addEventListener('contextmenu', e => e.preventDefault());

  const cBorderEl = document.createElement('div');
  Object.assign(cBorderEl.style, {
    position:'fixed', display:'none', pointerEvents:'none', zIndex:'9004',
    border:'2px solid rgba(30,210,80,0.95)', borderRadius:'4px',
    background:'rgba(30,210,80,0.04)', boxSizing:'border-box',
    boxShadow:'0 0 0 1px rgba(255,255,255,0.25), 0 4px 18px rgba(0,0,0,0.18)',
  });

  const cDimBadge = document.createElement('div');
  Object.assign(cDimBadge.style, {
    position:'fixed', display:'none', pointerEvents:'none', zIndex:'9004',
    background:'rgba(20,180,60,0.97)', color:'#fff',
    fontFamily:'monospace', fontSize:'12px', fontWeight:'900',
    padding:'3px 9px', borderRadius:'5px', whiteSpace:'nowrap',
  });

  const handles = {};
  Object.keys(HCONF).forEach(id => {
    const cfg = HCONF[id];
    const h = document.createElement('div');
    Object.assign(h.style, {
      position:'fixed', display:'none', zIndex:'9005',
      background:'rgba(255,255,255,0.97)',
      border:'2px solid rgba(20,180,60,0.95)',
      borderRadius:'5px', cursor:cfg.cursor,
      width:cfg.size[0]+'px', height:cfg.size[1]+'px',
      boxSizing:'border-box', touchAction:'none',
      boxShadow:'0 2px 6px rgba(0,0,0,0.28)',
    });
    handles[id] = h;
  });

  const moveHandle = document.createElement('div');
  Object.assign(moveHandle.style, {
    position:'fixed', display:'none', zIndex:'9005',
    width:'40px', height:'40px',
    background:'rgba(20,180,60,0.97)',
    border:'2.5px solid rgba(255,255,255,0.9)',
    borderRadius:'50%', cursor:'move',
    boxSizing:'border-box', touchAction:'none',
    alignItems:'center', justifyContent:'center',
    color:'#fff', fontSize:'18px', fontWeight:'900',
    boxShadow:'0 3px 12px rgba(0,0,0,0.38)',
  });
  moveHandle.textContent = '✥';

  /* Linhas de distância */
  function mkDistLine() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { position:'fixed', display:'none', pointerEvents:'none', zIndex:'9003' });
    const line = document.createElement('div');
    Object.assign(line.style, { position:'absolute', background:'rgba(255,140,0,0.88)', boxShadow:'0 0 4px rgba(255,140,0,0.5)' });
    const label = document.createElement('span');
    Object.assign(label.style, {
      position:'absolute', background:'rgba(255,140,0,0.97)', color:'#fff',
      fontFamily:'monospace', fontSize:'10px', fontWeight:'900',
      padding:'2px 6px', borderRadius:'4px', whiteSpace:'nowrap',
      transform:'translate(-50%, -50%)',
    });
    wrap.append(line, label);
    return { wrap, line, label };
  }
  const distT = mkDistLine(), distB = mkDistLine();
  const distL = mkDistLine(), distR = mkDistLine();

  /* ── Snapshot helpers ─────────────────────────────────────── */
  function applyTransform() {
    if (!cTarget) return;
    cTarget.style.transformOrigin = '0 0';
    cTarget.style.transform =
      `translate(${cTransX}px, ${cTransY}px) scale(${cScaleX}, ${cScaleY})`;
  }

  function pushCSnapshot() {
    if (!cTarget) return;
    cHistory.push({
      transform: cTarget.style.transform,
      transformOrigin: cTarget.style.transformOrigin,
      borderRadius: cTarget.style.borderRadius,
      transX: cTransX, transY: cTransY,
      scaleX: cScaleX, scaleY: cScaleY,
      br: cBorderRadius,
    });
    if (cHistory.length > 30) cHistory.shift();
    updateUndoBtn();
  }

  function undoCanvasChange() {
    if (!cTarget || !cHistory.length) return;
    const snap = cHistory.pop();
    cTarget.style.transform       = snap.transform;
    cTarget.style.transformOrigin = snap.transformOrigin;
    cTarget.style.borderRadius    = snap.borderRadius;
    cTransX = snap.transX; cTransY = snap.transY;
    cScaleX = snap.scaleX; cScaleY = snap.scaleY;
    cBorderRadius = snap.br;
    radiusSlider.value = Math.min(80, cBorderRadius);
    radiusVal.textContent = cBorderRadius + 'px';
    updateCanvasUI();
    updateUndoBtn();
    flash('↩ desfeito');
  }

  function updateUndoBtn() {
    cBtnUndo.style.opacity = cHistory.length ? '1' : '0.35';
  }

  /* ── Painel do elemento ───────────────────────────────────── */
  const cPanel = document.createElement('div');
  Object.assign(cPanel.style, {
    position:'fixed', zIndex:'9006', display:'none',
    flexDirection:'column', gap:'6px',
    background:'rgba(8,4,28,0.97)',
    borderRadius:'14px', padding:'10px 12px',
    boxShadow:'0 6px 24px rgba(0,0,0,0.6)',
    border:'1px solid rgba(255,255,255,0.14)',
    left:'8px', right:'8px',
    bottom:'140px',
    maxWidth:'520px', margin:'0 auto',
  });

  const cClassName = document.createElement('div');
  Object.assign(cClassName.style, {
    color:'rgba(30,210,80,0.95)', fontFamily:'monospace',
    fontSize:'11px', fontWeight:'900', letterSpacing:'.4px',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    cursor:'move', touchAction:'none', paddingBottom:'2px',
    borderBottom:'1px solid rgba(255,255,255,0.08)',
  });
  /* Drag do painel */
  (function setupCPanelDrag() {
    let startTouch = null, startLeft = 0, startTop = 0;
    cClassName.addEventListener('touchstart', e => {
      startTouch = e.touches[0];
      const r = cPanel.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
      e.stopPropagation();
    }, { passive:true });
    cClassName.addEventListener('touchmove', e => {
      if (!startTouch) return;
      const t = e.touches[0];
      cPanel.style.left   = Math.max(4, Math.min(window.innerWidth  - cPanel.offsetWidth  - 4, startLeft + (t.clientX - startTouch.clientX))) + 'px';
      cPanel.style.top    = Math.max(4, Math.min(window.innerHeight - cPanel.offsetHeight - 4, startTop  + (t.clientY - startTouch.clientY))) + 'px';
      cPanel.style.right  = 'auto'; cPanel.style.bottom = 'auto'; cPanel.style.margin = '0';
      cPanelManualPos = true;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    cClassName.addEventListener('touchend', e => { startTouch = null; e.stopPropagation(); });
  })();

  function mkValueChip(label) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display:'flex', gap:'3px', alignItems:'center' });
    const lbl = document.createElement('span');
    lbl.textContent = label;
    Object.assign(lbl.style, { color:'rgba(255,255,255,0.45)', fontFamily:'monospace', fontSize:'9px', minWidth:'10px' });
    const val = document.createElement('span');
    Object.assign(val.style, { color:'#fff', fontFamily:'monospace', fontSize:'11px', fontWeight:'900', minWidth:'42px' });
    const copy = document.createElement('button');
    copy.textContent = '📋';
    Object.assign(copy.style, {
      background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
      borderRadius:'4px', padding:'2px 5px', cursor:'pointer', fontSize:'10px',
    });
    copy.addEventListener('click', () => { copyToClipboard(val.textContent); copy.textContent = '✓'; setTimeout(() => copy.textContent = '📋', 1100); });
    wrap.append(lbl, val, copy);
    return { wrap, val, copy };
  }

  const valRow1 = document.createElement('div');
  Object.assign(valRow1.style, { display:'flex', gap:'7px', flexWrap:'wrap' });
  const chipW = mkValueChip('W'); const chipH = mkValueChip('H');
  const chipX = mkValueChip('X'); const chipY = mkValueChip('Y');
  valRow1.append(chipW.wrap, chipH.wrap, chipX.wrap, chipY.wrap);

  /* Slider border-radius */
  const radiusRow = document.createElement('div');
  Object.assign(radiusRow.style, { display:'flex', gap:'7px', alignItems:'center' });
  const radiusLbl = document.createElement('span');
  radiusLbl.textContent = '◖';
  Object.assign(radiusLbl.style, { color:'rgba(255,255,255,0.45)', fontSize:'13px' });
  const radiusSlider = document.createElement('input');
  radiusSlider.type = 'range'; radiusSlider.min = '0'; radiusSlider.max = '80'; radiusSlider.value = '0';
  Object.assign(radiusSlider.style, { flex:'1', accentColor:'rgb(30,210,80)' });
  const radiusVal = document.createElement('span');
  Object.assign(radiusVal.style, { color:'#fff', fontFamily:'monospace', fontSize:'11px', fontWeight:'900', minWidth:'38px' });
  radiusVal.textContent = '0px';
  const radiusCopy = document.createElement('button');
  radiusCopy.textContent = '📋';
  Object.assign(radiusCopy.style, { background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'5px', padding:'3px 6px', cursor:'pointer', fontSize:'10px' });
  radiusSlider.addEventListener('touchstart', () => {
    if (!cRadiusSnapTaken) { pushCSnapshot(); cRadiusSnapTaken = true; }
  }, { passive:true });
  radiusSlider.addEventListener('touchend', () => { cRadiusSnapTaken = false; });
  radiusSlider.addEventListener('input', () => {
    if (!cTarget) return;
    cBorderRadius = +radiusSlider.value;
    cTarget.style.borderRadius = cBorderRadius + 'px';
    radiusVal.textContent = cBorderRadius + 'px';
  });
  radiusCopy.addEventListener('click', () => { copyToClipboard(radiusVal.textContent); radiusCopy.textContent = '✓'; setTimeout(() => radiusCopy.textContent = '📋', 1100); });
  radiusRow.append(radiusLbl, radiusSlider, radiusVal, radiusCopy);

  /* Botões inferiores do painel */
  const cBtnRow = document.createElement('div');
  Object.assign(cBtnRow.style, { display:'flex', gap:'5px', paddingTop:'2px' });
  function mkCBtn(txt, bg, minW) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, {
      flex: minW ? '0 0 auto' : '1',
      minWidth: minW || '0',
      padding:'6px 8px', borderRadius:'8px',
      background:bg, border:'none', color:'#fff',
      fontFamily:'monospace', fontSize:'10px', fontWeight:'700', cursor:'pointer',
    });
    return b;
  }
  const cBtnUndo    = mkCBtn('↩', 'rgba(140,30,200,0.75)', '36px');
  const cBtnLock    = mkCBtn('🔓', 'rgba(255,255,255,0.1)', '36px');
  const cBtnParent  = mkCBtn('⬆', 'rgba(255,255,255,0.1)', '36px');
  const cBtnCopyAll = mkCBtn('📋 CSS', 'rgba(30,100,255,0.85)');
  const cBtnRevert  = mkCBtn('↺ Orig', 'rgba(200,30,30,0.65)');
  const cBtnOk      = mkCBtn('✓', 'rgba(30,160,30,0.75)', '36px');
  cBtnRow.append(cBtnUndo, cBtnLock, cBtnParent, cBtnCopyAll, cBtnRevert, cBtnOk);

  updateUndoBtn();

  cBtnUndo.addEventListener('click', undoCanvasChange);

  cBtnLock.addEventListener('click', () => {
    cProportional = !cProportional;
    cBtnLock.textContent = cProportional ? '🔒' : '🔓';
    cBtnLock.style.background = cProportional ? 'rgba(255,200,0,0.3)' : 'rgba(255,255,255,0.1)';
  });

  cBtnParent.addEventListener('click', () => {
    if (!cTarget) return;
    let par = cTarget.parentElement;
    /* sobe ignorando os próprios nós da ferramenta */
    while (par && (par === document.body || par === document.documentElement || par.closest('[data-ruler]'))) {
      par = par.parentElement;
    }
    if (!par) { flash('já está no topo'); return; }
    selectCanvasElement(par, false);
    if (window.gsap) {
      window.gsap.fromTo(cBorderEl, { scale:1.06 }, { scale:1, duration:0.18, ease:'power2.out' });
    }
  });

  function copyToClipboard(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
    else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    const inp = document.createElement('input');
    inp.value = txt; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy'); inp.remove();
  }

  cBtnCopyAll.addEventListener('click', () => {
    if (!cTarget) return;
    const rect = cTarget.getBoundingClientRect();
    const lines = [
      `/* tamanho visual final */`,
      `width: ${Math.round(rect.width)}px;`,
      `height: ${Math.round(rect.height)}px;`,
    ];
    if (cScaleX !== 1 || cScaleY !== 1)
      lines.push(`transform: scale(${+cScaleX.toFixed(3)}, ${+cScaleY.toFixed(3)});`);
    if (cTransX || cTransY)
      lines.push(`transform: translate(${Math.round(cTransX)}px, ${Math.round(cTransY)}px);`);
    if (cBorderRadius) lines.push(`border-radius: ${cBorderRadius}px;`);
    copyToClipboard(lines.join('\n'));
    cBtnCopyAll.textContent = '✓ copiado';
    setTimeout(() => cBtnCopyAll.textContent = '📋 CSS', 1400);
  });
  cBtnRevert.addEventListener('click', () => {
    if (!cTarget) return;
    cTarget.style.transform       = cOrigStyles.transform;
    cTarget.style.transformOrigin = cOrigStyles.transformOrigin || '';
    cTarget.style.borderRadius    = cOrigStyles.borderRadius;
    cTransX = 0; cTransY = 0; cScaleX = 1; cScaleY = 1;
    cBorderRadius = parseInt(cOrigStyles.borderRadius) || 0;
    radiusSlider.value = cBorderRadius;
    radiusVal.textContent = cBorderRadius + 'px';
    cHistory = []; updateUndoBtn();
    updateCanvasUI();
  });
  cBtnOk.addEventListener('click', () => { recordChange(); clearCanvasSelection(); });

  cPanel.append(cClassName, valRow1, radiusRow, cBtnRow);

  /* ── updateCanvasUI ───────────────────────────────────────── */
  function updateCanvasUI() {
    if (!cTarget) return;
    const rect = cTarget.getBoundingClientRect();
    Object.assign(cBorderEl.style, {
      display:'block',
      left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
    });
    const badgeY = rect.top > 28 ? rect.top - 24 : rect.bottom + 6;
    Object.assign(cDimBadge.style, { display:'block', left: rect.left + 'px', top: badgeY + 'px' });
    cDimBadge.textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px';

    Object.keys(HCONF).forEach(id => {
      const cfg = HCONF[id], [w, h] = cfg.size;
      let x = cfg.x === -1 ? rect.left - w/2 : cfg.x === 1 ? rect.right - w/2 : rect.left + (rect.width - w) / 2;
      let y = cfg.y === -1 ? rect.top  - h/2 : cfg.y === 1 ? rect.bottom - h/2 : rect.top + (rect.height - h) / 2;
      Object.assign(handles[id].style, { display:'flex', left: x + 'px', top: y + 'px' });
    });
    Object.assign(moveHandle.style, {
      display:'flex',
      left: (rect.left + (rect.width  - 40) / 2) + 'px',
      top:  (rect.top  + (rect.height - 40) / 2) + 'px',
    });
    chipW.val.textContent = Math.round(rect.width)  + 'px';
    chipH.val.textContent = Math.round(rect.height) + 'px';
    chipX.val.textContent = Math.round(cTransX)     + 'px';
    chipY.val.textContent = Math.round(cTransY)     + 'px';
    updateDistRuler();
  }

  function updateDistRuler() {
    const arr = [distT, distB, distL, distR];
    if (!distRulerOn || !cTarget) { arr.forEach(d => d.wrap.style.display = 'none'); return; }
    const r = cTarget.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    Object.assign(distT.wrap.style, { display:'block', left:cx+'px', top:'0', width:'1px', height:r.top+'px' });
    Object.assign(distT.line.style, { left:'0', top:'0', width:'1px', height:'100%' });
    Object.assign(distT.label.style, { left:'8px', top:(r.top/2)+'px', transform:'translate(0,-50%)' });
    distT.label.textContent = Math.round(r.top) + 'px';
    Object.assign(distB.wrap.style, { display:'block', left:cx+'px', top:r.bottom+'px', width:'1px', height:(H-r.bottom)+'px' });
    Object.assign(distB.line.style, { left:'0', top:'0', width:'1px', height:'100%' });
    Object.assign(distB.label.style, { left:'8px', top:((H-r.bottom)/2)+'px', transform:'translate(0,-50%)' });
    distB.label.textContent = Math.round(H - r.bottom) + 'px';
    Object.assign(distL.wrap.style, { display:'block', left:'0', top:cy+'px', width:r.left+'px', height:'1px' });
    Object.assign(distL.line.style, { left:'0', top:'0', height:'1px', width:'100%' });
    Object.assign(distL.label.style, { top:'-8px', left:(r.left/2)+'px', transform:'translate(-50%,-100%)' });
    distL.label.textContent = Math.round(r.left) + 'px';
    Object.assign(distR.wrap.style, { display:'block', left:r.right+'px', top:cy+'px', width:(W-r.right)+'px', height:'1px' });
    Object.assign(distR.line.style, { left:'0', top:'0', height:'1px', width:'100%' });
    Object.assign(distR.label.style, { top:'-8px', left:((W-r.right)/2)+'px', transform:'translate(-50%,-100%)' });
    distR.label.textContent = Math.round(W - r.right) + 'px';
  }

  /* ── 8 handles resize ─────────────────────────────────────── */
  function setupHandleDrag(handleEl, id) {
    const cfg = HCONF[id];
    let startTouch = null, startRect = null;
    let startTransX = 0, startTransY = 0;
    let snapTaken = false;

    handleEl.addEventListener('touchstart', e => {
      if (!cTarget) return;
      startTouch  = e.touches[0];
      startRect   = cTarget.getBoundingClientRect();
      startTransX = cTransX; startTransY = cTransY;
      snapTaken   = false;
      e.stopPropagation();
    }, { passive:true });

    handleEl.addEventListener('touchmove', e => {
      if (!cTarget || !startTouch || !startRect) return;
      if (!snapTaken) { pushCSnapshot(); snapTaken = true; }
      const t  = e.touches[0];
      const dx = t.clientX - startTouch.clientX;
      const dy = t.clientY - startTouch.clientY;

      /* Dimensão visual no início do drag (inclui escala atual) */
      const vW = startRect.width, vH = startRect.height;

      let newW = vW, newH = vH;
      let newTX = startTransX, newTY = startTransY;

      if (cfg.x ===  1) newW = Math.max(20, vW + dx);
      if (cfg.x === -1) { newW = Math.max(20, vW - dx); newTX = startTransX + (vW - newW); }
      if (cfg.y ===  1) newH = Math.max(20, vH + dy);
      if (cfg.y === -1) { newH = Math.max(20, vH - dy); newTY = startTransY + (vH - newH); }

      /* ── Cadeado proporcional ── */
      if (cProportional && vW > 0 && vH > 0) {
        const ratio = vW / vH;
        if (cfg.x !== 0 && cfg.y !== 0) {
          if (Math.abs(dx) >= Math.abs(dy)) { newH = newW / ratio; if (cfg.y === -1) newTY = startTransY + (vH - newH); }
          else { newW = newH * ratio; if (cfg.x === -1) newTX = startTransX + (vW - newW); }
        } else if (cfg.x !== 0) {
          newH = newW / ratio;
          if (cfg.y === -1) newTY = startTransY + (vH - newH);
        } else if (cfg.y !== 0) {
          newW = newH * ratio;
          if (cfg.x === -1) newTX = startTransX + (vW - newW);
        }
      }

      /* Resize via scale: os filhos escalam junto com o pai.
         cOrigW/cOrigH = tamanho natural do elemento (sem qualquer scale).
         Calcula a escala necessária para que o visual fique newW × newH. */
      cScaleX = newW / cOrigW;
      cScaleY = newH / cOrigH;
      cTransX = newTX; cTransY = newTY;
      applyTransform();
      updateCanvasUI();
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handleEl.addEventListener('touchend', e => { snapTaken = false; e.stopPropagation(); });
  }
  Object.keys(handles).forEach(id => setupHandleDrag(handles[id], id));

  /* ── Move handle ──────────────────────────────────────────── */
  (function setupMoveDrag() {
    let startTouch = null, startTX = 0, startTY = 0, snapTaken = false;
    moveHandle.addEventListener('touchstart', e => {
      if (!cTarget) return;
      startTouch = e.touches[0]; startTX = cTransX; startTY = cTransY; snapTaken = false;
      e.stopPropagation();
    }, { passive:true });
    moveHandle.addEventListener('touchmove', e => {
      if (!cTarget || !startTouch) return;
      if (!snapTaken) { pushCSnapshot(); snapTaken = true; }
      const t = e.touches[0];
      cTransX = startTX + (t.clientX - startTouch.clientX);
      cTransY = startTY + (t.clientY - startTouch.clientY);
      applyTransform();
      updateCanvasUI();
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    moveHandle.addEventListener('touchend', e => { snapTaken = false; e.stopPropagation(); });
  })();

  /* ── Posicionamento inteligente do painel ─────────────────── */
  function positionCPanel() {
    if (!cTarget || cPanelManualPos) return;
    const rect = cTarget.getBoundingClientRect();
    const H = window.innerHeight;
    cPanel.style.visibility = 'hidden'; cPanel.style.display = 'flex';
    const pH = cPanel.offsetHeight || 160;
    cPanel.style.visibility = '';
    cPanel.style.left = '8px'; cPanel.style.right = '8px';
    cPanel.style.maxWidth = '520px'; cPanel.style.margin = '0 auto';
    if ((rect.top + rect.height / 2) > H * 0.55) {
      cPanel.style.top = '46px'; cPanel.style.bottom = 'auto';
    } else {
      cPanel.style.bottom = '140px'; cPanel.style.top = 'auto';
    }
  }

  /* ── Seleção de elemento ──────────────────────────────────── */
  /* ── Seleciona um elemento no canvas mode ─────────────────── */
  function selectCanvasElement(el, animate) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.closest('#dev-ruler-btn') || el.closest('[data-ruler]')) return false;
    recordChange(); /* grava alterações do elemento anterior antes de trocar */

    clearCanvasSelection();
    cTarget = el;
    cOrigStyles = {
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
      borderRadius: el.style.borderRadius,
    };
    cTransX = 0; cTransY = 0;
    cScaleX = 1; cScaleY = 1;
    /* tamanho natural do elemento ANTES de qualquer scale da ferramenta */
    const natRect = el.getBoundingClientRect();
    cOrigW = natRect.width; cOrigH = natRect.height;
    cHistory = []; updateUndoBtn();
    cPanelManualPos = false;
    const computed = getComputedStyle(el);
    cBorderRadius = parseInt(computed.borderTopLeftRadius) || 0;
    radiusSlider.value = Math.min(80, cBorderRadius);
    radiusVal.textContent = cBorderRadius + 'px';
    const classes = Array.from(el.classList).slice(0, 3).join(' .');
    cClassName.textContent = (classes ? '.' + classes : el.tagName.toLowerCase()) + '  ⠿';

    /* Atualiza botão ⬆: desabilita se não tem pai válido */
    const par = el.parentElement;
    const hasParent = par && par !== document.body && par !== document.documentElement && !par.closest('[data-ruler]');
    cBtnParent.style.opacity = hasParent ? '1' : '0.25';

    updateCanvasUI();
    positionCPanel();
    cPanel.style.display = 'flex';
    if (animate && window.gsap) {
      window.gsap.fromTo(cPanel, { y:24, opacity:0 }, { y:0, opacity:1, duration:0.22, ease:'power2.out' });
      window.gsap.fromTo([cBorderEl, ...Object.values(handles), moveHandle],
        { scale:0.6, opacity:0 }, { scale:1, opacity:1, duration:0.2, ease:'back.out(2)', stagger:0.015 });
    } else if (animate && !window.gsap) {
      /* fallback sem GSAP: pisca a borda */
      cBorderEl.style.opacity = '0.3';
      setTimeout(() => { cBorderEl.style.opacity = '1'; }, 120);
    }
    return true;
  }

  cSelLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    cSelLayer.style.pointerEvents = 'none';
    const el = document.elementFromPoint(t.clientX, t.clientY);
    cSelLayer.style.pointerEvents = 'auto';
    selectCanvasElement(el, true);
    e.preventDefault();
  }, { passive:false });

  function clearCanvasSelection() {
    cTarget = null;
    cBorderEl.style.display = 'none';
    cDimBadge.style.display = 'none';
    Object.values(handles).forEach(h => h.style.display = 'none');
    moveHandle.style.display = 'none';
    cPanel.style.display = 'none';
    [distT, distB, distL, distR].forEach(d => d.wrap.style.display = 'none');
  }

  function setCanvasMode(on) {
    canvasMode = on;
    cSelLayer.style.display = on ? 'block' : 'none';
    tapLayer.style.display  = on ? 'none'  : (toolActive ? 'block' : 'none');
    if (!on) clearCanvasSelection();
    btnCanvas.classList.toggle('dr-active', on);
    document.body.style.userSelect = on ? 'none' : '';
    document.body.style.webkitUserSelect = on ? 'none' : '';
    document.body.style.webkitTouchCallout = on ? 'none' : '';
  }

  function setDistRuler(on) {
    distRulerOn = on;
    btnDist.classList.toggle('dr-active', on);
    updateDistRuler();
  }

  /* ══════════════════════════════════════════════════════════════
     SCREENSHOT
  ══════════════════════════════════════════════════════════════ */
  async function takeScreenshot() {
    if (!window.html2canvas) { flash('html2canvas ainda carregando…'); return; }
    const rulerNodes = document.querySelectorAll('[data-ruler]');
    const prevDisplay = [];
    rulerNodes.forEach(n => { prevDisplay.push(n.style.display); n.style.display = 'none'; });
    canvas.style.display = 'none'; guideLayer.style.display = 'none';
    await new Promise(r => requestAnimationFrame(r));
    try {
      const cnv = await window.html2canvas(document.body, {
        backgroundColor:'#ffffff', scale:2, useCORS:true,
        windowWidth:window.innerWidth, windowHeight:window.innerHeight,
        x:0, y:window.scrollY, width:window.innerWidth, height:window.innerHeight,
      });
      cnv.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `dev-ruler-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        flash('📸 screenshot salva!');
      }, 'image/png');
    } catch (err) { console.error(err); flash('Erro ao capturar tela'); }
    rulerNodes.forEach((n, i) => n.style.display = prevDisplay[i]);
    if (toolActive) { canvas.style.display = 'block'; guideLayer.style.display = 'block'; }
  }

  /* Toast */
  const toast = document.createElement('div');
  toast.setAttribute('data-ruler', '1');
  Object.assign(toast.style, {
    position:'fixed', bottom:'42px', left:'50%', transform:'translateX(-50%)',
    background:'rgba(8,4,28,0.96)', color:'#fff',
    fontFamily:'monospace', fontSize:'12px', fontWeight:'800',
    padding:'9px 14px', borderRadius:'9px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
    border:'1px solid rgba(255,255,255,0.16)',
    zIndex:'9020', display:'none', whiteSpace:'nowrap',
  });
  function flash(msg) {
    toast.textContent = msg; toast.style.display = 'block';
    if (window.gsap) window.gsap.fromTo(toast, { y:14, opacity:0 }, { y:0, opacity:1, duration:0.2 });
    clearTimeout(flash._t);
    flash._t = setTimeout(() => {
      if (window.gsap) {
        window.gsap.to(toast, { opacity:0, y:14, duration:0.2,
          onComplete: () => { toast.style.display = 'none'; toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%)'; } });
      } else { toast.style.display = 'none'; }
    }, 1600);
  }

  /* Wide view */
  function setWideView(on) {
    wideViewOn = on;
    [panel, toggleBtn, cPanel, selPanel].forEach(el => { el.style.opacity = on ? '0.06' : ''; });
    btnWide.classList.toggle('dr-active', on);
  }

  /* ══════════════════════════════════════════════════════════════
     MODAL SAVE / LOAD
  ══════════════════════════════════════════════════════════════ */
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,0.68)',
    zIndex:'9010', display:'none', alignItems:'center', justifyContent:'center',
  });
  const mBox = document.createElement('div');
  Object.assign(mBox.style, {
    background:'rgba(10,5,32,0.98)', border:'1px solid rgba(255,255,255,0.14)',
    borderRadius:'16px', padding:'18px', width:'268px', maxWidth:'88vw',
    color:'#fff', fontFamily:'monospace',
    display:'flex', flexDirection:'column', gap:'10px',
    boxShadow:'0 6px 28px rgba(0,0,0,0.65)',
  });
  const mTitle  = document.createElement('div');
  Object.assign(mTitle.style, { fontWeight:'900', fontSize:'12px', letterSpacing:'.8px', color:'rgba(255,255,255,0.6)' });
  const mInput  = document.createElement('input');
  Object.assign(mInput.style, {
    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.18)',
    borderRadius:'8px', padding:'8px 11px', color:'#fff', fontSize:'13px',
    fontFamily:'monospace', outline:'none', width:'100%', boxSizing:'border-box',
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
    const s = getSchemes(); s[name] = guides.map(g => ({ type:g.type, pos:g.pos, colorId:g.colorDef.id }));
    putSchemes(s); modal.style.display = 'none'; flash('💾 esquema salvo');
  });
  mActions.append(mCancel, mSaveOK);
  mBox.append(mTitle, mInput, mList, mActions);
  modal.appendChild(mBox);
  modal.addEventListener('touchend', e => { if (e.target === modal) modal.style.display = 'none'; });
  function openModal(mode) {
    mTitle.textContent = mode === 'save' ? 'SALVAR ESQUEMA' : 'CARREGAR ESQUEMA';
    mInput.style.display = mode === 'save' ? 'block' : 'none';
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
            modal.style.display = 'none'; flash('📂 esquema carregado');
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
     SAVE STATE — exportar para Claude
  ══════════════════════════════════════════════════════════════ */
  function buildStateText() {
    const entries = Array.from(sessionChanges.values());
    if (!entries.length) return null;
    const now = new Date().toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
    const lines = [
      '╔══════════════════════════════════════════╗',
      '║   DevRuler — Save State para Claude     ║',
      '╚══════════════════════════════════════════╝',
      `Data: ${now}`,
      `Total de alterações: ${entries.length}`,
      '',
    ];
    entries.forEach((r, i) => {
      const vW = Math.round(r.origW * r.scaleX);
      const vH = Math.round(r.origH * r.scaleY);
      const sx  = +r.scaleX.toFixed(4), sy = +r.scaleY.toFixed(4);
      lines.push(`━━━ [${i+1}] ${r.selector} ━━━`);
      lines.push(`  Original : ${Math.round(r.origW)} × ${Math.round(r.origH)} px`);
      lines.push(`  Visual   : ${vW} × ${vH} px`);
      if (sx !== 1 || sy !== 1) lines.push(`  Scale    : ${sx} × ${sy}`);
      if (r.transX || r.transY)
        lines.push(`  Translate: X ${Math.round(r.transX)}px  Y ${Math.round(r.transY)}px`);
      if (r.borderRadius) lines.push(`  Radius   : ${r.borderRadius}px`);
      lines.push('');
      lines.push('  CSS sugerido:');
      if (sx !== 1 || sy !== 1)
        lines.push(`    transform: scale(${sx}, ${sy});`);
      if (r.transX || r.transY)
        lines.push(`    transform: translate(${Math.round(r.transX)}px, ${Math.round(r.transY)}px);`);
      if (r.borderRadius) lines.push(`    border-radius: ${r.borderRadius}px;`);
      lines.push('');
    });
    lines.push('══════════════════════════════════════════');
    lines.push('Cole este bloco no chat com o Claude para');
    lines.push('aplicar as alterações no CSS do projeto.');
    return lines.join('\n');
  }

  /* Modal de Save State */
  const stateModal = document.createElement('div');
  stateModal.setAttribute('data-ruler', '1');
  Object.assign(stateModal.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,0.72)',
    zIndex:'9011', display:'none', alignItems:'flex-end', justifyContent:'center',
  });
  const stateBox = document.createElement('div');
  stateBox.setAttribute('data-ruler', '1');
  Object.assign(stateBox.style, {
    background:'rgba(8,4,28,0.99)', border:'1px solid rgba(255,255,255,0.14)',
    borderRadius:'18px 18px 0 0', padding:'18px 16px 32px',
    width:'100%', maxWidth:'520px',
    color:'#fff', fontFamily:'monospace',
    display:'flex', flexDirection:'column', gap:'10px',
    boxShadow:'0 -6px 32px rgba(0,0,0,0.7)',
    maxHeight:'75vh',
  });

  const stateTitle = document.createElement('div');
  Object.assign(stateTitle.style, {
    fontWeight:'900', fontSize:'13px', letterSpacing:'.6px',
    color:'rgba(255,255,255,0.75)', paddingBottom:'6px',
    borderBottom:'1px solid rgba(255,255,255,0.1)',
    display:'flex', justifyContent:'space-between', alignItems:'center',
  });
  const stateTitleLeft = document.createElement('span');
  stateTitleLeft.textContent = '🗂 Save State';
  const stateClear = document.createElement('button');
  stateClear.textContent = '✕ Limpar tudo';
  Object.assign(stateClear.style, {
    background:'rgba(200,30,30,0.5)', border:'none', color:'#fff',
    borderRadius:'6px', padding:'4px 10px', fontSize:'10px',
    fontFamily:'monospace', cursor:'pointer', fontWeight:'700',
  });
  stateTitle.append(stateTitleLeft, stateClear);

  const stateTextArea = document.createElement('textarea');
  Object.assign(stateTextArea.style, {
    background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
    borderRadius:'10px', padding:'12px', color:'rgba(255,255,255,0.85)',
    fontFamily:'monospace', fontSize:'11px', lineHeight:'1.6',
    flex:'1', resize:'none', outline:'none', minHeight:'200px',
    overflowY:'auto',
  });
  stateTextArea.readOnly = true;

  const stateEmpty = document.createElement('div');
  Object.assign(stateEmpty.style, {
    color:'rgba(255,255,255,0.3)', fontSize:'12px', textAlign:'center',
    padding:'32px 0', display:'none',
  });
  stateEmpty.textContent = 'Nenhuma alteração salva ainda.\nFaça mudanças no Canvas Mode e clique ✓ OK.';

  const stateBtnRow = document.createElement('div');
  Object.assign(stateBtnRow.style, { display:'flex', gap:'8px' });

  const stateBtnSync = document.createElement('button');
  stateBtnSync.textContent = '☁ Enviar ao Claude';
  Object.assign(stateBtnSync.style, {
    flex:'2', padding:'12px', borderRadius:'10px',
    background:'rgba(6,182,212,0.9)', border:'none', color:'#000',
    fontFamily:'monospace', fontSize:'12px', fontWeight:'900', cursor:'pointer',
  });

  const stateBtnCopy = document.createElement('button');
  stateBtnCopy.textContent = '📋 Copiar';
  Object.assign(stateBtnCopy.style, {
    flex:'1', padding:'12px', borderRadius:'10px',
    background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
    color:'#fff', fontFamily:'monospace', fontSize:'12px', fontWeight:'700', cursor:'pointer',
  });

  const stateBtnClose = document.createElement('button');
  stateBtnClose.textContent = '✓';
  Object.assign(stateBtnClose.style, {
    padding:'12px 16px', borderRadius:'10px',
    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
    color:'rgba(255,255,255,0.6)', fontFamily:'monospace', fontSize:'12px', cursor:'pointer',
  });

  stateBtnRow.append(stateBtnSync, stateBtnCopy, stateBtnClose);
  stateBox.append(stateTitle, stateTextArea, stateEmpty, stateBtnRow);
  stateModal.appendChild(stateBox);
  stateModal.addEventListener('touchend', e => { if (e.target === stateModal) stateModal.style.display = 'none'; });

  async function syncToFirestore() {
    const entries = Array.from(sessionChanges.values());
    const text = buildStateText();
    if (!entries.length) return false;
    const PROJ = 'adegas-pf';
    const KEY  = 'AIzaSyCT3BGvNWRzoOc3mT4lDRRfz6GISptkUzc';
    const url  = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents/devtools/savestate?key=${KEY}`;
    try {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            text:        { stringValue: text || '' },
            entriesJson: { stringValue: JSON.stringify(entries) },
            ts:          { integerValue: String(Date.now()) },
          }
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return true;
    } catch (e) {
      console.error('[DevRuler] sync erro:', e);
      return false;
    }
  }

  function openStateModal() {
    recordChange(); /* garante que elemento atual está salvo */
    const txt = buildStateText();
    if (txt) {
      stateTextArea.value = txt;
      stateTextArea.style.display = 'block';
      stateEmpty.style.display = 'none';
    } else {
      stateTextArea.style.display = 'none';
      stateEmpty.style.display = 'block';
    }
    stateModal.style.display = 'flex';
    if (window.gsap) {
      window.gsap.fromTo(stateBox, { y: 60, opacity:0 }, { y:0, opacity:1, duration:0.28, ease:'power3.out' });
    }
  }

  stateBtnSync.addEventListener('click', async () => {
    if (!sessionChanges.size) { flash('nenhuma alteração para enviar'); return; }
    stateBtnSync.textContent = '⏳ Enviando...';
    stateBtnSync.disabled = true;
    const ok = await syncToFirestore();
    stateBtnSync.textContent = ok ? '✓ Enviado!' : '✗ Erro — tente copiar';
    stateBtnSync.style.background = ok ? 'rgba(5,150,105,0.9)' : 'rgba(180,30,30,0.9)';
    stateBtnSync.style.color = '#fff';
    setTimeout(() => {
      stateBtnSync.textContent = '☁ Enviar ao Claude';
      stateBtnSync.style.background = 'rgba(6,182,212,0.9)';
      stateBtnSync.style.color = '#000';
      stateBtnSync.disabled = false;
    }, 2500);
  });

  stateBtnCopy.addEventListener('click', () => {
    const txt = stateTextArea.value;
    if (!txt) return;
    copyToClipboard(txt);
    stateBtnCopy.textContent = '✓ Copiado!';
    setTimeout(() => stateBtnCopy.textContent = '📋 Copiar', 1800);
  });
  stateBtnClose.addEventListener('click', () => { stateModal.style.display = 'none'; });
  stateClear.addEventListener('click', () => {
    sessionChanges.clear();
    updateStateBtn();
    stateModal.style.display = 'none';
    flash('🗂 estado limpo');
  });

  /* ══════════════════════════════════════════════════════════════
     ESTILOS GLOBAIS DA FERRAMENTA
  ══════════════════════════════════════════════════════════════ */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .dr-toolbar { all: unset; }
    .dr-btn {
      display: inline-flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px; min-width: 44px; height: 44px;
      padding: 0 6px; border-radius: 10px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff; cursor: pointer;
      font-family: monospace; font-size: 15px;
      box-sizing: border-box; white-space: nowrap;
      transition: background 0.15s;
    }
    .dr-btn:active { transform: scale(0.93); }
    .dr-btn .dr-lbl {
      font-size: 8px; font-weight: 700; letter-spacing: .3px;
      opacity: 0.65; line-height: 1; font-family: monospace;
      text-transform: uppercase;
    }
    .dr-btn.dr-active {
      background: rgba(30,210,80,0.25);
      border-color: rgba(30,210,80,0.6);
      color: rgb(80,240,130);
    }
    .dr-btn.dr-active .dr-lbl { opacity: 1; }
    .dr-sep {
      width: 1px; height: 28px; flex-shrink: 0;
      background: rgba(255,255,255,0.1); align-self: center;
    }
    .dr-panel-card {
      position: fixed; left: 50%; bottom: 92px;
      transform: translateX(-50%);
      z-index: 9001; display: none;
      flex-direction: column; gap: 6px;
      background: rgba(8,4,28,0.97);
      border-radius: 18px; padding: 10px 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.12);
      max-width: calc(100vw - 20px);
      box-sizing: border-box;
    }
    .dr-row {
      display: flex; gap: 5px; align-items: center;
      flex-wrap: nowrap;
    }
    .dr-color-row {
      display: flex; gap: 6px; justify-content: center;
      padding: 2px 0;
    }
    .dr-swatch {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.18);
      cursor: pointer; padding: 0; transition: transform 0.1s;
    }
    .dr-swatch:active { transform: scale(1.15); }
    .dr-swatch.dr-sel { border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.3); }
  `;
  document.head.appendChild(styleEl);

  /* ══════════════════════════════════════════════════════════════
     PAINEL PRINCIPAL — barra horizontal
  ══════════════════════════════════════════════════════════════ */
  function mkBtn(icon, label) {
    const b = document.createElement('button');
    b.className = 'dr-btn';
    b.setAttribute('data-ruler', '1');
    const ico = document.createElement('span'); ico.textContent = icon;
    const lbl = document.createElement('span'); lbl.className = 'dr-lbl'; lbl.textContent = label;
    b.append(ico, lbl);
    return b;
  }
  function mkSep() {
    const d = document.createElement('div');
    d.className = 'dr-sep'; d.setAttribute('data-ruler', '1');
    return d;
  }

  const btnH      = mkBtn('H', 'Guia H');
  const btnV      = mkBtn('V', 'Guia V');
  const btnUndo   = mkBtn('↩', 'Desfaz');
  const btnClr    = mkBtn('✕', 'Limpar');
  const btnSav    = mkBtn('💾', 'Salvar');
  const btnLod    = mkBtn('📂', 'Abrir');
  const btnCanvas = mkBtn('⊞', 'Canvas');
  const btnDist   = mkBtn('📏', 'Dist');
  const btnShot   = mkBtn('📸', 'Print');
  const btnWide   = mkBtn('👁', 'Ocultar');
  const btnRef    = mkBtn('🖼', 'Ref');
  const btnState  = mkBtn('🗂', 'Estado');

  /* Cor ativa — indicador no botão H */
  const colorDot = document.createElement('div');
  Object.assign(colorDot.style, {
    width:'8px', height:'8px', borderRadius:'50%',
    background:currentColor.solid, border:'1.5px solid rgba(255,255,255,0.7)',
    position:'absolute', bottom:'3px', right:'4px', pointerEvents:'none',
  });
  btnH.style.position = 'relative';
  btnH.appendChild(colorDot);

  const panel = document.createElement('div');
  panel.className = 'dr-panel-card';
  panel.setAttribute('data-ruler', '1');

  /* Row 1: guias */
  const row1 = document.createElement('div'); row1.className = 'dr-row';
  row1.append(btnH, btnV, mkSep(), btnUndo, btnClr, mkSep(), btnSav, btnLod);
  /* Row 2: ferramentas */
  const row2 = document.createElement('div'); row2.className = 'dr-row';
  row2.append(btnCanvas, btnDist, btnShot, btnWide, mkSep(), btnRef, mkSep(), btnState);
  /* Row 3: paleta de cores */
  const colorRow = document.createElement('div'); colorRow.className = 'dr-color-row';
  colorRow.setAttribute('data-ruler', '1');
  const swatches = COLORS.map(c => {
    const sw = document.createElement('button');
    sw.className = 'dr-swatch'; sw.setAttribute('data-ruler', '1');
    sw.style.background = c.solid;
    sw.addEventListener('click', () => {
      currentColor = c; colorDot.style.background = c.solid;
      updateModeBtns(); refreshSwatches();
    });
    return sw;
  });
  swatches.forEach(sw => colorRow.appendChild(sw));
  function refreshSwatches() {
    swatches.forEach((sw, i) => sw.classList.toggle('dr-sel', COLORS[i] === currentColor));
  }
  refreshSwatches();

  panel.append(row1, row2, colorRow);

  function updateModeBtns() {
    btnH.classList.toggle('dr-active', addMode === 'h');
    btnV.classList.toggle('dr-active', addMode === 'v');
    if (addMode === 'h') {
      btnH.querySelector('.dr-btn > span, span').style && (btnH.style.borderColor = currentColor.solid);
    }
  }
  updateModeBtns();

  /* Hold longo → abre color picker inline (já está na row3, não precisa popover) */
  let refHoldTimer;
  btnRef.addEventListener('touchstart', () => {
    refHoldTimer = setTimeout(() => {
      if (!refLoaded) return;
      refOpacityIdx = (refOpacityIdx + 1) % OPACITIES.length;
      refImg.style.opacity = OPACITIES[refOpacityIdx];
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
    if (!refLoaded) fileInput.click();
    else { refVisible = !refVisible; refImg.style.display = refVisible ? 'block' : 'none'; updateRefBtn(); }
  });
  btnCanvas.addEventListener('click', () => setCanvasMode(!canvasMode));
  btnDist.addEventListener  ('click', () => setDistRuler(!distRulerOn));
  btnShot.addEventListener  ('click', takeScreenshot);
  btnWide.addEventListener  ('click', () => setWideView(!wideViewOn));
  btnState.addEventListener ('click', openStateModal);

  /* ══════════════════════════════════════════════════════════════
     BOTÃO DE ATIVAÇÃO
  ══════════════════════════════════════════════════════════════ */
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'dev-ruler-btn';
  toggleBtn.setAttribute('data-ruler', '1');
  toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="7"  y1="7"  x2="7"  y2="17"/>
    <line x1="12" y1="7"  x2="12" y2="17"/>
    <line x1="17" y1="7"  x2="17" y2="17"/>
    <line x1="7"  y1="12" x2="12" y2="12"/>
  </svg><span style="font-size:10px;font-weight:900;font-family:monospace;letter-spacing:.5px">DEV</span>`;
  Object.assign(toggleBtn.style, {
    position:'fixed', right:'12px', bottom:'24px',
    zIndex:'9002', height:'38px', padding:'0 14px',
    borderRadius:'19px',
    background:'rgba(6,2,26,0.82)', color:'#fff',
    border:'1.5px solid rgba(255,255,255,0.18)',
    cursor:'pointer', display:'flex', alignItems:'center',
    justifyContent:'center', gap:'6px',
    boxShadow:'0 3px 12px rgba(0,0,0,0.4)',
  });

  toggleBtn.addEventListener('click', () => {
    toolActive = !toolActive;
    canvas.style.display     = toolActive ? 'block' : 'none';
    guideLayer.style.display = toolActive ? 'block' : 'none';
    panel.style.display      = toolActive ? 'flex'  : 'none';
    if (!toolActive) {
      deselect(); setCanvasMode(false); setDistRuler(false); setWideView(false);
      refImg.style.display = 'none';
    } else {
      if (refLoaded && refVisible) refImg.style.display = 'block';
      tapLayer.style.display   = canvasMode ? 'none' : 'block';
      cSelLayer.style.display  = canvasMode ? 'block' : 'none';
      drawGrid();
      if (window.gsap) {
        window.gsap.fromTo(panel, { y:20, opacity:0 }, { y:0, opacity:1, duration:0.25, ease:'power2.out' });
      }
    }
    toggleBtn.style.background = toolActive ? 'rgba(220,20,20,0.9)' : 'rgba(6,2,26,0.82)';
    toggleBtn.style.borderColor = toolActive ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.18)';
  });

  window.addEventListener('resize', () => { if (toolActive) drawGrid(); if (cTarget) updateCanvasUI(); });
  window.addEventListener('scroll', () => { if (cTarget) updateCanvasUI(); }, { passive:true });

  /* ══════════════════════════════════════════════════════════════
     MONTAR NO DOM
  ══════════════════════════════════════════════════════════════ */
  [panel, selPanel, modal, cPanel, stateModal].forEach(el => el.setAttribute('data-ruler', '1'));
  [cBorderEl, cDimBadge, moveHandle, cSelLayer, distT.wrap, distB.wrap, distL.wrap, distR.wrap]
    .forEach(el => el.setAttribute('data-ruler', '1'));
  Object.values(handles).forEach(h => h.setAttribute('data-ruler', '1'));
  [refImg, tapLayer, canvas, guideLayer].forEach(el => el.setAttribute('data-ruler', '1'));

  document.body.append(
    refImg, fileInput, styleEl,
    canvas, guideLayer, tapLayer,
    cSelLayer, cBorderEl, cDimBadge,
    distT.wrap, distB.wrap, distL.wrap, distR.wrap,
    ...Object.values(handles), moveHandle,
    panel, selPanel, cPanel, modal, stateModal,
    toast, toggleBtn
  );
})();
