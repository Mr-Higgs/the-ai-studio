import test from 'node:test';
import assert from 'node:assert/strict';

process.env.STUDIO_SECRET_KEY ||= 'a'.repeat(64);

import { enc, dec } from './_lib/secrets.js';
import { cleanCalendar } from './_lib/business.js';
import { buildContext, applyStructuredOutput, sessionPrompt, hashOf, OUTPUT_CONTRACT } from './_lib/prompts.js';
import { validProject } from './index.js';

test('secrets round-trip AES-256-GCM', () => {
  const blob = enc('cog_secret_key_123');
  assert.match(blob, /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.ok(!blob.includes('cog_secret'));
  assert.equal(dec(blob), 'cog_secret_key_123');
  assert.notEqual(enc('x'), enc('x')); // random iv
  assert.throws(() => dec('garbage'));
});

test('cleanCalendar keeps renderable items and counts the rest', () => {
  const good = { date: '2026-11-20', title: 'Launch' };
  assert.deepEqual(cleanCalendar([good, { title: 'x' }, null]), { items: [good], issues: 2 });
  assert.deepEqual(cleanCalendar(null), { items: null, issues: 0 });
  assert.deepEqual(cleanCalendar({}), { items: null, issues: 1 });
});

test('buildContext inlines profile, docs and calendar with truncation', () => {
  const big = 'x'.repeat(13000);
  const biz = { profile: { name: 'A' }, inputs: { offer: { sell: 'candles' } }, calendar: [{ date: '2026-01-01', title: 't' }] };
  const ctx = buildContext(biz, { offer: { content: big }, strategy: { content: 'small' } });
  assert.match(ctx, /Business profile \(JSON\): \{"name":"A"\}/);
  assert.match(ctx, /### offer\.md/);
  assert.match(ctx, /\(truncated\)/);
  assert.match(ctx, /### strategy\.md\nsmall/);
  assert.match(ctx, /### calendar\.json/);
  assert.ok(ctx.length < 20000);
  assert.ok(!buildContext(biz, {}).includes('### offer'));
});

test('applyStructuredOutput validates files, cleans calendar, stable hash', () => {
  const so = { files: { 'offer.md': '# Offer', 'evil.md': 'x', 'calendar.json': [{ date: '2026-01-01', title: 't' }, { bad: 1 }], 'notes.txt': 'nope' }, summary: 's' };
  const r = applyStructuredOutput(so);
  assert.deepEqual(r.docs, { offer: '# Offer' });
  assert.equal(r.calendar.length, 1);
  assert.equal(r.issues, 1);
  assert.equal(r.hash, hashOf(so.files));
  assert.equal(applyStructuredOutput(null), null);
  assert.equal(applyStructuredOutput({ files: {} }), null);
  assert.equal(applyStructuredOutput({ files: { 'offer.md': 'x'.repeat(200001) } }), null);
});

test('sessionPrompt bundles skill, context, contract, request', () => {
  const p = sessionPrompt('CTX', 'write it', { skill: 'SKILL', extra: 'EXTRA' });
  assert.match(p, /^SKILL\n\nCTX/);
  assert.match(p, /structured output/);
  assert.match(p, /My request: write it$/);
  assert.ok(OUTPUT_CONTRACT.includes('calendar.json'));
});

test('project slugs', () => {
  for (const ok of ['demo', 'my-video-2']) assert.ok(validProject(ok), ok);
  for (const bad of ['', '_template', '../etc', 'A', 'a/b']) assert.ok(!validProject(bad), bad);
});
