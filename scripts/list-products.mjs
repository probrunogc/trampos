/**
 * One-shot script — lists all products from Firestore with barcode info.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('products').orderBy('name').get();
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const withBarcode    = all.filter(p => p.barcode?.trim());
const withoutBarcode = all.filter(p => !p.barcode?.trim());

console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${all.length} produtos  |  COM código: ${withBarcode.length}  |  SEM código: ${withoutBarcode.length}`);
console.log(`${'═'.repeat(60)}\n`);

console.log('── COM CÓDIGO DE BARRAS ─────────────────────────────────');
for (const p of withBarcode) {
  const ativo = p.active === false ? ' [INATIVO]' : '';
  console.log(`  [${p.category || 'sem cat'}]${ativo}  ${p.name}`);
  console.log(`    Código: ${p.barcode}  |  Preço: R$${(p.price||0).toFixed(2)}  |  Estoque: ${p.stock ?? 0}`);
}

console.log('\n── SEM CÓDIGO DE BARRAS ─────────────────────────────────');
for (const p of withoutBarcode) {
  const ativo = p.active === false ? ' [INATIVO]' : '';
  console.log(`  [${p.category || 'sem cat'}]${ativo}  ${p.name}`);
  console.log(`    ID: ${p.id}  |  Preço: R$${(p.price||0).toFixed(2)}  |  Estoque: ${p.stock ?? 0}`);
}

console.log('\n');
