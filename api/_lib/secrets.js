import crypto from 'node:crypto';

// Per-user secrets (Devin/HeyGen keys) stored AES-256-GCM encrypted in user_settings.
const key = () => {
  const k = process.env.STUDIO_SECRET_KEY;
  if (!/^[0-9a-f]{64}$/i.test(k || '')) throw new Error('STUDIO_SECRET_KEY must be 64 hex chars');
  return Buffer.from(k, 'hex');
};
export function enc(str) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(str), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map(x => x.toString('base64')).join(':'); // "iv:tag:ct"
}
export function dec(blob) {
  const [iv, tag, ct] = String(blob).split(':').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
