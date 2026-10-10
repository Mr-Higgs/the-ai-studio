import test from 'node:test';
import assert from 'node:assert/strict';
import { validProject, projectFile, lineSplitter } from './server.mjs';

test('project names', () => {
  for (const ok of ['demo', 'my-video-2']) assert.ok(validProject(ok), ok);
  for (const bad of ['', '_template', '../etc', 'A', '-x', 'a/b', '.hidden']) assert.ok(!validProject(bad), bad);
});

test('project file paths stay inside raw/ and out/', () => {
  assert.match(projectFile('demo', 'raw', 'clip.mov'), /projects[\\/]demo[\\/]raw[\\/]clip\.mov$/);
  assert.ok(projectFile('demo', 'out', 'final.mp4'));
  for (const [n, sub, f] of [['demo', 'raw', '../x'], ['demo', 'raw', '/etc/passwd'], ['demo', 'raw', 'a/b.mov'],
    ['demo', 'raw', '.session'], ['demo', 'raw', ''], ['demo', 'edit', 'x.json'], ['../x', 'raw', 'a.mov']]) {
    assert.equal(projectFile(n, sub, f), null, `${n}/${sub}/${f}`);
  }
});

test('ACP line splitter rejoins frames split across chunks', () => {
  const got = [];
  const feed = lineSplitter(l => got.push(JSON.parse(l)));
  feed('{"id":1}\n{"id"');
  feed(':2}\n\n{"id":3');
  assert.deepEqual(got, [{ id: 1 }, { id: 2 }]);
  feed('}\n');
  assert.deepEqual(got.at(-1), { id: 3 });
});

import { BUSINESS_JSON, distFile } from './server.mjs';

test('business JSON whitelist', () => {
  for (const ok of ['profile.json', 'inputs.json', 'calendar.json', 'tracker.json']) assert.ok(BUSINESS_JSON.includes(ok));
  for (const bad of ['offer.md', '.session', '../package.json', '.agent']) assert.ok(!BUSINESS_JSON.includes(bad));
});

test('built frontend paths stay inside ui/dist', () => {
  assert.match(distFile('/'), /ui[\\/]dist[\\/]index\.html$/);
  assert.match(distFile('/assets/index-abc.js'), /ui[\\/]dist[\\/]assets[\\/]index-abc\.js$/);
  for (const bad of ['/assets/../server.mjs', '/assets/a/b.js', '/assets/.env', '/server.mjs', '/../package.json']) assert.equal(distFile(bad), null, bad);
});

import { cleanCalendar, SNAPSHOT_FILES, historyFile } from './server.mjs';

test('calendar keeps renderable items and counts the rest', () => {
  const good = { date: '2026-11-20', title: 'Launch' };
  assert.deepEqual(cleanCalendar([good, { title: 'no date' }, { date: 'Nov 20', title: 'x' }, null, 'str']), { items: [good], issues: 4 });
  assert.deepEqual(cleanCalendar(null), { items: null, issues: 0 });
  assert.deepEqual(cleanCalendar({ not: 'an array' }), { items: null, issues: 1 });
});

test('snapshots only for known business files; history paths stay put', () => {
  for (const ok of ['offer.md', 'research.md', 'calendar.json']) assert.ok(SNAPSHOT_FILES.includes(ok), ok);
  for (const bad of ['profile.json', 'tracker.json', '.session', '../x.md']) assert.ok(!SNAPSHOT_FILES.includes(bad), bad);
  assert.match(historyFile('offer-20261009T183012.md'), /business[\\/]history[\\/]offer-20261009T183012\.md$/);
  assert.match(historyFile('action-plan-20261009T183012.md'), /action-plan-/);
  for (const bad of ['../offer-20261009T183012.md', 'offer.md', '.offer-20261009T183012.md', 'offer-20261009T183012.sh', 'a/b-20261009T183012.md']) assert.equal(historyFile(bad), null, bad);
});

import { setupItems } from './server.mjs';

test('setup fixes match the participant OS', () => {
  const fix = (p, id) => setupItems(p).find(i => i.id === id).fix;
  assert.match(fix('darwin', 'devin'), /install\.sh \| bash/);
  assert.match(fix('win32', 'devin'), /^irm .*setup\.ps1 \| iex$/);
  assert.match(fix('win32', 'ffmpeg'), /^winget install/);
  assert.match(fix('darwin', 'ffmpeg'), /^brew install/);
  assert.match(fix('win32', 'elevenlabs'), /^copy /);
  for (const p of ['darwin', 'win32', 'linux']) {
    const items = setupItems(p);
    assert.deepEqual(items.filter(i => i.group === 'required').map(i => i.id), ['devin', 'devin-auth']);
    assert.ok(items.every(i => i.fix && i.why && i.name), p);
  }
});

import { HEYGEN_ID } from './server.mjs';

test('HeyGen ids are safe in URLs and filenames', () => {
  for (const ok of ['v_abc123', 'a1B2-c3']) assert.ok(HEYGEN_ID.test(ok), ok);
  for (const bad of ['', '../x', 'a/b', 'a.mp4', 'x'.repeat(65), 'a?b=1']) assert.ok(!HEYGEN_ID.test(bad), bad);
});

import { setEnvLine, ENV_VALUE, ENV_KEYS } from './server.mjs';

test('Setup key save edits one .env line and nothing else', () => {
  const env = 'ELEVENLABS_API_KEY=abc\nHEYGEN_API_KEY=old\n';
  assert.equal(setEnvLine(env, 'HEYGEN_API_KEY', 'n$&ew'), 'ELEVENLABS_API_KEY=abc\nHEYGEN_API_KEY=n$&ew\n');
  assert.equal(setEnvLine('A=1', 'HEYGEN_API_KEY', 'k'), 'A=1\nHEYGEN_API_KEY=k\n');
  assert.equal(setEnvLine('', 'HEYGEN_API_KEY', 'k'), 'HEYGEN_API_KEY=k\n');
  assert.ok(ENV_VALUE.test('sk_live-ABC.123=='));
  for (const bad of ['', 'short', 'a b c d e f g h', 'abcdefgh\nB=1', 'x'.repeat(257)]) assert.ok(!ENV_VALUE.test(bad), JSON.stringify(bad));
  assert.ok(!ENV_KEYS.includes('PATH'));
});
