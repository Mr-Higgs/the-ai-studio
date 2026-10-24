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

import { setupItems } from './server.mjs';

test('setup fixes match the participant OS', () => {
  const fix = (p, id) => setupItems(p).find(i => i.id === id).fix;
  assert.match(fix('darwin', 'devin'), /install\.sh \| bash/);
  assert.match(fix('win32', 'devin'), /^irm .*setup\.ps1 \| iex$/);
  assert.match(fix('darwin', 'devin-auth'), /^devin auth login$/);
  for (const p of ['darwin', 'win32', 'linux']) {
    const items = setupItems(p);
    assert.deepEqual(items.map(i => i.id), ['devin', 'devin-auth', 'heygen', 'linkedin']);
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
  const env = 'LINKEDIN_ACCESS_TOKEN=abc\nHEYGEN_API_KEY=old\n';
  assert.equal(setEnvLine(env, 'HEYGEN_API_KEY', 'n$&ew'), 'LINKEDIN_ACCESS_TOKEN=abc\nHEYGEN_API_KEY=n$&ew\n');
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

// ---- hosted mode: accounts, workspaces, guards, login relay ----
import { hashPassword, verifyPassword, parseCookies, checkOrigin, workspace, parseLoginOutput } from './server.mjs';
import { spawn, execFileSync } from 'node:child_process';
import os2 from 'node:os';

test('scrypt password hash verifies, wrong password does not', () => {
  const { salt, hash } = hashPassword('correct horse');
  assert.equal(salt.length, 32);
  assert.equal(hash.length, 128);
  assert.ok(verifyPassword('correct horse', salt, hash));
  assert.ok(!verifyPassword('wrong', salt, hash));
  assert.ok(!verifyPassword('correct horse', salt, 'zz'));
});

test('cookie header parses into name/value pairs', () => {
  assert.deepEqual(parseCookies('studio=abc123; other=x y'), { studio: 'abc123', other: 'x y' });
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(undefined).studio, undefined);
});

test('hosted host/origin guard', () => {
  assert.equal(checkOrigin({ host: 'studio.example.com' }, 'GET', 'https://studio.example.com'), null);
  assert.equal(checkOrigin({ host: 'evil.com' }, 'GET', 'https://studio.example.com'), 403);
  assert.equal(checkOrigin({ host: 'h' }, 'POST', ''), null); // no public URL: no host check
  assert.equal(checkOrigin({ host: 'h', origin: 'http://h' }, 'POST', ''), null);
  assert.equal(checkOrigin({ host: 'h', origin: 'http://evil.com' }, 'POST', ''), 403);
  assert.equal(checkOrigin({ host: 'h', origin: 'not a url' }, 'POST', ''), 403);
  assert.equal(checkOrigin({ host: 'h', origin: 'http://evil.com' }, 'GET', ''), null); // GETs may have no origin
});

test('workspace: local is the repo root, uids are 12-hex only', () => {
  const w = workspace('local');
  assert.equal(w.uid, 'local');
  assert.match(w.business, /[\\/]business$/);
  assert.equal(w.env, path.join(w.root, '.env'));
  assert.equal(w.home, undefined);
  for (const bad of ['../x', 'abc', 'g'.repeat(12), 'a'.repeat(13), '../../etc']) {
    assert.throws(() => workspace(bad), /bad uid/, bad);
  }
});

test('DEVIN_API_KEY is a writable setup key', () => {
  assert.ok(ENV_KEYS.includes('DEVIN_API_KEY'));
  assert.equal(setEnvLine('A=1\n', 'DEVIN_API_KEY', 'wu_123'), 'A=1\nDEVIN_API_KEY=wu_123\n');
});

test('devin login relay output: URL extracted from OSC-8, error from tail', () => {
  // Raw stdout bytes captured from `script -qefc 'devin auth login --force-manual-token-flow' /dev/null`
  // in the spike (REPORT.md), JSON.stringify'd then re-parsed here.
  const sample = JSON.parse('"\\u001b7\\u001b]10;?\\u0007\\u001b]11;?\\u0007\\u001b[c\\r\\n\\r\\nVisit \\u001b]8;;https://app.devin.ai/auth/cli/continue?state=0afcaf6f-16e3-4b3d-a63c-436c9bbcba41&prompt=select_account&code_challenge=BtAZ6wmsuGhvk0rVJjNRJQxYb57obt_ckX0q96KWnTk&code_challenge_method=S256&cli_pkce_marker=1\\u001b\\\\same-display-url\\u001b]8;;\\u001b\\\\ to sign in, then copy the code and paste it below.\\r\\n\\r\\n\\u001b[?u\\u001b[c\\u001b[?2004h\\u001b[6n\\u001b[?2026h\\u001b[?25l\\u001b[?2004lError: Failed to exchange code for host https://app.devin.ai\\r\\n"');
  const { url, error } = parseLoginOutput(sample);
  assert.equal(url, 'https://app.devin.ai/auth/cli/continue?state=0afcaf6f-16e3-4b3d-a63c-436c9bbcba41&prompt=select_account&code_challenge=BtAZ6wmsuGhvk0rVJjNRJQxYb57obt_ckX0q96KWnTk&code_challenge_method=S256&cli_pkce_marker=1');
  assert.equal(error, 'Failed to exchange code for host https://app.devin.ai');
  assert.deepEqual(parseLoginOutput('nothing yet'), {});
});

// ---- hosted integration: real server child, real cookies ----
test('hosted mode serves accounts, workspaces and guards', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os2.tmpdir(), 'studio-hosted-'));
  const port = 24000 + Math.floor(Math.random() * 2000);
  const env = { ...process.env, STUDIO_HOSTED: '1', DATA_DIR: tmp, STUDIO_INVITE_CODE: 'abc', PORT: String(port) };
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(tmp, { recursive: true, force: true }); });
  await new Promise((res, rej) => {
    child.stdout.on('data', d => /Studio →/.test(d) && res());
    child.on('exit', c => rej(new Error(`server exited ${c}`)));
    setTimeout(() => rej(new Error('listen timeout')), 15000);
  });
  const base = `http://localhost:${port}`;
  const req = (p, o = {}) => fetch(base + p, { redirect: 'manual', ...o, headers: { 'content-type': 'application/json', ...(o.headers || {}) } });
  const post = (p, body, cookie, headers) => req(p, { method: 'POST', body: JSON.stringify(body), headers: { ...(cookie ? { cookie } : {}), ...(headers || {}) } });
  const cookieOf = r => r.headers.get('set-cookie')?.split(';')[0];

  assert.equal((await req('/api/business')).status, 401);                      // unauth → 401
  // GET /api/health answers healthcheck Hosts the Origin guard would reject (Railway).
  const hh = await fetch(base + '/api/health', { headers: { host: 'railway.internal' } });
  assert.equal(hh.status, 200);
  assert.deepEqual((await hh.json()).items, []);
  assert.deepEqual(await (await req('/api/auth/me')).json(), { hosted: true });
  const h = await (await req('/api/health')).json();
  assert.equal(h.hosted, true);
  assert.deepEqual(h.items, []);                                               // minimal when unauthenticated

  assert.equal((await post('/api/auth/register', { email: 'a@b.co', password: 'password1', invite: 'wrong' })).status, 403);
  assert.equal((await post('/api/auth/register', { email: 'a@b.co', password: 'short', invite: 'abc' })).status, 400);
  const r1 = await post('/api/auth/register', { email: ' A@B.co ', password: 'password1', invite: 'abc' });
  const c1 = cookieOf(r1);
  assert.ok(r1.status === 200 && c1?.startsWith('studio='), 'register sets cookie');
  assert.equal((await post('/api/auth/register', { email: 'a@b.co', password: 'password1', invite: 'abc' })).status, 409);
  const c2 = cookieOf(await post('/api/auth/register', { email: 'b@b.co', password: 'password2', invite: 'abc' }));

  const { uid } = JSON.parse(fs.readFileSync(path.join(tmp, 'users.json'), 'utf8'))[0];
  const put = await req('/api/business/profile.json', { method: 'PUT', body: JSON.stringify({ name: 'Shop A' }), headers: { cookie: c1 } });
  assert.equal(put.status, 200);
  assert.ok(fs.existsSync(path.join(tmp, 'users', uid, 'business', 'profile.json')), 'profile under user workspace');

  const me = await (await req('/api/auth/me', { headers: { cookie: c1 } })).json();
  assert.equal(me.email, 'a@b.co');
  assert.equal(me.admin, true);                                                // first user is admin
  assert.equal((await req('/api/business', { headers: { cookie: c2 } })).status, 200);
  assert.equal((await (await req('/api/business', { headers: { cookie: c2 } })).json()).profile, null, 'user 2 cannot see user 1 profile');

  assert.equal((await post('/api/business/tracker.json', {}, c1, { origin: 'http://evil.example' })).status, 403, 'Origin != Host');
  assert.equal((await post('/api/auth/logout', {}, c1)).status, 200);
  assert.deepEqual(await (await req('/api/auth/me', { headers: { cookie: c1 } })).json(), { hosted: true });

  assert.equal((await req('/api/admin/users', { headers: { cookie: c2 } })).status, 403);
  const c1b = cookieOf(await post('/api/auth/login', { email: 'a@b.co', password: 'password1' }));
  assert.ok(c1b, 'login after logout');
  const list = await (await req('/api/admin/users', { headers: { cookie: c1b } })).json();
  assert.equal(list.length, 2);
  assert.deepEqual(Object.keys(list[0]).sort(), ['admin', 'agentRunning', 'createdAt', 'email']);
});

