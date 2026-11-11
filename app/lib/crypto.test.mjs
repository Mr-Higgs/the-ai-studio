import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from './crypto.js';

const key = randomBytes(32).toString('base64');

test('encrypt/decrypt round trip uses the v1 AES-GCM format', () => {
  const ciphertext = encrypt('my private API key', key);
  assert.match(ciphertext, /^v1:[^:]+:[^:]+:[^:]+$/);
  assert.equal(decrypt(ciphertext, key), 'my private API key');
});

test('tampered ciphertext and a wrong key fail authentication', () => {
  const ciphertext = encrypt('secret value', key);
  const parts = ciphertext.split(':');
  parts[3] = `${parts[3].slice(0, -2)}AA`;
  assert.throws(() => decrypt(parts.join(':'), key), /Could not decrypt value/);
  assert.throws(() => decrypt(ciphertext, randomBytes(32).toString('base64')), /Could not decrypt value/);
});
