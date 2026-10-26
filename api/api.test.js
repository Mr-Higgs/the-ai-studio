import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

process.env.STUDIO_SECRET_KEY ||= 'a'.repeat(64);

import { enc, dec } from './_lib/secrets.js';
import { cleanCalendar, cleanExperiments, cleanPosts, fieldMtime } from './_lib/business.js';
import { buildContext, contextParts, partHashes, changedParts, offerSkill, applyStructuredOutput, sessionPrompt, hashOf, OUTPUT_CONTRACT } from './_lib/prompts.js';
import { experimentStats } from '../ui/web/src/experiments.js';
import { SCORE_EXPERIMENTS, STEPS, setSprint } from '../ui/web/src/steps.js';
import { validProject, isBusy } from './index.js';

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

test('cleanExperiments sanitizes and caps experiment data', () => {
  const data = [
    { id: ' e1 ', name: ' Test ', hypothesis: ` ${'x'.repeat(510)} `, cost: '12.5', spent: '', target: 'not a number', maxCac: '4', status: 'bad' },
    { id: '', name: 'missing id' },
    { id: 'e2', name: '  ' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `e${i + 3}`, name: `Item ${i}` })),
  ];
  const result = cleanExperiments(data);
  assert.equal(result.items.length, 8);
  assert.deepEqual(result.items[0], {
    id: 'e1', name: 'Test', campaignId: null, hypothesis: 'x'.repeat(500), channel: '', cost: 12.5, spent: null,
    metric: '', target: null, maxCac: 4, rule: '', status: 'running', verdict: '',
  });
  assert.equal(result.issues, 3);
  assert.deepEqual(cleanExperiments(null), { items: null, issues: 0 });
  assert.deepEqual(cleanExperiments([
    { id: 'linked', name: 'Linked', campaignId: '123456' },
    { id: 'invalid', name: 'Invalid', campaignId: 'abc' },
  ]).items.map(item => item.campaignId), ['123456', null]);
});

test('cleanPosts sanitizes, caps at 60 and only keeps valid video links', () => {
  const data = [
    { id: ' facebook-1 ', channel: ' Facebook ', phase: ' Launch ', title: ' T ', hook: 'H', body: 'B', cta: 'C', hashtags: [' a ', '', 'b', 7], video: { project: 'promo', file: 'heygen-1.mp4' } },
    { id: 'ig-1', channel: 'Instagram', video: { project: 'p' } }, // no file → dropped
    { id: 'ig-2', channel: 'Instagram', video: 'nope' },
    { id: '', channel: 'x' },
    null,
  ];
  const r = cleanPosts(data);
  assert.equal(r.items.length, 3);
  assert.equal(r.issues, 2);
  assert.deepEqual(r.items[0], {
    id: 'facebook-1', channel: 'Facebook', phase: 'Launch', title: 'T', hook: 'H', body: 'B', cta: 'C',
    hashtags: ['a', 'b'], video: { project: 'promo', file: 'heygen-1.mp4' },
  });
  assert.ok(!('video' in r.items[1]));
  assert.equal(cleanPosts(Array.from({ length: 70 }, (_, i) => ({ id: `p${i}`, channel: 'C' }))).items.length, 60);
  assert.deepEqual(cleanPosts(null), { items: null, issues: 0 });
  assert.deepEqual(cleanPosts({}), { items: null, issues: 1 });
});

test('fieldMtime prefers the per-field timestamp and falls back to updated_at', () => {
  const biz = { profile: { name: 'A' }, calendar: [], updated_at: '2026-01-01T00:00:00Z', profile_updated_at: '2026-02-02T00:00:00Z' };
  assert.equal(fieldMtime(biz, 'profile'), Date.parse('2026-02-02T00:00:00Z'));
  assert.equal(fieldMtime(biz, 'calendar'), Date.parse('2026-01-01T00:00:00Z'));
  assert.equal(fieldMtime(biz, 'tracker'), null);
});

