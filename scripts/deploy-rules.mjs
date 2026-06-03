/**
 * Deploys firestore.rules via Firebase Rules REST API.
 * Uses the service account JSON from FIREBASE_SERVICE_ACCOUNT env var.
 * Run: node scripts/deploy-rules.mjs
 */
import { readFileSync } from 'fs';
import { createSign } from 'crypto';

const PROJECT = 'adegas-pf';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Build a signed JWT for Google OAuth2
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
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  console.log('Authenticating...');
  const token = await getAccessToken();

  const rules = readFileSync('./firestore.rules', 'utf8');
  console.log('Creating ruleset...');

  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rules }] } })
    }
  );
  if (!createRes.ok) throw new Error(`Create ruleset failed: ${await createRes.text()}`);
  const { name: rulesetName } = await createRes.json();
  console.log('Ruleset created:', rulesetName);

  console.log('Releasing...');
  const releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        release: {
          name: `projects/${PROJECT}/releases/cloud.firestore`,
          rulesetName
        }
      })
    }
  );
  if (!releaseRes.ok) throw new Error(`Release failed: ${await releaseRes.text()}`);
  console.log('Firestore rules deployed successfully.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
