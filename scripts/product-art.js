/**
 * PRODUCT ART — ilustrações vetoriais dos produtos
 * ===================================================================
 * Gera SVGs limpos (fundo branco) para cada tipo de bebida/item.
 * Usado quando o produto não tem foto própria (campo `image`).
 * Fills sólidos + brilho — sem <defs> pra evitar colisão de IDs.
 * ===================================================================
 */

function svg(inner) {
  return `<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg" class="prod-art-svg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

// Brilho/sheen padrão sobre vidro
function sheen(x, w, y, h, r = 8) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" opacity="0.22"/>`;
}

/* ---- Garrafa genérica (longneck, cerveja 600, destilado, vinho) ---- */
function bottle({ glass, cap, label, labelBand = '#ffffff', bodyW = 116, neckH = 56, capW = 34 }) {
  const cx = 100, capY = 10, capH = 24;
  const neckW = 26, neckTop = capY + capH - 3, neckBot = neckTop + neckH;
  const bodyBot = 266, r = 16;
  const bx = cx - bodyW / 2, bx2 = cx + bodyW / 2;
  const path = `M ${cx - neckW / 2} ${neckTop}
    L ${cx - neckW / 2} ${neckBot}
    C ${cx - neckW / 2} ${neckBot + 20} ${bx} ${neckBot + 8} ${bx} ${neckBot + 40}
    L ${bx} ${bodyBot - r} Q ${bx} ${bodyBot} ${bx + r} ${bodyBot}
    L ${bx2 - r} ${bodyBot} Q ${bx2} ${bodyBot} ${bx2} ${bodyBot - r}
    L ${bx2} ${neckBot + 40}
    C ${bx2} ${neckBot + 8} ${cx + neckW / 2} ${neckBot + 20} ${cx + neckW / 2} ${neckBot}
    L ${cx + neckW / 2} ${neckTop} Z`;
  const labelY = neckBot + 70, labelH = 96;
  return svg(`
    <path d="${path}" fill="${glass}" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
    ${sheen(bx + 10, 14, neckBot + 46, bodyBot - neckBot - 70, 7)}
    <rect x="${cx - capW / 2}" y="${capY}" width="${capW}" height="${capH}" rx="5" fill="${cap}"/>
    <rect x="${cx - capW / 2}" y="${capY}" width="${capW}" height="7" rx="3" fill="#ffffff" opacity="0.3"/>
    <rect x="${bx + 8}" y="${labelY}" width="${bodyW - 16}" height="${labelH}" rx="7" fill="${label}"/>
    <rect x="${bx + 8}" y="${labelY + labelH / 2 - 11}" width="${bodyW - 16}" height="22" fill="${labelBand}" opacity="0.85"/>
    <rect x="${bx + 22}" y="${labelY + 16}" width="${bodyW - 44}" height="6" rx="3" fill="rgba(0,0,0,0.22)"/>
    <rect x="${bx + 30}" y="${labelY + labelH - 22}" width="${bodyW - 60}" height="5" rx="2.5" fill="rgba(0,0,0,0.18)"/>
  `);
}

/* ---- Lata (cerveja / refri / energético) ---- */
function can({ body, label = '#ffffff', accent = 'rgba(0,0,0,0.2)', slim = false }) {
  const w = slim ? 96 : 124, cx = 100;
  const x = cx - w / 2, top = 26, bot = 258, r = 16;
  return svg(`
    <rect x="${x}" y="${top}" width="${w}" height="${bot - top}" rx="${r}" fill="${body}" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
    <rect x="${x}" y="${top}" width="${w}" height="14" rx="${r}" fill="#c8ccd0"/>
    <rect x="${x}" y="${top + 8}" width="${w}" height="8" fill="${body}"/>
    <rect x="${x}" y="${bot - 16}" width="${w}" height="16" rx="${r}" fill="rgba(0,0,0,0.18)"/>
    ${sheen(x + 9, 13, top + 26, bot - top - 54, 6)}
    <rect x="${x + 12}" y="${top + 52}" width="${w - 24}" height="${bot - top - 110}" rx="6" fill="${label}" opacity="0.9"/>
    <rect x="${x + 24}" y="${top + 78}" width="${w - 48}" height="9" rx="4" fill="${accent}"/>
    <rect x="${x + 32}" y="${bot - 86}" width="${w - 64}" height="6" rx="3" fill="${accent}" opacity="0.7"/>
  `);
}

