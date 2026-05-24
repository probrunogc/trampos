/* ─── DEV RULER — ferramenta temporária de alinhamento ──────────
   Botão flutuante que ativa/desativa guias H/V arrastáveis com px.
   Para remover: apague este arquivo e o <script> no loja.html.
   ─────────────────────────────────────────────────────────────── */

(function () {
  let active   = false;
  let addMode  = 'h'; // 'h' = horizontal | 'v' = vertical
  let guides   = [];

  /* ── Grid canvas ─────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none',
    zIndex: '8990',
    display: 'none',
  });

  function drawGrid() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    // Minor lines every 10px
    ctx.strokeStyle = 'rgba(30,120,255,0.07)';
    ctx.lineWidth = 0.5;
    for (let x = 10; x < W; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 10; y < H; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Major lines every 50px + coordinate labels
    ctx.strokeStyle = 'rgba(30,120,255,0.20)';
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';

    for (let x = 0; x <= W; x += 50) {
      ctx.strokeStyle = 'rgba(30,120,255,0.22)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)';
      ctx.fillText(x, x + 2, 11);
    }
    for (let y = 50; y <= H; y += 50) {
      ctx.strokeStyle = 'rgba(30,120,255,0.22)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = 'rgba(30,120,255,0.55)';
      ctx.fillText(y, 2, y - 2);
    }
  }

  /* ── Guide layer ─────────────────────────────────────────────── */
  const guideLayer = document.createElement('div');
  Object.assign(guideLayer.style, {
    position: 'fixed', inset: '0',
    pointerEvents: 'none',
    zIndex: '9000',
    display: 'none',
  });

  function addGuide(type, pos) {
    pos = Math.round(pos);
    const line  = document.createElement('div');
    const badge = document.createElement('span');

    badge.textContent = pos + 'px';
    Object.assign(badge.style, {
      position: 'absolute',
      fontSize: '10px', fontFamily: 'monospace', fontWeight: '800',
      color: '#c00',
      background: 'rgba(255,255,255,0.92)',
      padding: '1px 5px', borderRadius: '3px',
      whiteSpace: 'nowrap', pointerEvents: 'none',
      lineHeight: '1.5',
    });

    if (type === 'h') {
      Object.assign(line.style, {
        position: 'absolute', left: '0', right: '0',
        top: pos + 'px', height: '1px',
        background: 'rgba(220,20,20,0.75)',
        pointerEvents: 'auto', cursor: 'ns-resize',
      });
      Object.assign(badge.style, { left: '8px', top: '-16px' });
    } else {
      Object.assign(line.style, {
        position: 'absolute', top: '0', bottom: '0',
        left: pos + 'px', width: '1px',
        background: 'rgba(220,20,20,0.75)',
        pointerEvents: 'auto', cursor: 'ew-resize',
      });
      Object.assign(badge.style, {
        top: '8px', left: '4px',
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
      });
    }

    line.appendChild(badge);
    guideLayer.appendChild(line);

    const g = { type, pos, line, badge };
    guides.push(g);

    /* Drag */
    let startTouch, startPos;
    line.addEventListener('touchstart', e => {
      startTouch = e.touches[0];
      startPos   = g.pos;
      e.stopPropagation();
    }, { passive: true });

    line.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (type === 'h') {
        g.pos = Math.max(0, Math.round(startPos + t.clientY - startTouch.clientY));
        line.style.top  = g.pos + 'px';
      } else {
        g.pos = Math.max(0, Math.round(startPos + t.clientX - startTouch.clientX));
        line.style.left = g.pos + 'px';
      }
      badge.textContent = g.pos + 'px';
      e.stopPropagation(); e.preventDefault();
    }, { passive: false });

    /* Double-tap to remove */
    let lastTap = 0;
    line.addEventListener('touchend', e => {
      if (Date.now() - lastTap < 320) { guides = guides.filter(x => x !== g); line.remove(); }
      lastTap = Date.now();
      e.stopPropagation();
    });
  }

  /* ── Tap overlay (captures taps to place guides) ─────────────── */
  const tapLayer = document.createElement('div');
  Object.assign(tapLayer.style, {
    position: 'fixed', inset: '0',
    zIndex: '8995',
    display: 'none',
  });

  tapLayer.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    addGuide(addMode, addMode === 'h' ? t.clientY : t.clientX);
    e.preventDefault();
  }, { passive: false });

  /* ── Controls panel (H / V / clear) ─────────────────────────── */
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', bottom: '140px',
    zIndex: '9001', display: 'none',
    flexDirection: 'column', gap: '6px', alignItems: 'center',
  });

  function mkCtrlBtn(label, bg) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      width: '34px', height: '34px', borderRadius: '50%',
      border: '1.5px solid rgba(255,255,255,0.25)',
      background: bg, color: '#fff',
      fontSize: '11px', fontWeight: '800', fontFamily: 'monospace',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    return b;
  }

  const btnH     = mkCtrlBtn('H', 'rgba(220,20,20,0.85)');
  const btnV     = mkCtrlBtn('V', 'rgba(220,20,20,0.40)');
  const btnClear = mkCtrlBtn('✕', 'rgba(60,60,60,0.75)');

  function setMode(m) {
    addMode = m;
    btnH.style.background = m === 'h' ? 'rgba(220,20,20,0.90)' : 'rgba(220,20,20,0.38)';
    btnV.style.background = m === 'v' ? 'rgba(220,20,20,0.90)' : 'rgba(220,20,20,0.38)';
  }
  btnH.addEventListener('click', () => setMode('h'));
  btnV.addEventListener('click', () => setMode('v'));
  btnClear.addEventListener('click', () => { guides.forEach(g => g.line.remove()); guides = []; });

  panel.append(btnClear, btnV, btnH);

  /* ── Toggle button ───────────────────────────────────────────── */
  const btn = document.createElement('button');
  btn.id = 'dev-ruler-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" width="17" height="17">
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="7"  y1="7"  x2="7"  y2="17"/>
    <line x1="12" y1="7"  x2="12" y2="17"/>
    <line x1="17" y1="7"  x2="17" y2="17"/>
    <line x1="7"  y1="12" x2="12" y2="12"/>
  </svg>`;
  Object.assign(btn.style, {
    position: 'fixed', right: '12px', bottom: '80px',
    zIndex: '9002',
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'rgba(6,2,26,0.78)',
    color: '#fff',
    border: '1.5px solid rgba(255,255,255,0.14)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  btn.addEventListener('click', () => {
    active = !active;
    const show = active ? 'block' : 'none';
    canvas.style.display   = show;
    guideLayer.style.display = show;
    tapLayer.style.display = show;
    panel.style.display    = active ? 'flex' : 'none';
    btn.style.background   = active ? 'rgba(220,20,20,0.85)' : 'rgba(6,2,26,0.78)';
    if (active) drawGrid();
  });

  window.addEventListener('resize', () => { if (active) drawGrid(); });

  document.body.append(canvas, guideLayer, tapLayer, panel, btn);
})();
