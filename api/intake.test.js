import test from 'node:test';
import assert from 'node:assert/strict';

import { INTAKE_FORM, INTAKE_FIELDS, intakeSummary } from '../ui/web/src/intake.js';
import { cleanIntake } from './_lib/intake.js';

const NOW = new Date('2026-03-04T12:00:00Z');

test('cleanIntake drops bad shapes, the honeypot, and missing/bad email', () => {
  assert.equal(cleanIntake(null), null);
  assert.equal(cleanIntake('junk'), null);
  assert.equal(cleanIntake({ answers: { email: 'a@b.co' }, company: 'bot' }), null); // honeypot
  assert.equal(cleanIntake({ answers: 'x' }), null);
  assert.equal(cleanIntake({ answers: { name: 'A' } }), null); // no email
  assert.equal(cleanIntake({ answers: { email: 'not-an-email' } }), null);
});

test('cleanIntake whitelists, coerces and caps', () => {
  const row = cleanIntake({
    form: 'forged',
    answers: {
      name: ' Jean ', email: ' jean@acme.com ', biz: 'Acme',
      bogus: 'x', b1: 'nope',
      pay: 'All upfront', urgency: '4',
      times: ['Mornings', 'Mornings', 'Never'],
      modules: ['website', 'ads', 'hacker'],
      more: 'x'.repeat(5000), decider: 'y'.repeat(400),
      site: 'acme.com', grant: '', when: 7,
    },
  }, NOW);
  assert.equal(row.form, 'rll-intake-v2');
  assert.equal(row.name, 'Jean');
  assert.equal(row.email, 'jean@acme.com');
  assert.equal(row.business, 'Acme');
  assert.ok(!('bogus' in row.answers));
  assert.ok(!('b1' in row.answers));
  assert.equal(row.answers.pay, 'All upfront');
  assert.equal(row.answers.urgency, 4);
  assert.deepEqual(row.answers.times, ['Mornings']);
  assert.deepEqual(row.answers.modules, ['website', 'ads']);
  assert.equal(row.answers.more.length, 4000);
  assert.equal(row.answers.decider.length, 300);
  assert.equal(row.answers.site, 'acme.com');
  assert.ok(!('grant' in row.answers));
  assert.ok(!('when' in row.answers));
  assert.match(row.summary, /Submitted 2026-03-04 12:00 UTC/);
});

test('cleanIntake scale keeps integers 1..5 only', () => {
  const base = { email: 'a@b.co' };
  assert.ok(!('urgency' in cleanIntake({ answers: { ...base, urgency: 9 } }).answers));
  assert.ok(!('urgency' in cleanIntake({ answers: { ...base, urgency: 2.5 } }).answers));
  assert.equal(cleanIntake({ answers: { ...base, urgency: 5 } }).answers.urgency, 5);
});

test('intakeSummary renders sections, cards labels and skips blanks', () => {
  const s = intakeSummary({ biz: 'Acme', name: 'Jean', email: 'j@a.co', modules: ['website', 'ads'], b1: '$750 to $1,500' }, NOW);
  assert.ok(s.startsWith('# Proposal intake: Acme'));
  assert.ok(s.includes('## Quick confirm'));
  assert.ok(s.includes('## What matters most?'));
  assert.ok(s.includes('**Wants help with:** Website, Ads'));
  assert.ok(s.includes('## Budget'));
  assert.ok(s.includes('**One-time budget to get set up:** $750 to $1,500'));
  assert.ok(!s.includes('## Timing and decisions'));
  assert.ok(s.split('**Business name:**').length - 1 <= 1);
});

test('INTAKE_FIELDS spec sanity', () => {
  const keys = INTAKE_FIELDS.map(f => f.k);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of ['name', 'email', 'biz']) assert.equal(INTAKE_FIELDS.find(f => f.k === k)?.req, 1, k);
  for (const f of INTAKE_FIELDS) if (['chips', 'multi', 'cards'].includes(f.t)) assert.ok(Array.isArray(f.opts) && f.opts.length, f.k);
});
