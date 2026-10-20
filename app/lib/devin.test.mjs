import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevinApi, mapDevinMessages, maxAcuLimit, publicConversation } from './devin-api.js';
import { getAgentDocTarget } from './agent-docs.js';
import { authenticateStudioToken, createStudioToken, hashStudioToken, STUDIO_TOKEN_TTL_MS } from './devin-tokens.js';
import { buildDevinPrompt, devinPreamble } from './devin-prompts.js';
import { GRAND_SLAM_OFFER_SKILL } from './grand-slam-offer.js';
import { STEPS } from '../src/studio/steps.js';

const response = payload => ({ ok: true, json: async () => payload });

test('create session uses the documented organization URL, bearer auth, ACU field, and sensitive secret', async () => {
  const calls = [];
  const apiKey = 'cog_test_pat';
  const studioToken = 'studio_token_value';
  const client = createDevinApi({
    apiKey,
    orgId: 'org-test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ session_id: 'devin-session', status: 'new', url: 'https://app.devin.ai/sessions/devin-session' });
    },
  });

  const result = await client.createSession({
    prompt: 'Preamble with the $STUDIO_TOKEN placeholder; no secret value.',
    maxAcu: maxAcuLimit({ devin_max_acu: 17 }),
    sessionToken: studioToken,
    title: 'Offer step',
  });

  assert.equal(calls[0].url, 'https://api.devin.ai/v3/organizations/org-test/sessions');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.max_acu_limit, 17);
  assert.equal(maxAcuLimit({}), 5);
  assert.equal(payload.title, 'Offer step');
  assert.equal(payload.prompt.includes(studioToken), false);
  assert.equal(payload.prompt.includes(apiKey), false);
  assert.deepEqual(payload.session_secrets, [{ key: 'STUDIO_TOKEN', value: studioToken, sensitive: true }]);
  assert.deepEqual(result, {
    session_id: 'devin-session',
    status: 'new',
    url: 'https://app.devin.ai/sessions/devin-session',
  });
});

test('session lookup and message calls use v3 paths, pagination fields, and message request shape', async () => {
  const calls = [];
  const pages = [
    { items: [{ source: 'user', message: 'Hello', created_at: 1700000000 }], has_next_page: true, end_cursor: 'cursor-1' },
    { items: [{ source: 'devin', message: 'Hi', created_at: 1700000001 }], has_next_page: false, end_cursor: null },
  ];
  const client = createDevinApi({
    apiKey: 'cog_secret',
    orgId: 'org-42',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/messages') && options.method === 'POST') return response({ ok: true });
      if (url.includes('/messages?')) return response(pages.shift());
      return response({ session_id: 'devin-abc', status: 'running', url: 'https://app.devin.ai/sessions/devin-abc' });
    },
  });

  const session = await client.getSession('devin-abc');
  const messages = await client.listMessages('devin-abc');
  await client.sendMessage('devin-abc', 'Write the offer.');

  assert.equal(session.status, 'running');
  assert.equal(calls[0].url, 'https://api.devin.ai/v3/organizations/org-42/sessions/devin-abc');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer cog_secret');
  const firstPage = new URL(calls[1].url);
  const secondPage = new URL(calls[2].url);
  assert.equal(firstPage.searchParams.get('first'), '200');
  assert.equal(firstPage.searchParams.has('after'), false);
  assert.equal(secondPage.searchParams.get('after'), 'cursor-1');
  assert.equal(secondPage.searchParams.get('first'), '200');
  assert.deepEqual(mapDevinMessages(messages.items), [
    { role: 'user', text: 'Hello', created_at: 1700000000 },
    { role: 'devin', text: 'Hi', created_at: 1700000001 },
  ]);
  assert.equal(calls[3].url, 'https://api.devin.ai/v3/organizations/org-42/sessions/devin-abc/messages');
  assert.deepEqual(JSON.parse(calls[3].options.body), { message: 'Write the offer.' });
});

