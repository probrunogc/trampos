import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const auth = admin.auth();
const db   = admin.firestore();

const name  = process.env.OP_NAME;
const email = process.env.OP_EMAIL;
const pin   = process.env.OP_PIN;
const role  = process.env.OP_ROLE || 'Vendedor';

if (!name || !email || !pin) {
  console.error('Missing OP_NAME, OP_EMAIL or OP_PIN');
  process.exit(1);
}
if (!/^\d{6}$/.test(pin)) {
  console.error('PIN must be exactly 6 digits');
  process.exit(1);
}

async function run() {
  // Check if user already exists
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    // Update password to new PIN
    await auth.updateUser(uid, { password: pin, displayName: name });
    console.log(`Updated existing user: ${email} (${uid})`);
  } catch {
    // Create new Firebase Auth user (PIN is the password)
    const record = await auth.createUser({
      email,
      password: pin,
      displayName: name,
    });
    uid = record.uid;
    console.log(`Created Auth user: ${email} (${uid})`);
  }

  // Upsert users/{uid}
  await db.collection('users').doc(uid).set({
    name,
    email,
    role: role.toLowerCase(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`Upserted users/${uid}`);

  // Find existing kiosk_op doc for this email and update, or create new
  const snap = await db.collection('settings')
    .where('_type', '==', 'kiosk_op')
    .where('email', '==', email)
    .get();

  const opData = {
    _type: 'kiosk_op',
    name,
    email,
    uid,
    role,
    active: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.empty) {
    await snap.docs[0].ref.set(opData, { merge: true });
    console.log(`Updated kiosk_op settings doc for ${email}`);
  } else {
    // Determine next order
    const allOps = await db.collection('settings').where('_type', '==', 'kiosk_op').get();
    opData.order = allOps.size;
    opData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('settings').add(opData);
    console.log(`Created kiosk_op settings doc: ${ref.id}`);
  }

  console.log(`\nOperador "${name}" (${email}) pronto! PIN: ${pin}`);
}

run().catch(err => { console.error(err); process.exit(1); });
