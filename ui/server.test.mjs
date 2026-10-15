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
  for (const ok of ['profile.json', 'inputs.json', 'calendar.json', 'tracker.json', 'sprint.json']) assert.ok(BUSINESS_JSON.includes(ok));
  for (const bad of ['offer.md', '.session', '.sessions.json', '../package.json', '.agent']) assert.ok(!BUSINESS_JSON.includes(bad));
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

import { setupItems, hasSubtitlesFilter } from './server.mjs';

test('ffmpeg -filters output: subtitles filter detection', () => {
  const withSub = 'Filters:\n T.. crop               V->V       Crop the input video.\n T.C subtitles         N->V       Render text subtitles onto input video using the libass library.\n';
  const without = 'Filters:\n T.. crop               V->V       Crop the input video.\n ..C drawtext          V->V       Draw text (not subtitles) on top of video frames.\n';
  assert.ok(hasSubtitlesFilter(withSub));
  assert.ok(!hasSubtitlesFilter(without));
});

test('setup fixes match the participant OS', () => {
  const fix = (p, id) => setupItems(p).find(i => i.id === id).fix;
  assert.match(fix('darwin', 'devin'), /install\.sh \| bash/);
  assert.match(fix('win32', 'devin'), /^irm .*setup\.ps1 \| iex$/);
  assert.match(fix('win32', 'ffmpeg'), /^winget install/);
  assert.match(fix('darwin', 'ffmpeg'), /^brew install/);
  assert.match(fix('win32', 'elevenlabs'), /^copy /);
  const refix = (p, id) => setupItems(p).find(i => i.id === id).refix;
  assert.match(refix('darwin', 'ffmpeg'), /^brew reinstall/);
  assert.match(refix('win32', 'ffmpeg'), /^winget install/);
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

import { parseMcpList, safeTarget, readPluginManifests } from './server.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('devin mcp list output parses into entries', () => {
  const text = `Configured MCP servers:

  • grok
    Command: node /Users/x/stdio.js

  • supabase-mcp-server
    URL: https://mcp.supabase.com/mcp

  • fullenrich
    URL: https://mcp.fullenrich.com/mcp

  • MCP_DOCKER (disabled)
    Command: docker mcp gateway run
`;
  const mcp = parseMcpList(text);
  assert.equal(mcp.length, 4);
  assert.deepEqual(mcp[0], { name: 'grok', kind: 'command', target: 'node /Users/x/stdio.js', disabled: false });
  assert.deepEqual(mcp[1], { name: 'supabase-mcp-server', kind: 'url', target: 'https://mcp.supabase.com/mcp', disabled: false });
  assert.equal(mcp[2].kind, 'url');
  assert.equal(mcp[3].name, 'MCP_DOCKER');
  assert.equal(mcp[3].disabled, true);
  assert.equal(mcp[3].kind, 'command');
  assert.deepEqual(parseMcpList(''), []);
  assert.deepEqual(parseMcpList('No MCP servers configured.\n'), []);
});

test('safeTarget never leaks args, env values or query strings', () => {
  assert.equal(safeTarget('command', 'node /x/stdio.js --token abc'), 'node stdio.js');
  assert.equal(safeTarget('command', 'docker mcp gateway run'), 'docker mcp');
  assert.equal(safeTarget('command', 'npx'), 'npx');
  assert.equal(safeTarget('command', '/Users/x/bin/server foo'), 'server foo');
  assert.equal(safeTarget('url', 'https://mcp.supabase.com/mcp?read_only=true'), 'https://mcp.supabase.com/mcp');
  assert.equal(safeTarget('url', 'https://user:tok@mcp.example.com/a/b#frag?x=1'), 'https://mcp.example.com/a/b');
  assert.equal(safeTarget('url', 'https://mcp.notion.com/mcp'), 'https://mcp.notion.com/mcp');
  assert.equal(safeTarget('url', 'not a url?key=abc'), 'not a url');
});

