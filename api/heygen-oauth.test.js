import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { pkce, randomState, publicOrigin, redirectUri, registerClient, buildAuthorizeUrl, exchangeCode, toStored, RESOURCE } from './_lib/heygen-oauth.js';

test('pkce produces a base64url verifier and a sha256 challenge', () => {
  const { verifier, challenge } = pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(pkce().verifier, verifier);
  assert.match(randomState(), /^[A-Za-z0-9_-]+$/);
});

test('redirectUri honours forwarded headers and localhost', () => {
  assert.equal(redirectUri({ headers: { 'x-forwarded-host': 'studio.example.com', 'x-forwarded-proto': 'https' } }),
    'https://studio.example.com/api/heygen/oauth/callback');
  assert.equal(redirectUri({ headers: { host: 'localhost:4321' } }),
    'http://localhost:4321/api/heygen/oauth/callback');
  assert.equal(redirectUri({ headers: { host: 'studio.example.com' } }),
    'https://studio.example.com/api/heygen/oauth/callback');
  assert.equal(publicOrigin({ headers: { 'x-forwarded-host': 'a.com', host: 'internal' } }), 'https://a.com');
});

test('buildAuthorizeUrl carries code + PKCE + resource params', () => {
  const url = buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x/cb', state: 'st', challenge: 'ch' });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://app.heygen.com/oauth/authorize');
  for (const [k, v] of Object.entries({
    response_type: 'code', client_id: 'cid', redirect_uri: 'https://x/cb',
    scope: 'openid', state: 'st', code_challenge: 'ch', code_challenge_method: 'S256',
    resource: 'https://api.heygen.com',
  })) assert.equal(u.searchParams.get(k), v, k);
  assert.ok(url.includes('resource=https%3A%2F%2Fapi.heygen.com'));
});

test('exchangeCode posts form-encoded grant fields and surfaces error_description', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (u, opts) => { calls.push({ u, opts }); return { ok: true, json: async () => ({ access_token: 'at', expires_in: 60 }) }; };
  try {
    const t = await exchangeCode({ clientId: 'cid', code: 'CODE', verifier: 'VER', redirectUri: 'https://x/cb' });
    assert.equal(t.access_token, 'at');
    const body = new URLSearchParams(calls[0].opts.body);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'CODE');
    assert.equal(body.get('code_verifier'), 'VER');
    assert.equal(body.get('resource'), RESOURCE);
    assert.equal(body.get('client_id'), 'cid');
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'code expired' }) });
    await assert.rejects(exchangeCode({ clientId: 'c', code: 'x', verifier: 'v', redirectUri: 'r' }), /code expired/);
  } finally { globalThis.fetch = realFetch; }
});

test('registerClient returns the env client id without fetching', async () => {
  const realFetch = globalThis.fetch, prev = process.env.HEYGEN_OAUTH_CLIENT_ID;
  process.env.HEYGEN_OAUTH_CLIENT_ID = 'env-client';
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  try {
    assert.equal(await registerClient('https://x/cb'), 'env-client');
  } finally { globalThis.fetch = realFetch; prev === undefined ? delete process.env.HEYGEN_OAUTH_CLIENT_ID : process.env.HEYGEN_OAUTH_CLIENT_ID = prev; }
});

test('toStored computes expires_at and keeps the previous refresh_token', () => {
  const before = Date.now();
  const s = toStored({ access_token: 'a', expires_in: 100 }, 'cid', { refresh_token: 'old-rt', scope: 'openid' });
  assert.equal(s.refresh_token, 'old-rt');
  assert.ok(s.expires_at >= before + 100000 && s.expires_at <= Date.now() + 100000);
  assert.equal(s.scope, 'openid');
  const s2 = toStored({ access_token: 'a2', refresh_token: 'new-rt' }, 'cid', { refresh_token: 'old-rt' });
  assert.equal(s2.refresh_token, 'new-rt');
});
