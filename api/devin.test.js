import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from './_lib/devin.js';

const creds = { key: 'k', org: 'o' };
const reply = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });

test('Devin api retries a short 429 then succeeds', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return calls.length === 1 ? reply(429, {}, { 'Retry-After': '0' }) : reply(200, { ok: 1 }); });
  assert.deepEqual(await api(creds, '/sessions/x'), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('Devin api surfaces a long 429 as a retryable 429', async t => {
  let n = 0;
  t.mock.method(globalThis, 'fetch', async () => { n++; return reply(429, {}, { 'Retry-After': '30' }); });
  await assert.rejects(api(creds, '/sessions/x'), e => e.status === 429 && e.retryAfter === 30 && /rate-limiting/.test(e.message));
  assert.equal(n, 1);
});

test('Devin creds: shared key only for allowlisted users, never mixed with saved values', async () => {
  const { pickDevinCreds, sharedDevinAllowed } = await import('./_lib/devin.js');
  const env = { DEVIN_API_KEY: 'srv-key', DEVIN_ORG_ID: 'srv-org', DEVIN_SHARED_USER_IDS: 'u-ok, u-two' };
  assert.deepEqual(pickDevinCreds({ key: 'mine', org: 'my-org' }, 'u-new', env), { key: 'mine', org: 'my-org', shared: false });
  assert.deepEqual(pickDevinCreds({}, 'u-ok', env), { key: 'srv-key', org: 'srv-org', shared: true });
  assert.deepEqual(pickDevinCreds(null, 'u-two', env), { key: 'srv-key', org: 'srv-org', shared: true });
  assert.throws(() => pickDevinCreds({}, 'u-new', env), e => e.status === 400);
  assert.throws(() => pickDevinCreds({ org: 'evil-org' }, 'u-new', env), e => e.status === 400);
  assert.throws(() => pickDevinCreds({ org: 'evil-org' }, 'u-ok', env), e => e.status === 400);
  assert.throws(() => pickDevinCreds({ key: 'mine' }, 'u-ok', env), e => e.status === 400);
  assert.throws(() => pickDevinCreds({}, 'u-ok', { DEVIN_API_KEY: 'k', DEVIN_ORG_ID: 'o' }), e => e.status === 400);
  assert.equal(sharedDevinAllowed('u-ok', { ...env, DEVIN_ORG_ID: '' }), false);
  assert.equal(sharedDevinAllowed('', { ...env, DEVIN_SHARED_USER_IDS: ',' }), false);
});
