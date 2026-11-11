import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey(encoded = process.env.APP_ENCRYPTION_KEY) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

export function encrypt(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decrypt(payload, key) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, ...rest] = String(payload).split(':');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || ciphertextEncoded == null || rest.length) {
    throw new Error('Invalid encrypted value');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(ivEncoded, 'base64'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Could not decrypt value');
  }
}