/* ---- Garrafa PET (refrigerante 2L) ---- */
function pet({ liquid, cap = '#e2e4e6', label = '#ffffff', accent = 'rgba(0,0,0,0.25)' }) {
  const cx = 100, capY = 8, neckTop = 30, neckBot = 56;
  const bx = 34, bx2 = 166, bodyBot = 268;
  const path = `M 86 ${neckTop} L 86 ${neckBot}
    C 86 70 ${bx} 66 ${bx} 104 L ${bx} ${bodyBot - 18}
    Q ${bx} ${bodyBot} ${bx + 20} ${bodyBot} L ${bx2 - 20} ${bodyBot}
    Q ${bx2} ${bodyBot} ${bx2} ${bodyBot - 18} L ${bx2} 104
    C ${bx2} 66 114 70 114 ${neckBot} L 114 ${neckTop} Z`;
  return svg(`
    <path d="${path}" fill="${liquid}" stroke="rgba(0,0,0,0.15)" stroke-width="2"/>
    <rect x="80" y="${capY}" width="40" height="26" rx="5" fill="${cap}"/>
    ${sheen(bx + 12, 16, 112, 130, 8)}
    <rect x="${bx + 8}" y="138" width="${bx2 - bx - 16}" height="92" rx="8" fill="${label}"/>
    <rect x="${bx + 22}" y="162" width="${bx2 - bx - 44}" height="11" rx="5" fill="${accent}"/>
    <rect x="${bx + 34}" y="190" width="${bx2 - bx - 68}" height="7" rx="3.5" fill="${accent}" opacity="0.6"/>
    <rect x="${bx}" y="${bodyBot - 44}" width="${bx2 - bx}" height="10" fill="rgba(0,0,0,0.12)"/>
  `);
}

/* ---- Dose (copo americano com bebida) ---- */
function shot({ liquid = '#c8841f' }) {
  return svg(`
    <path d="M 64 70 L 78 244 Q 80 256 100 256 Q 120 256 122 244 L 136 70 Z"
      fill="#eef3f6" stroke="rgba(0,0,0,0.16)" stroke-width="2"/>
    <path d="M 72 132 L 80 240 Q 82 250 100 250 Q 118 250 120 240 L 128 132 Z" fill="${liquid}"/>
    <rect x="70" y="88" width="9" height="150" rx="4" fill="#ffffff" opacity="0.5"/>
    <ellipse cx="100" cy="70" rx="36" ry="9" fill="#ffffff" opacity="0.8" stroke="rgba(0,0,0,0.14)" stroke-width="2"/>
  `);
}

/* ---- Copão (copo grande com canudo) ---- */
function cup({ liquid = '#b9202e' }) {
  return svg(`
    <path d="M 56 56 L 70 250 Q 72 264 100 264 Q 128 264 130 250 L 144 56 Z"
      fill="#eef3f6" stroke="rgba(0,0,0,0.16)" stroke-width="2"/>
    <path d="M 64 120 L 73 246 Q 75 256 100 256 Q 125 256 127 246 L 136 120 Z" fill="${liquid}"/>
    <ellipse cx="100" cy="56" rx="44" ry="11" fill="#ffffff" opacity="0.85" stroke="rgba(0,0,0,0.14)" stroke-width="2"/>
    <rect x="116" y="14" width="11" height="120" rx="5" fill="#f2c94c" transform="rotate(12 121 74)"/>
    <rect x="62" y="84" width="10" height="150" rx="5" fill="#ffffff" opacity="0.55"/>
  `);
}

/* ---- Saco de gelo ---- */
function ice() {
  return svg(`
    <path d="M 44 60 Q 100 44 156 60 L 150 250 Q 100 262 50 250 Z"
      fill="#dff1fb" stroke="rgba(0,0,0,0.14)" stroke-width="2"/>
    <rect x="70" y="40" width="60" height="26" rx="6" fill="#b8c0c6"/>
    ${[[76,110],[120,128],[88,160],[126,190],[74,200],[110,224]].map(([x,y])=>
      `<rect x="${x}" y="${y}" width="26" height="26" rx="5" fill="#ffffff" opacity="0.92" stroke="rgba(120,170,200,0.5)" stroke-width="1.5"/>`).join('')}
  `);
}

