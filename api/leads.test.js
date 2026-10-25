import test from 'node:test';
import assert from 'node:assert/strict';

import { leadToken, LEAD_TOKEN, MAX_TRACKER, cleanLead, appendLead, leadFormHtml } from './_lib/leads.js';

test('leadToken matches LEAD_TOKEN', () => {
  for (let i = 0; i < 5; i++) assert.match(leadToken(), LEAD_TOKEN);
  for (const bad of ['', 'xyz', 'a'.repeat(23), 'a'.repeat(25), 'A'.repeat(24)]) assert.ok(!LEAD_TOKEN.test(bad), bad);
});

test('cleanLead drops the honeypot and blank submissions', () => {
  assert.equal(cleanLead({ name: 'A', company: 'spam-bot' }), null);
  assert.equal(cleanLead({ name: '', contact: '  ' }), null);
  assert.equal(cleanLead(null), null);
  assert.equal(cleanLead('junk'), null);
});

test('cleanLead trims, caps, maps source and experiment', () => {
  const lead = cleanLead({
    name: '  ' + 'n'.repeat(300),
    contact: ' 555-1234 ',
    message: 'hello',
    source: 'Nonsense',
    experiment: 'e9',
    company: '',
  }, [{ id: 'e1' }], new Date('2026-03-04T12:00:00Z'));
  assert.equal(lead.name.length, 200);
  assert.equal(lead.contact, '555-1234');
  assert.equal(lead.notes, 'hello');
  assert.equal(lead.source, 'Website');
  assert.equal(lead.experiment, null);
  assert.equal(lead.stage, 'Lead');
  assert.match(lead.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(lead.date, '2026-03-04');
  assert.ok(lead.id);

  const kept = cleanLead({ name: 'A', source: 'Instagram', experiment: 'e1' }, [{ id: 'e1' }]);
  assert.equal(kept.source, 'Instagram');
  assert.equal(kept.experiment, 'e1');

  assert.equal(cleanLead({ contact: 'a@b.c' }).name, ''); // contact alone is fine
});

test('appendLead prepends and caps at MAX_TRACKER dropping Lost rows first', () => {
  const lead = { id: 'new' };
  assert.deepEqual(appendLead(null, lead), [lead]);
  assert.deepEqual(appendLead([{ id: 'old' }], lead).map(r => r.id), ['new', 'old']);

  const full = Array.from({ length: MAX_TRACKER }, (_, i) => ({ id: `r${i}`, stage: i % 10 === 0 ? 'Lost' : 'Won' }));
  const next = appendLead(full, { id: 'new', stage: 'Lead' });
  assert.equal(next.length, MAX_TRACKER);
  assert.equal(next[0].id, 'new');
  assert.ok(next.filter(r => r.stage === 'Lost').length < full.filter(r => r.stage === 'Lost').length);
  // Lost rows are dropped before non-Lost rows
  const lostCount = next.filter(r => r.stage === 'Lost').length;
  assert.equal(next.filter(r => r.stage !== 'Lost').length, MAX_TRACKER - lostCount);
  assert.ok(next.some(r => r.id === 'r1')) // first non-Lost row survives
});

test('leadFormHtml escapes the business name and carries the token', () => {
  const html = leadFormHtml({ business: 'Joe <script>alert(1)</script> & "Sons"', token: 'a'.repeat(24), exp: "e1'or", src: 'Instagram' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /Joe &lt;script&gt;/);
  assert.match(html, /&#39;/);
  assert.ok(html.includes(`action="/api/lead/${'a'.repeat(24)}"`));
  assert.ok(html.includes('name="company"')); // honeypot
  assert.match(html, /name="source" value="Instagram"/);
  // unknown src falls back to Website
  assert.match(leadFormHtml({ business: 'x', token: 'a'.repeat(24), exp: '', src: 'Nope' }), /name="source" value="Website"/);
});
