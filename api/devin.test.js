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

test('Devin creds: only a saved key + org pair, never a server fallback', async () => {
  const { pickDevinCreds } = await import('./_lib/devin.js');
  const saved = process.env.DEVIN_API_KEY;
  process.env.DEVIN_API_KEY = 'srv-key'; process.env.DEVIN_ORG_ID = 'srv-org';
  try {
    assert.deepEqual(pickDevinCreds({ key: 'mine', org: 'my-org' }), { key: 'mine', org: 'my-org' });
    assert.throws(() => pickDevinCreds({}), e => e.status === 400 && /first/.test(e.message));
    assert.throws(() => pickDevinCreds(null), e => e.status === 400);
    assert.throws(() => pickDevinCreds({ org: 'evil-org' }), e => e.status === 400 && /both/.test(e.message));
    assert.throws(() => pickDevinCreds({ key: 'mine' }), e => e.status === 400 && /both/.test(e.message));
  } finally {
    if (saved === undefined) delete process.env.DEVIN_API_KEY; else process.env.DEVIN_API_KEY = saved;
    delete process.env.DEVIN_ORG_ID;
  }
});
