const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};

content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const auditedVars = [
  { name: 'GOOGLE_CLIENT_ID', purpose: 'Google OAuth Client ID' },
  { name: 'GOOGLE_CLIENT_SECRET', purpose: 'Google OAuth Client Secret' },
  { name: 'LINKEDIN_CLIENT_ID', purpose: 'LinkedIn OAuth Client ID' },
  { name: 'LINKEDIN_CLIENT_SECRET', purpose: 'LinkedIn OAuth Client Secret' },
  { name: 'SMTP_HOST', purpose: 'SMTP Server Host for email dispatch' },
  { name: 'SMTP_PORT', purpose: 'SMTP Server Port' },
  { name: 'SMTP_USER', purpose: 'SMTP Username' },
  { name: 'SMTP_PASS', purpose: 'SMTP Password' },
  { name: 'APP_BASE_URL', purpose: 'Canonical Frontend Base URL for email deep links & unsubscribe links' },
  { name: 'STORAGE_PROVIDER', purpose: 'Durable S3-compatible Resume Storage Provider' },
  { name: 'STORAGE_BUCKET', purpose: 'S3 Resume Storage Bucket' },
  { name: 'STORAGE_REGION', purpose: 'S3 Resume Storage Region' },
  { name: 'STORAGE_ACCESS_KEY', purpose: 'S3 Storage Access Key' },
  { name: 'STORAGE_SECRET_KEY', purpose: 'S3 Storage Secret Key' }
];

console.log('| Variable | Status | Purpose |');
console.log('|---|---|---|');
for (const v of auditedVars) {
  const val = env[v.name];
  let status = 'MISSING';
  if (val && val.length > 0) {
    if (val.includes('your_') || val.includes('placeholder') || val.includes('example')) {
      status = 'INVALID';
    } else {
      status = 'CONFIGURED';
    }
  }
  console.log(`| ${v.name} | ${status} | ${v.purpose} |`);
}