/* ---- Pacote (salgadinho / amendoim) ---- */
function bag({ body = '#e0a020', label = '#ffffff' }) {
  return svg(`
    <path d="M 48 44 L 152 44 L 158 252 Q 100 266 42 252 Z"
      fill="${body}" stroke="rgba(0,0,0,0.14)" stroke-width="2"/>
    <path d="M 48 44 L 152 44 L 148 30 L 52 30 Z" fill="rgba(0,0,0,0.18)"/>
    ${sheen(60, 16, 70, 150, 8)}
    <ellipse cx="100" cy="150" rx="44" ry="40" fill="${label}" opacity="0.95"/>
    <rect x="72" y="142" width="56" height="13" rx="6" fill="rgba(0,0,0,0.28)"/>
  `);
}

/* ---- Maço de cigarro ---- */
function pack({ body = '#c62828', label = '#f4f1e8' }) {
  return svg(`
    <rect x="56" y="46" width="88" height="190" rx="10" fill="${body}" stroke="rgba(0,0,0,0.16)" stroke-width="2"/>
    <rect x="56" y="46" width="88" height="44" rx="10" fill="${label}"/>
    <rect x="56" y="78" width="88" height="14" fill="${body}"/>
    ${sheen(64, 11, 100, 120, 5)}
    <rect x="74" y="120" width="52" height="12" rx="6" fill="${label}" opacity="0.9"/>
    <rect x="74" y="196" width="52" height="22" rx="4" fill="#1b1b1b" opacity="0.55"/>
  `);
}

