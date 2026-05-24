/* ─── DEV RULER v5 ────────────────────────────────────────────
   Ferramenta de design — temporária, remover antes do launch.

   v5 — novidades:
   • 8 handles de resize (cantos + bordas)
   • Move livre via transform: translate
   • Editor de border-radius com slider
   • Régua de distâncias até bordas do viewport
   • Captura de tela (html2canvas)
   • Modo "wide view" (esconde UI pra ver só o grid)
   • Animações com GSAP
   • Painel lateral animado
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

  const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
  const H2C_URL  = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

  /* config dos 8 handles + handle de movimento (centro) */
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
  let cTarget       = null;
  let cOrigStyles   = {};
  let cTransX       = 0, cTransY = 0;
  let cBorderRadius = 0;

  /* ══════════════════════════════════════════════════════════════
     CARREGADOR DE LIBS EXTERNAS (GSAP, html2canvas)
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

  /* helper anim */
  function anim(target, props, dur, ease) {
    if (window.gsap) {
      window.gsap.to(target, { ...props, duration: dur ?? 0.22, ease: ease || 'power2.out' });
    } else {
      Object.assign(target.style, props);
    }
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
      ? 'rgba(220,100,10,0.88)' : 'rgba(55,55,55,0.78)';
  }

  /* ══════════════════════════════════════════════════════════════
     GUIDE LAYER + GUIA SELECIONADA (painel)
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

  function selectGuide(g) {
    selected = g;
    posLabel.textContent = g.pos + 'px';
    refreshSelSwatches();
    positionSelPanel();
  }
  function deselect() { selected = null; selPanel.style.display = 'none'; }

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
     TAP LAYER (coloca guias)
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
     MODO CANVAS — seleção, 8 handles, move, border-radius
  ══════════════════════════════════════════════════════════════ */
  const cSelLayer = document.createElement('div');
  Object.assign(cSelLayer.style, {
    position:'fixed', inset:'0', zIndex:'8996', display:'none',
    background:'transparent', touchAction:'none',
    userSelect:'none', webkitUserSelect:'none',
  });
  cSelLayer.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
  cSelLayer.addEventListener('contextmenu', e => e.preventDefault());

  /* Borda do elemento selecionado */
  const cBorderEl = document.createElement('div');
  Object.assign(cBorderEl.style, {
    position:'fixed', display:'none', pointerEvents:'none', zIndex:'9004',
    border:'2px solid rgba(30,210,80,0.95)', borderRadius:'4px',
    background:'rgba(30,210,80,0.04)', boxSizing:'border-box',
    boxShadow:'0 0 0 1px rgba(255,255,255,0.25), 0 4px 18px rgba(0,0,0,0.18)',
  });

  /* Badge de dimensões */
  const cDimBadge = document.createElement('div');
  Object.assign(cDimBadge.style, {
    position:'fixed', display:'none', pointerEvents:'none', zIndex:'9004',
    background:'rgba(20,180,60,0.97)', color:'#fff',
    fontFamily:'monospace', fontSize:'12px', fontWeight:'900',
    padding:'3px 9px', borderRadius:'5px', whiteSpace:'nowrap',
  });

  /* 8 handles + move */
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

  /* Linhas de distância (ruler de espaçamento) */
  function mkDistLine() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position:'fixed', display:'none', pointerEvents:'none', zIndex:'9003',
    });
    const line = document.createElement('div');
    Object.assign(line.style, {
      position:'absolute', background:'rgba(255,140,0,0.88)',
      boxShadow:'0 0 4px rgba(255,140,0,0.5)',
    });
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

  /* ── Painel lateral de info do elemento ──────────────────── */
  const cPanel = document.createElement('div');
  Object.assign(cPanel.style, {
    position:'fixed', zIndex:'9006', display:'none',
    flexDirection:'column', gap:'8px',
    background:'rgba(8,4,28,0.97)',
    borderRadius:'14px', padding:'11px 13px',
    boxShadow:'0 6px 24px rgba(0,0,0,0.6)',
    border:'1px solid rgba(255,255,255,0.14)',
    left:'10px', right:'10px',
    bottom:'140px',
    maxWidth:'560px', margin:'0 auto',
  });

  const cClassName = document.createElement('div');
  Object.assign(cClassName.style, {
    color:'rgba(30,210,80,0.95)', fontFamily:'monospace',
    fontSize:'11px', fontWeight:'900', letterSpacing:'.4px',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
  });

  function mkValueChip(label) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display:'flex', gap:'5px', alignItems:'center' });
    const lbl = document.createElement('span');
    lbl.textContent = label;
    Object.assign(lbl.style, {
      color:'rgba(255,255,255,0.5)', fontFamily:'monospace',
      fontSize:'10px', minWidth:'12px',
    });
    const val = document.createElement('span');
    Object.assign(val.style, {
      color:'#fff', fontFamily:'monospace',
      fontSize:'12px', fontWeight:'900', minWidth:'52px',
    });
    const copy = document.createElement('button');
    copy.textContent = '📋';
    Object.assign(copy.style, {
      background:'rgba(255,255,255,0.1)',
      border:'1px solid rgba(255,255,255,0.2)', borderRadius:'5px',
      padding:'3px 6px', cursor:'pointer', fontSize:'11px',
    });
    copy.addEventListener('click', () => {
      copyToClipboard(val.textContent);
      copy.textContent = '✓';
      setTimeout(() => copy.textContent = '📋', 1100);
    });
    wrap.append(lbl, val, copy);
    return { wrap, val, copy };
  }

  const valRow1 = document.createElement('div');
  Object.assign(valRow1.style, { display:'flex', gap:'10px', flexWrap:'wrap' });
  const chipW = mkValueChip('W'); const chipH = mkValueChip('H');
  const chipX = mkValueChip('X'); const chipY = mkValueChip('Y');
  valRow1.append(chipW.wrap, chipH.wrap, chipX.wrap, chipY.wrap);

  /* Slider de border-radius */
  const radiusRow = document.createElement('div');
  Object.assign(radiusRow.style, { display:'flex', gap:'7px', alignItems:'center' });
  const radiusLbl = document.createElement('span');
  radiusLbl.textContent = '◖';
  Object.assign(radiusLbl.style, { color:'rgba(255,255,255,0.5)', fontSize:'13px' });
  const radiusSlider = document.createElement('input');
  radiusSlider.type = 'range'; radiusSlider.min = '0'; radiusSlider.max = '80'; radiusSlider.value = '0';
  Object.assign(radiusSlider.style, { flex:'1', accentColor:'rgb(30,210,80)' });
  const radiusVal = document.createElement('span');
  Object.assign(radiusVal.style, { color:'#fff', fontFamily:'monospace', fontSize:'12px', fontWeight:'900', minWidth:'48px' });
  radiusVal.textContent = '0px';
  const radiusCopy = document.createElement('button');
  radiusCopy.textContent = '📋';
  Object.assign(radiusCopy.style, { background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'5px', padding:'3px 6px', cursor:'pointer', fontSize:'11px' });
  radiusSlider.addEventListener('input', () => {
    if (!cTarget) return;
    cBorderRadius = +radiusSlider.value;
    cTarget.style.borderRadius = cBorderRadius + 'px';
    radiusVal.textContent = cBorderRadius + 'px';
  });
  radiusCopy.addEventListener('click', () => {
    copyToClipboard(radiusVal.textContent);
    radiusCopy.textContent = '✓';
    setTimeout(() => radiusCopy.textContent = '📋', 1100);
  });
  radiusRow.append(radiusLbl, radiusSlider, radiusVal, radiusCopy);

  /* Botões do painel: copiar CSS / reverter / OK */
  const cBtnRow = document.createElement('div');
  Object.assign(cBtnRow.style, { display:'flex', gap:'6px' });
  function mkCBtn(txt, bg) {
    const b = document.createElement('button');
    b.textContent = txt;
    Object.assign(b.style, {
      flex:'1', padding:'7px 10px', borderRadius:'8px',
      background:bg, border:'none', color:'#fff',
      fontFamily:'monospace', fontSize:'11px', fontWeight:'700', cursor:'pointer',
    });
    return b;
  }
  const cBtnCopyAll = mkCBtn('📋 CSS', 'rgba(30,100,255,0.85)');
  const cBtnRevert  = mkCBtn('↩ Reverter', 'rgba(200,30,30,0.65)');
  const cBtnOk      = mkCBtn('✓ OK', 'rgba(30,160,30,0.75)');
  cBtnRow.append(cBtnCopyAll, cBtnRevert, cBtnOk);

  cPanel.append(cClassName, valRow1, radiusRow, cBtnRow);

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

  cBtnCopyAll.addEventListener('click', () => {
    if (!cTarget) return;
    const rect = cTarget.getBoundingClientRect();
    const lines = [
      `width: ${Math.round(rect.width)}px;`,
      `height: ${Math.round(rect.height)}px;`,
    ];
    if (cTransX || cTransY) lines.push(`transform: translate(${Math.round(cTransX)}px, ${Math.round(cTransY)}px);`);
    if (cBorderRadius)       lines.push(`border-radius: ${cBorderRadius}px;`);
    copyToClipboard(lines.join('\n'));
    cBtnCopyAll.textContent = '✓ copiado';
    setTimeout(() => cBtnCopyAll.textContent = '📋 CSS', 1400);
  });
  cBtnRevert.addEventListener('click', () => {
    if (!cTarget) return;
    Object.assign(cTarget.style, cOrigStyles);
    cTransX = 0; cTransY = 0; cBorderRadius = parseInt(cOrigStyles.borderRadius) || 0;
    radiusSlider.value = cBorderRadius;
    radiusVal.textContent = cBorderRadius + 'px';
    updateCanvasUI();
  });
  cBtnOk.addEventListener('click', clearCanvasSelection);

  /* Posicionar tudo em torno do elemento */
  function updateCanvasUI() {
    if (!cTarget) return;
    const rect = cTarget.getBoundingClientRect();

    Object.assign(cBorderEl.style, {
      display:'block',
      left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
    });

    const badgeY = rect.top > 28 ? rect.top - 24 : rect.bottom + 6;
    Object.assign(cDimBadge.style, {
      display:'block',
      left: rect.left + 'px', top: badgeY + 'px',
    });
    cDimBadge.textContent =
      Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px';

    Object.keys(HCONF).forEach(id => {
      const cfg = HCONF[id], [w, h] = cfg.size;
      let x, y;
      if (cfg.x === -1)      x = rect.left  - w/2;
      else if (cfg.x === 1)  x = rect.right - w/2;
      else                   x = rect.left + (rect.width - w) / 2;
      if (cfg.y === -1)      y = rect.top    - h/2;
      else if (cfg.y === 1)  y = rect.bottom - h/2;
      else                   y = rect.top + (rect.height - h) / 2;
      Object.assign(handles[id].style, {
        display:'flex', left: x + 'px', top: y + 'px',
      });
    });

    Object.assign(moveHandle.style, {
      display:'flex',
      left: (rect.left + (rect.width - 40) / 2) + 'px',
      top:  (rect.top  + (rect.height - 40) / 2) + 'px',
    });

    /* Painel: atualizar valores */
    chipW.val.textContent = Math.round(rect.width)  + 'px';
    chipH.val.textContent = Math.round(rect.height) + 'px';
    chipX.val.textContent = Math.round(cTransX)     + 'px';
    chipY.val.textContent = Math.round(cTransY)     + 'px';

    updateDistRuler();
  }

  /* Régua de distância — linhas até as bordas do viewport */
  function updateDistRuler() {
    const arr = [distT, distB, distL, distR];
    if (!distRulerOn || !cTarget) {
      arr.forEach(d => d.wrap.style.display = 'none');
      return;
    }
    const r = cTarget.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;

    /* topo */
    Object.assign(distT.wrap.style, {
      display:'block', left: cx + 'px', top:'0',
      width:'1px', height: r.top + 'px',
    });
    Object.assign(distT.line.style, { left:'0', top:'0', width:'1px', height:'100%' });
    Object.assign(distT.label.style, { left:'8px', top: (r.top/2) + 'px', transform:'translate(0, -50%)' });
    distT.label.textContent = Math.round(r.top) + 'px';

    /* base */
    Object.assign(distB.wrap.style, {
      display:'block', left: cx + 'px', top: r.bottom + 'px',
      width:'1px', height: (H - r.bottom) + 'px',
    });
    Object.assign(distB.line.style, { left:'0', top:'0', width:'1px', height:'100%' });
    Object.assign(distB.label.style, { left:'8px', top: ((H - r.bottom)/2) + 'px', transform:'translate(0, -50%)' });
    distB.label.textContent = Math.round(H - r.bottom) + 'px';

    /* esquerda */
    Object.assign(distL.wrap.style, {
      display:'block', left:'0', top: cy + 'px',
      width: r.left + 'px', height:'1px',
    });
    Object.assign(distL.line.style, { left:'0', top:'0', height:'1px', width:'100%' });
    Object.assign(distL.label.style, { top:'-8px', left: (r.left/2) + 'px', transform:'translate(-50%, -100%)' });
    distL.label.textContent = Math.round(r.left) + 'px';

    /* direita */
    Object.assign(distR.wrap.style, {
      display:'block', left: r.right + 'px', top: cy + 'px',
      width: (W - r.right) + 'px', height:'1px',
    });
    Object.assign(distR.line.style, { left:'0', top:'0', height:'1px', width:'100%' });
    Object.assign(distR.label.style, { top:'-8px', left: ((W - r.right)/2) + 'px', transform:'translate(-50%, -100%)' });
    distR.label.textContent = Math.round(W - r.right) + 'px';
  }

  /* Drag — 8 handles */
  function setupHandleDrag(handleEl, id) {
    const cfg = HCONF[id];
    let startTouch = null, startRect = null;
    let startTransX = 0, startTransY = 0;

    handleEl.addEventListener('touchstart', e => {
      if (!cTarget) return;
      startTouch = e.touches[0];
      startRect  = cTarget.getBoundingClientRect();
      startTransX = cTransX; startTransY = cTransY;
      e.stopPropagation();
    }, { passive:true });

    handleEl.addEventListener('touchmove', e => {
      if (!cTarget || !startTouch || !startRect) return;
      const t = e.touches[0];
      const dx = t.clientX - startTouch.clientX;
      const dy = t.clientY - startTouch.clientY;

      let newW = startRect.width, newH = startRect.height;
      let newTX = startTransX, newTY = startTransY;

      if (cfg.x === 1)        newW = Math.max(20, startRect.width + dx);
      else if (cfg.x === -1)  { newW = Math.max(20, startRect.width - dx); newTX = startTransX + dx; }

      if (cfg.y === 1)        newH = Math.max(20, startRect.height + dy);
      else if (cfg.y === -1)  { newH = Math.max(20, startRect.height - dy); newTY = startTransY + dy; }

      if (cfg.x !== 0) {
        cTarget.style.width     = newW + 'px';
        cTarget.style.flexBasis = newW + 'px';
        cTarget.style.maxWidth  = newW + 'px';
        cTarget.style.minWidth  = '';
      }
      if (cfg.y !== 0) {
        cTarget.style.height      = newH + 'px';
        cTarget.style.minHeight   = newH + 'px';
        cTarget.style.aspectRatio = 'unset';
      }
      cTransX = newTX; cTransY = newTY;
      cTarget.style.transform = `translate(${cTransX}px, ${cTransY}px)`;

      updateCanvasUI();
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handleEl.addEventListener('touchend', e => { e.stopPropagation(); });
  }
  Object.keys(handles).forEach(id => setupHandleDrag(handles[id], id));

  /* Drag — move handle (centro) */
  (function setupMoveDrag() {
    let startTouch = null, startTX = 0, startTY = 0;
    moveHandle.addEventListener('touchstart', e => {
      if (!cTarget) return;
      startTouch = e.touches[0];
      startTX = cTransX; startTY = cTransY;
      e.stopPropagation();
    }, { passive:true });
    moveHandle.addEventListener('touchmove', e => {
      if (!cTarget || !startTouch) return;
      const t = e.touches[0];
      cTransX = startTX + (t.clientX - startTouch.clientX);
      cTransY = startTY + (t.clientY - startTouch.clientY);
      cTarget.style.transform = `translate(${cTransX}px, ${cTransY}px)`;
      updateCanvasUI();
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    moveHandle.addEventListener('touchend', e => { e.stopPropagation(); });
  })();

  /* Seleção do elemento ao tocar */
  cSelLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    cSelLayer.style.pointerEvents = 'none';
    const el = document.elementFromPoint(t.clientX, t.clientY);
    cSelLayer.style.pointerEvents = 'auto';

    if (!el || el === document.body || el === document.documentElement) return;
    if (el.closest('#dev-ruler-btn') || el.closest('[data-ruler]')) return;

    clearCanvasSelection();
    cTarget = el;
    cOrigStyles = {
      width: el.style.width, height: el.style.height,
      flexBasis: el.style.flexBasis, maxWidth: el.style.maxWidth,
      minWidth: el.style.minWidth, minHeight: el.style.minHeight,
      aspectRatio: el.style.aspectRatio,
      transform: el.style.transform,
      borderRadius: el.style.borderRadius,
    };
    cTransX = 0; cTransY = 0;
    const computed = getComputedStyle(el);
    cBorderRadius = parseInt(computed.borderTopLeftRadius) || 0;
    radiusSlider.value = Math.min(80, cBorderRadius);
    radiusVal.textContent = cBorderRadius + 'px';

    const classes = Array.from(el.classList).slice(0, 3).join(' .');
    cClassName.textContent = classes ? '.' + classes : el.tagName.toLowerCase();

    updateCanvasUI();
    cPanel.style.display = 'flex';
    if (window.gsap) {
      window.gsap.fromTo(cPanel, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out' });
      window.gsap.fromTo([cBorderEl, ...Object.values(handles), moveHandle],
        { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(2)', stagger: 0.015 });
    }
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
    btnCanvas.style.background = on ? 'rgba(20,200,70,0.88)' : 'rgba(55,55,55,0.78)';
    document.body.style.userSelect = on ? 'none' : '';
    document.body.style.webkitUserSelect = on ? 'none' : '';
    document.body.style.webkitTouchCallout = on ? 'none' : '';
  }

  function setDistRuler(on) {
    distRulerOn = on;
    btnDist.style.background = on ? 'rgba(255,140,0,0.88)' : 'rgba(55,55,55,0.78)';
    updateDistRuler();
  }

  /* ══════════════════════════════════════════════════════════════
     SCREENSHOT (html2canvas)
  ══════════════════════════════════════════════════════════════ */
  async function takeScreenshot() {
    if (!window.html2canvas) {
      flash('html2canvas ainda carregando, tenta de novo…');
      return;
    }
    /* Esconde UI da ruler */
    const rulerNodes = document.querySelectorAll('[data-ruler]');
    const prevDisplay = [];
    rulerNodes.forEach(n => { prevDisplay.push(n.style.display); n.style.display = 'none'; });
    canvas.style.display = 'none';
    guideLayer.style.display = 'none';

    await new Promise(r => requestAnimationFrame(r));
    try {
      const cnv = await window.html2canvas(document.body, {
        backgroundColor: '#ffffff', scale: 2, useCORS: true,
        windowWidth: window.innerWidth, windowHeight: window.innerHeight,
        x: 0, y: window.scrollY,
        width: window.innerWidth, height: window.innerHeight,
      });
      cnv.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `dev-ruler-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        flash('📸 screenshot salva!');
      }, 'image/png');
    } catch (err) {
      console.error(err); flash('Erro ao capturar tela');
    }
    /* Restaura UI */
    rulerNodes.forEach((n, i) => n.style.display = prevDisplay[i]);
    if (toolActive) {
      canvas.style.display = 'block';
      guideLayer.style.display = 'block';
    }
  }

  /* Toast simples */
  const toast = document.createElement('div');
  toast.setAttribute('data-ruler', '1');
  Object.assign(toast.style, {
    position:'fixed', bottom:'42px', left:'50%', transform:'translateX(-50%)',
    background:'rgba(8,4,28,0.96)', color:'#fff',
    fontFamily:'monospace', fontSize:'12px', fontWeight:'800',
    padding:'9px 14px', borderRadius:'9px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
    border:'1px solid rgba(255,255,255,0.16)',
    zIndex:'9020', display:'none',
  });
  function flash(msg) {
    toast.textContent = msg;
    toast.style.display = 'block';
    if (window.gsap) window.gsap.fromTo(toast, { y:14, opacity:0 }, { y:0, opacity:1, duration:0.2 });
    clearTimeout(flash._t);
    flash._t = setTimeout(() => {
      if (window.gsap) {
        window.gsap.to(toast, { opacity:0, y:14, duration:0.2,
          onComplete: () => { toast.style.display = 'none'; toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%)'; } });
      } else { toast.style.display = 'none'; }
    }, 1600);
  }

  /* ══════════════════════════════════════════════════════════════
     WIDE VIEW (esconde os botões/painel pra ver só o grid)
  ══════════════════════════════════════════════════════════════ */
  function setWideView(on) {
    wideViewOn = on;
    const els = [panel, toggleBtn, cPanel, selPanel];
    els.forEach(el => { el.style.opacity = on ? '0.07' : ''; });
    btnWide.style.background = on ? 'rgba(140,30,200,0.88)' : 'rgba(55,55,55,0.78)';
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
    flash('💾 esquema salvo');
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
            flash('📂 esquema carregado');
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
     PAINEL DE BOTÕES
  ══════════════════════════════════════════════════════════════ */
  const panel = document.createElement('div');
  panel.setAttribute('data-ruler', '1');
  Object.assign(panel.style, {
    position:'fixed', right:'12px', bottom:'140px',
    zIndex:'9001', display:'none',
    flexDirection:'column', gap:'6px', alignItems:'center',
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
  const btnCanvas = mkPBtn('⊞',  'rgba(55,55,55,0.78)');
  const btnDist   = mkPBtn('📏', 'rgba(55,55,55,0.78)');
  const btnShot   = mkPBtn('📸', 'rgba(55,55,55,0.78)');
  const btnWide   = mkPBtn('👁', 'rgba(55,55,55,0.78)');

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
  btnCanvas.addEventListener('click', () => setCanvasMode(!canvasMode));
  btnDist.addEventListener  ('click', () => setDistRuler(!distRulerOn));
  btnShot.addEventListener  ('click', takeScreenshot);
  btnWide.addEventListener  ('click', () => setWideView(!wideViewOn));

  panel.append(
    btnWide, btnShot, btnDist, btnCanvas,
    btnRef, btnLod, btnSav, btnUndo, btnClr, btnV, btnHWrap
  );

  /* ══════════════════════════════════════════════════════════════
     BOTÃO PRINCIPAL DE ATIVAÇÃO
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
      setCanvasMode(false);
      setDistRuler(false);
      setWideView(false);
      refImg.style.display = 'none';
    } else {
      if (refLoaded && refVisible) refImg.style.display = 'block';
      tapLayer.style.display = canvasMode ? 'none' : 'block';
      cSelLayer.style.display = canvasMode ? 'block' : 'none';
      drawGrid();
      if (window.gsap) {
        window.gsap.fromTo(panel,
          { x: 30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
        window.gsap.fromTo(panel.children,
          { x: 14, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.22, ease: 'power2.out', stagger: 0.02 });
      }
    }
    toggleBtn.style.background = toolActive ? 'rgba(220,20,20,0.85)' : 'rgba(6,2,26,0.78)';
  });

  window.addEventListener('resize', () => {
    if (toolActive) drawGrid();
    if (cTarget)   updateCanvasUI();
  });
  window.addEventListener('scroll', () => {
    if (cTarget) updateCanvasUI();
  }, { passive:true });

  /* ══════════════════════════════════════════════════════════════
     MONTAR NO DOM
  ══════════════════════════════════════════════════════════════ */
  [panel, selPanel, colorPick, modal, cPanel].forEach(el => el.setAttribute('data-ruler', '1'));
  [cBorderEl, cDimBadge, moveHandle, cSelLayer, distT.wrap, distB.wrap, distL.wrap, distR.wrap]
    .forEach(el => el.setAttribute('data-ruler', '1'));
  Object.values(handles).forEach(h => h.setAttribute('data-ruler', '1'));
  [refImg, tapLayer, canvas, guideLayer].forEach(el => el.setAttribute('data-ruler', '1'));

  document.body.append(
    refImg, fileInput,
    canvas, guideLayer, tapLayer,
    cSelLayer, cBorderEl, cDimBadge,
    distT.wrap, distB.wrap, distL.wrap, distR.wrap,
    ...Object.values(handles), moveHandle,
    panel, colorPick, selPanel, cPanel, modal,
    toast, toggleBtn
  );
})();
