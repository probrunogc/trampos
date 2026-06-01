/**
 * Deploys firestore.rules via Firebase Rules REST API.
 * Uses the service account JSON from FIREBASE_SERVICE_ACCOUNT env var.
 * Run: node scripts/deploy-rules.mjs
 */
import { readFileSync } from 'fs';
import { createSign } from 'crypto';

const PROJECT = 'adegas-pf';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

function buildJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  return `${header}.${payload}.${sig}`;
}

async function getAccessToken() {
  const jwt = buildJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token error ${res.status}: ${text}`);
  return JSON.parse(text).access_token;
}

async function apiCall(token, method, path, body) {
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  console.log('Authenticating...');
  const token = await getAccessToken();
  console.log('Auth OK');

  const rules = readFileSync('./firestore.rules', 'utf8');

  console.log('Creating ruleset...');
  const { name: rulesetName } = await apiCall(token, 'POST',
    `projects/${PROJECT}/rulesets`,
    { source: { files: [{ name: 'firestore.rules', content: rules }] } }
  );
  console.log('Ruleset:', rulesetName);

  console.log('Updating release...');
  // PATCH with only the field we want to change (flat body, no wrapper)
  await apiCall(token, 'PATCH',
    `projects/${PROJECT}/releases/cloud.firestore?updateMask=rulesetName`,
    { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName }
  );

  console.log('Firestore rules deployed successfully.');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