test('buildContext inlines profile, docs and calendar with truncation', () => {
  const big = 'x'.repeat(41000);
  const biz = { profile: { name: 'A' }, inputs: { offer: { sell: 'candles' } }, calendar: [{ date: '2026-01-01', title: 't' }] };
  const ctx = buildContext(biz, { offer: { content: big }, strategy: { content: 'small' } });
  assert.match(ctx, /Business profile \(JSON\): \{"name":"A"\}/);
  assert.match(ctx, /### offer\.md/);
  assert.match(ctx, /\(truncated\)/);
  assert.match(ctx, /### strategy\.md\nsmall/);
  assert.match(ctx, /### calendar\.json/);
  assert.ok(ctx.length < 60000);
  assert.ok(!buildContext(biz, {}).includes('### offer'));
});

test('context parts retain buildContext ordering and hash per part', () => {
  const biz = { profile: { name: 'A' }, inputs: { x: 1 }, tracker: [{ id: 1 }], experiments: [{ id: 'e1', name: 'Test' }], calendar: [{ date: '2026-01-01', title: 't' }] };
  const docs = { offer: { content: 'Offer' }, strategy: { content: 'Strategy' } };
  const parts = contextParts(biz, docs);
  assert.equal(buildContext(biz, docs), parts.map(part => part.text).join('\n\n'));
  assert.deepEqual(parts.map(part => part.key), ['profile', 'inputs', 'tracker', 'experiments', 'doc:offer', 'doc:strategy', 'calendar']);
  const withLead = contextParts({ ...biz, leadFormUrl: 'https://x/api/lead/abc' }, docs);
  assert.ok(withLead.some(part => part.key === 'leadForm' && part.text.includes('https://x/api/lead/abc')));
  assert.ok(!parts.some(part => part.key === 'leadForm'));
  assert.ok(parts.find(part => part.key === 'experiments').text.startsWith('Growth experiments (JSON): '));
  const hashes = partHashes(parts);
  const edited = contextParts({ ...biz, tracker: [{ id: 2 }] }, docs);
  const changed = partHashes(edited);
  assert.equal(changed.tracker === hashes.tracker, false);
  assert.equal(changed.profile, hashes.profile);
  assert.equal(changed['doc:offer'], hashes['doc:offer']);
});

test('changedParts returns only edited nonempty context and can skip Brain', () => {
  const original = contextParts({ profile: {}, brain: { answers: { campaignSpend: { v: '100', s: 'known' } } } }, { offer: { content: 'old' } });
  const hashes = partHashes(original);
  assert.deepEqual(changedParts(original, hashes), []);
  const edited = contextParts({ profile: {}, brain: { answers: { campaignSpend: { v: '200', s: 'known' } } } }, { offer: { content: 'new' } });
  assert.deepEqual(changedParts(edited, hashes).map(part => part.key), ['brain', 'doc:offer']);
  assert.deepEqual(changedParts(edited, hashes, { skip: ['brain'] }).map(part => part.key), ['doc:offer']);
  assert.deepEqual(changedParts([{ key: 'doc:offer', text: 'new' }], {}).map(part => part.key), ['doc:offer']);
});

test('offerSkill bundles all files with cloud-safe instructions', () => {
  const contents = {
    'SKILL.md': 'SKILL BODY',
    'references/framework.md': 'FRAMEWORK BODY',
    'templates/offer-doc.md': 'TEMPLATE BODY',
  };
  const skill = offerSkill(file => contents[file]);
  for (const value of Object.values(contents)) assert.ok(skill.includes(value));
  assert.match(skill, /Don't try to read or save files/);
  assert.match(skill, /return the document as offer\.md in the structured output/);
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

test('applyStructuredOutput accepts experiments and rejects unknown files', () => {
  const experiment = { id: 'e1', name: 'Test', cost: '8', status: 'running' };
  const result = applyStructuredOutput({ files: { 'experiments.json': [experiment], 'unknown.json': [] } });
  assert.equal(result.experiments[0].cost, 8);
  assert.deepEqual(result.docs, {});
  assert.equal(applyStructuredOutput({ files: { 'unknown.json': [] } }), null);
  assert.ok(OUTPUT_CONTRACT.includes('experiments.json'));
});

test('applyStructuredOutput accepts posts.json and context exposes posts', () => {
  const post = { id: 'fb-1', channel: 'Facebook', hook: 'H', body: 'B', hashtags: ['x'], extra: 'dropped' };
  const r = applyStructuredOutput({ files: { 'posts.json': [post, { nope: 1 }] } });
  assert.equal(r.posts.length, 1);
  assert.equal(r.posts[0].id, 'fb-1');
  assert.ok(!('extra' in r.posts[0]));
  assert.ok(OUTPUT_CONTRACT.includes('posts.json'));
  const parts = contextParts({ profile: {}, posts: [post] }, {});
  const part = parts.find(p => p.key === 'posts');
  assert.ok(part && part.text.startsWith('### posts.json\n') && part.text.includes('fb-1'));
  assert.ok(!contextParts({ profile: {} }, {}).some(p => p.key === 'posts'));
});

test('experimentStats groups tracker rows and leaves unknown acquisition cost blank', () => {
  const rows = [
    { experiment: 'e1', stage: 'Lead', value: 50 },
    { experiment: 'e1', stage: 'Won', value: '40' },
    { experiment: 'e1', stage: 'Won', value: '60' },
    { experiment: 'e2', stage: 'Won', value: 500 },
  ];
  assert.deepEqual(experimentStats({ id: 'e1', spent: 30 }, rows), { leads: 3, won: 2, revenue: 100, costPerCustomer: 15 });
  assert.equal(experimentStats({ id: 'e1', spent: null }, rows).costPerCustomer, null);
  assert.equal(experimentStats({ id: 'e1', spent: 30 }, rows.filter(row => row.stage !== 'Won')).costPerCustomer, null);
});

test('holiday strategy and calendar prompts match the pre-change snapshot', () => {
  setSprint('holiday');
  const strategy = STEPS.find(step => step.id === 'strategy');
  const calendar = STEPS.find(step => step.id === 'calendar');
  const strategyPrompt = strategy.prompt({}, strategy);
  const calendarPrompt = calendar.prompt({}, calendar);
  assert.equal(createHash('sha256').update(strategyPrompt).digest('hex'), '12cf2c3ca4612438bd290803162408c992d541df3723db86f166b77356417951');
  assert.equal(createHash('sha256').update(calendarPrompt).digest('hex'), '10dd0f5cf886634798c73cf067bacfdfac44a2ae750a3911f86124386320f4c6');
  assert.doesNotMatch(strategyPrompt, /experiments\.json/);
});

test('growth prompts include calculated targets, experiment linkage and scoring guidance', () => {
  setSprint('growth');
  const strategy = STEPS.find(step => step.id === 'strategy');
  const calendar = STEPS.find(step => step.id === 'calendar');
  const brain = {
    answers: { campaignSpend: { v: '200', s: 'known' } },
    items: [{ name: { v: 'Candle box', s: 'known' }, price: { v: '40', s: 'known' }, materials: { v: '10', s: 'known' }, hours: { v: '0', s: 'known' }, other: { v: '0', s: 'known' } }],
  };
  const strategyPrompt = strategy.prompt({}, strategy, { brain, profile: {} });
  assert.match(strategyPrompt, /experiments\.json/);
  assert.match(strategyPrompt, /App-calculated sprint targets:.*break-even:.*Candle box/);
  assert.match(strategyPrompt, /total planned cost within that budget/);
  assert.match(calendar.prompt({}, calendar), /"experiment": "<id>"/);
  assert.match(SCORE_EXPERIMENTS, /each tracker row's "experiment" field is an experiment id/);
  assert.match(SCORE_EXPERIMENTS, /Return the full updated experiments\.json/);
  assert.match(SCORE_EXPERIMENTS, /For organic Instagram experiments, use the Instagram organic results \(reach, views, interactions\) as the leading signal when the tracker has few leads\./);
  setSprint('holiday');
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

test('isBusy follows v3 status + status_detail', () => {
  for (const status of ['new', 'claimed', 'resuming']) assert.equal(isBusy({ status }), true);
  assert.equal(isBusy({ status: 'running', status_detail: 'working' }), true);
  assert.equal(isBusy({ status: 'running', status_detail: 'waiting_for_user' }), false);
  assert.equal(isBusy({ status: 'running', status_detail: 'finished' }), false);
  for (const status of ['suspended', 'exit', 'error']) assert.equal(isBusy({ status }), false);
});
