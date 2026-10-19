import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCalendar, exportMarkdown, formatHistoryItem } from './business.js';

test('cleanCalendar keeps renderable items and counts the rest', () => {
  const good = { date: '2026-11-20', title: 'Launch' };
  assert.deepEqual(cleanCalendar([good, { title: 'No date' }, null]), { items: [good], issues: 2 });
  assert.deepEqual(cleanCalendar(null), { items: null, issues: 0 });
  assert.deepEqual(cleanCalendar({}), { items: null, issues: 1 });
});

test('exportMarkdown includes a sample profile, document, and calendar', () => {
  const output = exportMarkdown({
    sprint: { name: 'Holiday Sprint' },
    profile: { name: 'Juniper & Wick', location: 'Austin' },
    docs: { offer: { content: '# Great offer\n' } },
    calendar: [{ date: '2026-11-20', channel: 'Instagram', format: 'Post', title: 'Launch', copy: 'Hello', cta: 'Shop now', status: 'posted' }],
  }, new Date('2026-10-19T12:00:00Z'));
  assert.match(output, /^# Holiday Sprint — Juniper & Wick/);
  assert.match(output, /\*\*location:\*\* Austin/);
  assert.match(output, /# Great offer/);
  assert.match(output, /Launch ✓/);
  assert.match(output, /_CTA:_ Shop now/);
  assert.ok(output.endsWith('\n'));
});

test('history item name uses UTC timestamp in the legacy filename format', () => {
  assert.deepEqual(formatHistoryItem({
    id: 42,
    file: 'action-plan',
    ext: 'md',
    created_at: '2026-10-19T18:30:12.987Z',
  }), { id: 42, name: 'action-plan-20261019T183012.md' });
});
