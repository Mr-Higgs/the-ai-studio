import test from 'node:test';
import assert from 'node:assert/strict';
import { brainContext, brainMath, brainReady, cleanBrain, profileWithBrain } from '../ui/web/src/brain.js';
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

test('blank item costs are gaps, not $0', () => {
  const m = brainMath({ answers: { rate: a('20'), weeks: a('4') }, items: [{ name: a('Box'), price: a('40') }] });
  const it = m.items[0];
  assert.deepEqual(it.gaps, ['Materials per sale ($)', 'Labor per sale (hours)', 'Other costs per sale ($)']);
  assert.equal(it.breakEven, null);
  assert.equal(it.fits, null);
  assert.ok(m.missing.some(x => x.startsWith('Box:')));
  assert.match(brainContext({ answers: { rate: a('20') }, items: [{ name: a('Box'), price: a('40') }] }, {}), /INCOMPLETE/);
  const zeros = brainMath({ answers: { rate: a('20') }, items: [{ price: a('40'), materials: a('0'), hours: a('0'), other: a('0') }] });
  assert.deepEqual(zeros.items[0].gaps, []);
});

test('overhead without campaign length leaves fixed costs unknown', () => {
  const m = brainMath({ answers: { overhead: a('500') }, items: [{ price: a('40'), materials: a('10'), hours: a('0'), other: a('0') }] });
  assert.equal(m.overheadShare, null);
  assert.equal(m.fixed, null);
  assert.equal(m.items[0].breakEven, null);
  assert.match(brainContext({ answers: { overhead: a('500') } }, {}), /UNKNOWN/);
  assert.equal(brainMath({ answers: { overhead: a('500'), overheadIncluded: a('Yes') } }).fixed, 0);
});

test('cleanBrain drops malformed data instead of breaking reads', () => {
  const bad = { answers: { rate: 'x', weeks: { v: { evil: 1 }, s: 'nope' }, bogus: a('1'), dates: a(['a', 2, 'b']) }, items: [null, 5, { price: { v: 12 } }, {}, {}] };
  assert.deepEqual(cleanBrain(bad), { answers: { dates: { v: ['a', 'b'], s: 'known' } }, items: [{ price: { v: '12' } }] });
  assert.deepEqual(cleanBrain('junk'), { answers: {}, items: [] });
  assert.doesNotThrow(() => brainContext({ answers: 7, items: 'x' }, null));
  assert.doesNotThrow(() => brainMath(null));
});

test('profile time, monthly costs and customer numbers feed the math', () => {
  const profile = { price: '$40', hoursWeek: '40', payGoal: '48000', rate: '20', revenueMonth: '6000', laborMonth: '0', materialsMonth: '1500', overhead: '500', cac: '30', buysPerYear: '3', years: '2' };
  const m = brainMath({ items: [{ name: a('Box'), price: a('40'), materials: a('10'), hours: a('0.5'), other: a('2') }] }, profile);
  assert.equal(m.rate, 20);                 // read from the profile now
  assert.equal(m.goalRate, 25);             // 48000 / (40 × 48)
  assert.equal(m.monthCosts, 2000);
  assert.equal(m.monthLeft, 4000);
  assert.equal(m.earnedRate, Math.round(4000 / (40 * 52 / 12) * 100) / 100);
  assert.equal(m.monthForGoal, 6000);
  assert.equal(m.ltv, 240);                 // $40 × 3 × 2
  assert.equal(m.ltvCalculated, true);
  assert.equal(m.ltvCac, 8);
  assert.equal(m.items[0].earnings, 18);    // 40 - 12 - 10
  assert.equal(m.items[0].firstSale, -12);  // minus $30 CAC
  assert.equal(m.items[0].firstSaleLoses, true);
  const c = brainContext({}, profile);
  assert.match(c, /works out to \$25\/hour — more than the \$20\/hour labor allowance/);
  assert.match(c, /Monthly break-even is \$2,000/);
  assert.match(c, /LTV:CAC = 8/);
});

test('blank monthly costs stay unknown; old Brain answers carry into the profile', () => {
  assert.equal(brainMath({}, { revenueMonth: '6000', materialsMonth: '1500', overhead: '500' }).monthCosts, null);
  assert.equal(brainMath({ answers: { rate: a('22'), ltv: a('300') } }, {}).rate, 22);
  assert.equal(brainMath({ answers: { rate: a('22') } }, { rate: '' }).rate, null);
  assert.deepEqual(profileWithBrain({ name: 'J' }, { answers: { rate: a('22'), cac: a('') } }), { name: 'J', rate: '22' });
});