test('session tokens are random, hashed, expire in 24 hours, and reject unknown or expired credentials', async () => {
  const now = Date.parse('2026-10-20T12:00:00.000Z');
  const created = createStudioToken(now);
  assert.equal(Buffer.from(created.token, 'base64url').length, 32);
  assert.equal(created.token_hash, hashStudioToken(created.token));
  assert.equal(created.token_hash.length, 64);
  assert.equal(Date.parse(created.token_expires_at), now + STUDIO_TOKEN_TTL_MS);

  let lookedUpHash;
  const valid = await authenticateStudioToken(`Bearer ${created.token}`, async hash => {
    lookedUpHash = hash;
    return { id: 'conversation-id', token_expires_at: created.token_expires_at };
  }, now);
  assert.equal(lookedUpHash, created.token_hash);
  assert.equal(valid.status, 200);
  assert.equal(valid.conversation.id, 'conversation-id');

  const expired = await authenticateStudioToken(`Bearer ${created.token}`, async () => ({
    id: 'expired',
    token_expires_at: new Date(now).toISOString(),
  }), now);
  assert.equal(expired.status, 401);
  assert.equal(expired.conversation, null);

  const unknown = await authenticateStudioToken(`Bearer ${created.token}`, async () => null, now);
  assert.equal(unknown.status, 401);
  assert.equal(unknown.conversation, null);
});

test('agent document writes only allow step documents and profile.json', () => {
  assert.deepEqual(getAgentDocTarget('offer.md'), { kind: 'document', id: 'offer' });
  assert.deepEqual(getAgentDocTarget('action-plan.md'), { kind: 'document', id: 'action-plan' });
  assert.deepEqual(getAgentDocTarget('profile.json'), { kind: 'profile' });
  assert.equal(getAgentDocTarget('tracker.json'), null);
  assert.equal(getAgentDocTarget('private.md'), null);
  assert.equal(getAgentDocTarget('../offer.md'), null);
});

test('client conversation response never exposes the PAT or session token hash', () => {
  const pat = 'cog_never_return_this';
  const safe = publicConversation({
    id: 'conversation-id',
    title: 'Offer step',
    status: 'running',
    url: 'https://app.devin.ai/sessions/devin-abc',
    created_at: '2026-10-20T12:00:00.000Z',
    updated_at: '2026-10-20T12:00:00.000Z',
    token_hash: pat,
    ciphertext: pat,
    devin_session_id: pat,
  });
  const body = JSON.stringify({ conversation: safe });
  assert.equal(body.includes(pat), false);
  assert.deepEqual(Object.keys(safe).sort(), ['created_at', 'id', 'status', 'title', 'updated_at', 'url']);
});

test('Devin preamble and workshop prompts route data through the app API', () => {
  const preamble = devinPreamble('https://studio.example');
  assert.match(preamble, /https:\/\/studio\.example\/api\/agent/);
  assert.match(preamble, /Authorization: Bearer \$STUDIO_TOKEN/);
  assert.match(preamble, /never print, echo or log it/);
  assert.match(preamble, /PUT \/docs\/<file>/);
  assert.match(preamble, /PUT \/calendar/);

  const offer = STEPS.find(step => step.id === 'offer');
  const prompt = offer.prompt({}, offer);
  assert.match(prompt, /First GET \/context from the app API/);
  assert.match(prompt, /grand-slam-offer skill \(included below\)/);
  assert.ok(prompt.includes('## grand-slam-offer skill\n<!-- studio:include-grand-slam-offer -->'));
  assert.ok(prompt.includes('Save the result as Markdown to offer.md through the app API (PUT /docs/offer.md).'));
  assert.ok(!GRAND_SLAM_OFFER_SKILL.startsWith('---'));
  const expandedPrompt = buildDevinPrompt(prompt, 'https://studio.example');
  assert.ok(expandedPrompt.includes(`## grand-slam-offer skill\n${GRAND_SLAM_OFFER_SKILL}`));
  assert.equal(expandedPrompt.includes('studio:include-grand-slam-offer'), false);

  const calendar = STEPS.find(step => step.id === 'calendar');
  assert.match(calendar.prompt({}, calendar), /Save it as JSON through the app API \(PUT \/calendar\):/);
});