// ----- catálogo de chaves -----
const ART = {
  'longneck-green':  () => bottle({ glass: '#2f7d3a', cap: '#1f5a28', label: '#e8392f', labelBand: '#ffffff' }),
  'longneck-amber':  () => bottle({ glass: '#9a5a1e', cap: '#5e3812', label: '#b5121b', labelBand: '#f2e4c0' }),
  'longneck-clear':  () => bottle({ glass: '#cfe3d6', cap: '#1d4d8c', label: '#1d4d8c', labelBand: '#f6e7b8' }),
  'longneck-gold':   () => bottle({ glass: '#b98f2a', cap: '#7d2230', label: '#7d2230', labelBand: '#f1d98a' }),
  'bottle-beer-amber': () => bottle({ glass: '#8a4a16', cap: '#4d2a0c', label: '#1d3f7a', labelBand: '#f0e3c4', bodyW: 128, neckH: 64 }),
  'bottle-beer-green': () => bottle({ glass: '#2f6b32', cap: '#1d4220', label: '#e8392f', labelBand: '#ffffff', bodyW: 128, neckH: 64 }),
  'can-green':   () => can({ body: '#2f7d3a', label: '#ffffff', accent: '#e8392f' }),
  'can-red':     () => can({ body: '#c62828', label: '#f6e7b8', accent: '#7a1414' }),
  'can-yellow':  () => can({ body: '#e6b412', label: '#ffffff', accent: '#c0392b' }),
  'can-cream':   () => can({ body: '#e9e3cf', label: '#1d3f7a', accent: '#1d3f7a' }),
  'can-coke':    () => can({ body: '#c8102e', label: '#ffffff', accent: '#c8102e' }),
  'can-guarana': () => can({ body: '#1f7a3d', label: '#f4d23a', accent: '#1f7a3d' }),
  'whisky-red':   () => bottle({ glass: '#7a3f12', cap: '#3a1f08', label: '#1b1b1b', labelBand: '#d4232e', bodyW: 124, neckH: 48 }),
  'whisky-black':  () => bottle({ glass: '#3a230f', cap: '#d4af37', label: '#111111', labelBand: '#d4af37', bodyW: 124, neckH: 48 }),
  'whisky-amber': () => bottle({ glass: '#a5641f', cap: '#5e3812', label: '#f4f1e8', labelBand: '#9a1b22', bodyW: 124, neckH: 48 }),
  'whisky-green': () => bottle({ glass: '#3f5e2a', cap: '#2a3d1c', label: '#f1e6c4', labelBand: '#7a2230', bodyW: 124, neckH: 48 }),
  'vodka-clear':  () => bottle({ glass: '#dbe7ef', cap: '#b0151f', label: '#ffffff', labelBand: '#b0151f', bodyW: 112, neckH: 60 }),
  'vodka-blue':   () => bottle({ glass: '#cfe0ee', cap: '#1f3f7a', label: '#1f3f7a', labelBand: '#ffffff', bodyW: 112, neckH: 60 }),
  'gin-green':    () => bottle({ glass: '#1f5236', cap: '#d4af37', label: '#d4af37', labelBand: '#1f5236', bodyW: 116, neckH: 54 }),
  'gin-clear':    () => bottle({ glass: '#dde8e0', cap: '#2a2a2a', label: '#2a2a2a', labelBand: '#ffffff', bodyW: 116, neckH: 54 }),
  'cachaca':      () => bottle({ glass: '#e6dfc6', cap: '#1f7a3d', label: '#1f7a3d', labelBand: '#f4d23a', bodyW: 110, neckH: 62 }),
  'tequila':      () => bottle({ glass: '#e9e9d8', cap: '#caa23a', label: '#caa23a', labelBand: '#7a3a18', bodyW: 110, neckH: 58 }),
  'bottle-dark':  () => bottle({ glass: '#3a2a1a', cap: '#caa23a', label: '#f1e6c4', labelBand: '#6a2018', bodyW: 122, neckH: 56 }),
  'wine-red':     () => bottle({ glass: '#4a1822', cap: '#2a0d12', label: '#f1e6c4', labelBand: '#7a1b22', bodyW: 110, neckH: 70 }),
  'sparkling':    () => bottle({ glass: '#3f5226', cap: '#d4af37', label: '#1b1b1b', labelBand: '#d4af37', bodyW: 116, neckH: 66 }),
  'soda-coke':    () => pet({ liquid: '#3a1c10', cap: '#c8102e', label: '#c8102e', accent: '#ffffff' }),
  'soda-guarana': () => pet({ liquid: '#caa14a', cap: '#1f7a3d', label: '#1f7a3d', accent: '#f4d23a' }),
  'soda-orange':  () => pet({ liquid: '#e8881c', cap: '#1f4ba0', label: '#1f4ba0', accent: '#ffffff' }),
  'juice':        () => pet({ liquid: '#6a2a8a', cap: '#e2e4e6', label: '#7a2e95', accent: '#ffffff' }),
  'energy-blue':  () => can({ body: '#1f4ba0', label: '#c0c0c0', accent: '#e6b412', slim: true }),
  'energy-black': () => can({ body: '#1b1b1b', label: '#5fd35f', accent: '#5fd35f', slim: true }),
  'energy-can':   () => can({ body: '#1f9a4a', label: '#ffffff', accent: '#1f6a32', slim: true }),
  'water':        () => pet({ liquid: '#cfe9f5', cap: '#1f7ab0', label: '#ffffff', accent: '#1f7ab0' }),
  'dose-whisky':  () => shot({ liquid: '#c8841f' }),
  'dose-vodka':   () => shot({ liquid: '#dbe7ef' }),
  'dose-catuaba': () => shot({ liquid: '#7a1f2a' }),
  'copao-red':    () => cup({ liquid: '#b9202e' }),
  'copao-blue':   () => cup({ liquid: '#1f6ab0' }),
  'copao-green':  () => cup({ liquid: '#3a8a3a' }),
  'ice':          () => ice(),
  'snack':        () => bag({ body: '#e6a017', label: '#ffffff' }),
  'peanut':       () => bag({ body: '#b5651d', label: '#f4e9c8' }),
  'cigarette':    () => pack({ body: '#c62828', label: '#f4f1e8' }),
  'misc':         () => bag({ body: '#5a5a5a', label: '#e0e0e0' })
};

const FALLBACK = {
  Cerveja: 'longneck-amber', Refrigerante: 'soda-coke', 'Água': 'water',
  'Energético': 'energy-blue', Destilado: 'whisky-amber', Vinho: 'wine-red',
  Suco: 'juice', Dose: 'dose-whisky', Outros: 'misc'
};

/** Retorna o SVG (string) da arte de um produto. */
export function productArt(product = {}) {
  const key = product.art;
  if (key && ART[key]) return ART[key]();
  const byCat = FALLBACK[product.category] || 'misc';
  return ART[byCat]();
}

/** HTML pronto da imagem do produto: foto (campo images[] ou image) OU arte vetorial. */
export function productImage(product = {}, { cls = '' } = {}) {
  const firstImage = (Array.isArray(product.images) && product.images[0]) || product.image;
  if (firstImage) {
    const url = String(firstImage).replace(/"/g, '&quot;');
    return `<div class="prod-img ${cls}">
      <img src="${url}" alt="" loading="lazy"
        onerror="this.remove()" />
    </div>`;
  }
  return `<div class="prod-img ${cls}">${productArt(product)}</div>`;
}

export const ART_KEYS = Object.keys(ART);