// OS isolation only exists on Linux as root (Docker). On macOS this skips.
const CAN_ISOLATE = process.platform === 'linux' && process.getuid?.() === 0;
test('STUDIO_ISOLATE chowns workspace files to the OS user', { skip: !CAN_ISOLATE }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os2.tmpdir(), 'studio-isolate-'));
  const port = 26000 + Math.floor(Math.random() * 2000);
  const env = { ...process.env, STUDIO_HOSTED: '1', STUDIO_ISOLATE: '1', DATA_DIR: tmp, STUDIO_INVITE_CODE: 'abc', PORT: String(port) };
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let uid;
  t.after(() => {
    child.kill('SIGKILL');
    if (uid) try { execFileSync('userdel', [`studio-${uid}`]); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  await new Promise((res, rej) => {
    child.stdout.on('data', d => /Studio →/.test(d) && res());
    child.on('exit', c => rej(new Error(`server exited ${c}`)));
    setTimeout(() => rej(new Error('listen timeout')), 15000);
  });
  const base = `http://localhost:${port}`;
  const r = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'i@o.co', password: 'password1', invite: 'abc' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const u = JSON.parse(fs.readFileSync(path.join(tmp, 'users.json'), 'utf8'))[0];
  uid = u.uid;
  assert.ok(u.osUid > 0, 'OS user created');
  await fetch(`${base}/api/business`, { headers: { cookie } }); // materializes workspace dirs
  assert.equal(fs.statSync(path.join(tmp, 'users', uid)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(tmp, 'users', uid, 'home')).uid, u.osUid, 'home owned by OS user');
  await fetch(`${base}/api/business/profile.json`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: 'x' }) });
  assert.equal(fs.statSync(path.join(tmp, 'users', uid, 'business', 'profile.json')).uid, u.osUid, 'server writes owned by OS user');
});
