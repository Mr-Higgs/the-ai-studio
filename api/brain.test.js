import test from 'node:test';
import assert from 'node:assert/strict';
import { brainContext, brainMath, brainReady } from '../ui/web/src/brain.js';
import { buildContext, GROUNDING } from './_lib/prompts.js';
import { integrationNotes } from './index.js';

const a = (v, s = 'known') => ({ v, s });
const brain = {
  answers: {
    mix: a('Products'), rate: a('20'), weeks: a('4'), weekly: a('30'), committed: a('10', 'estimate'),
    overhead: a('433'), overheadIncluded: a('No'), campaignSpend: a('100'), profitTarget: a('500'),
    dates: a('Nov 20 – Dec 20'), priority: a('Profit'), discount: a('10'), minEarn: a('5'), upfront: a('300'),
  },
  items: [{ name: a('Gift box'), price: a('40'), materials: a('10'), hours: a('0.5'), other: a('2'), loss: a('10', 'estimate'), seasonal: a('0') }],
};

test('brainMath: earnings, discount, break-even, capacity', () => {
  const m = brainMath(brain);
  const it = m.items[0];
  assert.equal(it.purchases, 12);
  assert.equal(it.losses, 1.2);
  assert.equal(it.cashLeft, 26.8);   // 40 - 12 - 1.2
  assert.equal(it.labor, 10);        // 0.5h × $20
  assert.equal(it.earnings, 16.8);   // cash left minus owner pay
  assert.equal(it.discounted.earnings, 12.8); // at $36
  assert.equal(m.free, 20);
  assert.equal(m.capacity, 80);
  assert.ok(Math.abs(m.fixed - (433 * (4 / (52 / 12)) + 100)) < 0.01);
  assert.equal(it.breakEven, Math.ceil(m.fixed / 12.8));
  assert.equal(it.forTarget, Math.ceil((m.fixed + 500) / 12.8));
  assert.equal(it.fits, it.forTarget <= 80);
  assert.deepEqual(it.estimated, ['Losses / extra work (% of costs)']);
});

test('brainMath: flags losing offers and lists missing inputs', () => {
  const m = brainMath({ items: [{ price: a('10'), materials: a('12') }] });
  assert.equal(m.items[0].notProfitable, true);
  assert.ok(m.missing.includes('Hourly labor cost'));
  assert.ok(brainMath({}).missing.some(x => x.startsWith('Price and costs')));
});

test('brainReady needs the required sections', () => {
  assert.equal(brainReady({}, {}), false);
  assert.equal(brainReady(brain, { name: 'Juniper' }), true);
  assert.equal(brainReady(brain, {}), false);
});

test('brainContext keeps tags and feeds buildContext', () => {
  const c = brainContext(brain, { name: 'Juniper' });
  assert.match(c, /\[estimate\]/);
  assert.match(c, /Juniper/);
  assert.match(buildContext({ profile: { name: 'Juniper' }, brain }, {}), /## Business Brain/);
  assert.doesNotMatch(buildContext({ profile: {} }, {}), /Business Brain/);
  assert.match(GROUNDING, /Never invent testimonials/);
});

test('integrationNotes only mentions connected Meta servers', () => {
  assert.equal(integrationNotes({}), null);
  const n = integrationNotes({ meta_ads: true });
  assert.match(n, /mcp\.facebook\.com\/ads/);
  assert.match(n, /PAUSED/);
  assert.doesNotMatch(n, /devtools/);
});
