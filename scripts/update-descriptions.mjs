/**
 * One-shot script — updates description, teor and origem for all products.
 * Run via GitHub Actions "Update Product Descriptions" workflow.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const products = [
  /* ── Cervejas ─────────────────────────────────────────────── */
  {
    id: '7fKkEbCtpU5g3nu4XK19',
    description: 'A cerveja mais querida do Brasil em lata. Chopp Brahma com sabor leve, suave e refrescante, perfeita para qualquer momento.',
    teor: '4,8% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'NQVjEHVLzpqCvD8ii97Z',
    description: 'Brahma na icônica garrafa long neck. Sabor suave e refrescante com aquele gosto de chopp que todo mundo ama.',
    teor: '4,8% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'OGlsAXxBziOrw9dhnKfV',
    description: 'Cerveja Pilsen leve e refrescante, com sabor suave e levemente amargo. Uma das marcas mais tradicionais e queridas do Brasil.',
    teor: '4,8% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'Y9yXMUtfEJLuPmYd7SG2',
    description: 'A premiada cerveja holandesa em lata. Sabor equilibrado, levemente amargo com aroma de lúpulo fresco. Qualidade internacional.',
    teor: '5% alc. vol.',
    origem: 'Holanda (fabricada no Brasil)',
  },
  {
    id: 'qpkXTGAfdJgi7gPEVE4J',
    description: 'Heineken na icônica garrafa verde. Cerveja premium com sabor refrescante, levemente amargo e aroma característico de lúpulo.',
    teor: '5% alc. vol.',
    origem: 'Holanda (fabricada no Brasil)',
  },
  {
    id: 'lhlkEYyv9OSQBfV2CMf1',
    description: 'A cerveja que desce redondo! Skol Pilsen leve e refrescante na garrafa. Uma das cervejas mais populares do Brasil.',
    teor: '4,7% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'OFvXyp7XiTzKnyK7m5yk',
    description: 'Skol em lata, leve e muito refrescante. Sabor suave e equilibrado, perfeita para o calor e para compartilhar com os amigos.',
    teor: '4,7% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'dKrDktNIPNj4d60BNcku',
    description: 'Cerveja mexicana lager de cor dourada e cristalina. Sabor leve e refrescante, perfeita servida bem gelada com uma rodela de limão.',
    teor: '4,6% alc. vol.',
    origem: 'México',
  },
  /* ── Destilados ───────────────────────────────────────────── */
  {
    id: 'VmR1OeITAMLDIpUk8Z8y',
    description: 'Tennessee Whiskey filtrado pelo processo Lincoln County. Notas clássicas de baunilha, caramelo e carvalho tostado em sabor suave e equilibrado.',
    teor: '40% alc. vol.',
    origem: 'EUA (Lynchburg, Tennessee)',
  },
  {
    id: 'JwS339jzGXLibiN8jyye',
    description: 'Jack Daniel\'s na embalagem família 1,5L. Sabor inconfundível com notas de baunilha, mel e carvalho. Filtrado por carvão de bordo.',
    teor: '40% alc. vol.',
    origem: 'EUA (Lynchburg, Tennessee)',
  },
  {
    id: 'WA25iuLIjc2OLX6Kr9iq',
    description: 'Scotch Whisky blended de sabor suave e encorpado, com notas de baunilha, frutas secas e leve toque defumado. Excelente custo-benefício entre os escoceses.',
    teor: '40% alc. vol.',
    origem: 'Escócia',
  },
  {
    id: 'vZ6L4ae4m73EgqvgMOjp',
    description: 'O Scotch Whisky blended mais vendido do mundo. Notas defumadas, frutas maduras e especiarias. Versátil, ideal para drinques e puro.',
    teor: '40% alc. vol.',
    origem: 'Escócia',
  },
  {
    id: 'HNLPeVfrTUDAzNjPkmwv',
    description: 'Vodka triple destilada e filtrada dez vezes em carvão ativo. Sabor neutro, limpo e puro. A vodka mais vendida do mundo, perfeita para drinks clássicos.',
    teor: '37,5% alc. vol.',
    origem: 'EUA',
  },
  {
    id: 'mjoAbKrxVwqgV2m7JQz5',
    description: 'Cachaça envelhecida em barris de carvalho que confere cor dourada e sabor suave com notas amadeiradas. 100% brasileira, produzida no Ceará desde 1846.',
    teor: '38% alc. vol.',
    origem: 'Brasil (Ceará)',
  },
  /* ── Energéticos ──────────────────────────────────────────── */
  {
    id: 'fXdjBL01bfahHFu4uies',
    description: 'O energético mais icônico do mundo. Com taurina, ginseng, B-vitaminas e 160mg de cafeína. Para quem vive no limite e não para nunca.',
    teor: 'Sem álcool',
    origem: 'EUA',
  },
  {
    id: 'y4gnhvwhHiq7Gchz5reA',
    description: 'Monster sem açúcar e zero calorias. Sabor cítrico leve e refrescante com toda a energia do Monster original. 150mg de cafeína.',
    teor: 'Sem álcool',
    origem: 'EUA',
  },
  {
    id: 'n1T4aLYEbjeJJtQvrBSY',
    description: 'Energético em embalagem família 2 litros. Taurina, vitaminas do complexo B e cafeína para agitar a galera. Sabor original e refrescante.',
    teor: 'Sem álcool',
    origem: 'Brasil',
  },
  {
    id: 'h60d1rMmDnOlmgPSfXM7',
    description: 'Energético sabor cítrico com taurina, vitaminas B e cafeína. Levinho, refrescante e com aquele gás especial que anima qualquer rolê.',
    teor: 'Sem álcool',
    origem: 'Brasil',
  },
  /* ── Vinhos ───────────────────────────────────────────────── */
  {
    id: '55dpEopMUegnUhOhgW3d',
    description: 'Vinho tinto suave nacional com sabor adocicado, frutado e de boa estrutura. Ótimo custo-benefício para o dia a dia. Harmoniza com massas e carnes leves.',
    teor: '8,5% alc. vol.',
    origem: 'Brasil',
  },
  {
    id: 'L0qPLHTg9vSrfiCptMVa',
    description: 'Vinho tinto de mesa com sabor suave e frutado, produzido na Serra Gaúcha. Harmoniza perfeitamente com carnes vermelhas e queijos.',
    teor: '11% alc. vol.',
    origem: 'Brasil (Rio Grande do Sul)',
  },
];

let ok = 0;
let fail = 0;
for (const p of products) {
  try {
    await db.collection('products').doc(p.id).update({
      description: p.description,
      teor: p.teor,
      origem: p.origem,
    });
    console.log(`✓  ${p.id}`);
    ok++;
  } catch (err) {
    console.error(`✗  ${p.id}  →  ${err.message}`);
    fail++;
  }
}
console.log(`\nDone: ${ok} updated, ${fail} failed.`);