test('readPluginManifests scans cache dirs and skips bad manifests', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugins-'));
  const mk = (slug, sub, manifest, skills = []) => {
    const dir = path.join(tmp, slug, '0.0.1');
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    fs.writeFileSync(path.join(dir, sub, 'plugin.json'), manifest);
    for (const s of skills) fs.mkdirSync(path.join(dir, 'skills', s), { recursive: true });
  };
  mk('devin-one', '.devin-plugin', JSON.stringify({ name: 'one', displayName: 'One', description: 'd', homepage: 'https://x', keywords: ['k'], mcpServers: { m: {} } }));
  mk('claude-two', '.claude-plugin', JSON.stringify({ name: 'two' }), ['a', 'b']);
  fs.mkdirSync(path.join(tmp, 'broken', '1.0'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'broken', '1.0', 'plugin.json'), '{nope');
  const plugins = readPluginManifests(tmp);
  assert.equal(plugins.length, 2);
  assert.equal(plugins[0].displayName, 'One');
  assert.equal(plugins[0].description, 'd');
  assert.deepEqual(plugins[0].keywords, ['k']);
  assert.deepEqual(plugins[0].mcpServers, ['m']);
  assert.equal(plugins[1].name, 'two');
  assert.equal(plugins[1].displayName, 'two');
  assert.deepEqual(plugins[1].skills, ['a', 'b']);
  assert.deepEqual(plugins[1].keywords, []);
  assert.deepEqual(readPluginManifests(path.join(tmp, 'missing')), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

import { setEnvLine, ENV_VALUE, ENV_KEYS } from './server.mjs';

test('Setup key save edits one .env line and nothing else', () => {
  const env = 'ELEVENLABS_API_KEY=abc\nHEYGEN_API_KEY=old\n';
  assert.equal(setEnvLine(env, 'HEYGEN_API_KEY', 'n$&ew'), 'ELEVENLABS_API_KEY=abc\nHEYGEN_API_KEY=n$&ew\n');
  assert.equal(setEnvLine('A=1', 'HEYGEN_API_KEY', 'k'), 'A=1\nHEYGEN_API_KEY=k\n');
  assert.equal(setEnvLine('', 'HEYGEN_API_KEY', 'k'), 'HEYGEN_API_KEY=k\n');
  assert.ok(ENV_VALUE.test('sk_live-ABC.123=='));
  for (const bad of ['', 'short', 'a b c d e f g h', 'abcdefgh\nB=1', 'x'.repeat(1025)]) assert.ok(!ENV_VALUE.test(bad), JSON.stringify(bad));
  assert.ok(!ENV_KEYS.includes('PATH'));
});

import { businessId } from './server.mjs';

test('business ids are slugs and never collide', () => {
  assert.equal(businessId('Patterned', []), 'patterned');
  assert.equal(businessId("Joe's Café & Bar!", []), 'joe-s-caf-bar');
  assert.equal(businessId('', []), 'business');
  assert.equal(businessId('../etc', []), 'etc');
  assert.equal(businessId('Patterned', ['patterned', 'patterned-2']), 'patterned-3');
});

import { countdown } from './web/src/steps.js';

test('sprint countdowns', () => {
  const growth = { id: 'growth', started: '2026-10-14' };
  assert.equal(countdown(growth, new Date(2026, 9, 14, 15)).days, 30);
  assert.equal(countdown(growth, new Date(2026, 10, 1)).days, 12);
  assert.equal(countdown(growth, new Date(2026, 10, 20)).days, 0);
  assert.deepEqual(countdown(undefined, new Date(2026, 9, 14)), { days: 44, label: 'Black Friday' }); // Black Friday 2026 = Nov 27
});

import { autopostDue } from './server.mjs';

test('LinkedIn autopilot posts only approved, due, not-too-late LinkedIn items', () => {
  const now = new Date('2026-10-14T10:00');
  const li = (o = {}) => ({ date: '2026-10-14', title: 't', channel: 'LinkedIn', autopost: true, status: 'planned', ...o });
  const items = [
    li(),                                      // 0: default 09:00, due
    li({ time: '10:30' }),                     // not yet
    li({ date: '2026-10-13', time: '09:00' }), // 25 h late: skipped
    li({ date: '2026-10-13', time: '11:00' }), // 3: 23 h late, due
    li({ autopost: false }),                   // not approved
    li({ status: 'posted' }),                  // done
    li({ channel: 'Instagram' }),              // other channel
    li({ time: 'soon' }),                      // 7: bad time falls back to 09:00
  ];
  assert.deepEqual(autopostDue(items, now), [0, 3, 7]);
  assert.deepEqual(autopostDue(null, now), []);
});
