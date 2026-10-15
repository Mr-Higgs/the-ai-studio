// Studio UI: local web page that drives a coding agent (Devin by default, Claude Code
// optional) over the Agent Client Protocol (ACP, JSON-RPC over stdio). No dependencies.
//   npm run studio  ->  http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { postToLinkedIn } from '../mcp/linkedin.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROJECTS = path.join(ROOT, 'projects');
const BUSINESS = path.join(ROOT, 'business'); // the active profile; prompts and skills all point here
const BUSINESSES = path.join(ROOT, 'businesses'); // parked profiles, one folder each
const DIST = path.join(import.meta.dirname, 'dist');
const PORT = Number(process.env.PORT) || 4321;
const WIN = process.platform === 'win32';
const AGENTS = {
  devin: ['devin', ['acp']], // devin.exe on Windows; spawn finds it without a shell
  claude: [WIN ? 'npx.cmd' : 'npx', ['-y', '@agentclientprotocol/claude-agent-acp']], // .cmd needs a shell on Windows
};
const DEFAULT_AGENT = AGENTS[process.env.STUDIO_AGENT] ? process.env.STUDIO_AGENT : 'devin';

// ---- guards (trust boundary: names and filenames come from the browser) ----
export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const validProject = name => SLUG.test(name) && name !== '_template';
export function projectFile(name, sub, file) {
  if (!validProject(name) || !['raw', 'out'].includes(sub)) return null;
  const base = path.basename(file);
  if (base !== file || !base || base.startsWith('.')) return null;
  return path.join(PROJECTS, name, sub, base);
}
// Files the browser may overwrite in business/ (Devin writes the .md docs itself).
export const BUSINESS_JSON = ['profile.json', 'inputs.json', 'calendar.json', 'tracker.json', 'sprint.json'];
export const BUSINESS_DOCS = ['offer', 'research', 'strategy', 'content', 'visibility', 'automation', 'action-plan']; // step order
// Files the server snapshots into business/history/ before Devin rewrites them.
export const SNAPSHOT_FILES = [...BUSINESS_DOCS.map(d => `${d}.md`), 'calendar.json'];
// history/<offer|...|calendar>-<timestamp>.<md|json>: one level, no dotfiles.
export const historyFile = f => (/^[a-z-]+-\d{8}T\d{6}\.(md|json)$/.test(f) ? path.join(BUSINESS, 'history', f) : null);

// The agent writes calendar.json; keep only items the UI can render and count the rest.
export function cleanCalendar(data) {
  if (!Array.isArray(data)) return { items: null, issues: data == null ? 0 : 1 };
  const items = data.filter(x => x && typeof x === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && typeof x.title === 'string');
  return { items, issues: data.length - items.length };
}
// LinkedIn autopilot: calendar items the user approved (autopost) whose local date+time has come.
// Over 24 h late stays put, so reopening Studio after a week doesn't fire a backlog.
const DAY = 864e5;
export const autopostAt = x => new Date(`${x.date}T${/^\d{2}:\d{2}$/.test(x.time) ? x.time : '09:00'}`);
export function autopostDue(items, now = new Date()) {
  return (items || []).flatMap((x, i) => {
    const late = now - autopostAt(x);
    return /linkedin/i.test(x.channel) && x.autopost === true && x.status !== 'posted' && late >= 0 && late <= DAY ? [i] : [];
  });
}
// ponytail: runs only while Studio is open, for the active business. launchd/cron if it must run unattended.
let autopilotBusy = false;
async function autopilotTick() {
  if (autopilotBusy) return;
  autopilotBusy = true;
  const file = path.join(BUSINESS, 'calendar.json');
  const read = () => { try { return cleanCalendar(JSON.parse(fs.readFileSync(file, 'utf8'))).items; } catch { return null; } };
  // Re-read before each write so edits made in the UI meanwhile survive; match by date+title, not index.
  const patch = (item, fields) => {
    const items = read(); const x = items?.find(y => y.date === item.date && y.title === item.title);
    if (!x) return;
    Object.assign(x, fields);
    fs.writeFileSync(file + '.tmp', JSON.stringify(items, null, 2) + '\n');
    fs.renameSync(file + '.tmp', file);
  };
  try {
    const items = read();
    for (const i of autopostDue(items)) {
      const item = items[i];
      patch(item, { status: 'posted' }); // mark first: a crash mid-post must not double-post
      try {
        const url = await postToLinkedIn([item.copy, item.cta].filter(Boolean).join('\n\n'));
        patch(item, { url, postedAt: new Date().toISOString(), autopostError: undefined });
        console.log(`LinkedIn autopilot posted "${item.title}" → ${url}`);
      } catch (e) {
        patch(item, { status: 'planned', autopost: false, autopostError: e.message }); // untick: no retry loop
        console.error(`LinkedIn autopilot failed "${item.title}": ${e.message}`);
      }
    }
  } finally { autopilotBusy = false; }
}

// Built frontend: /assets/<file> only, no nesting, no dotfiles.
export function distFile(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') return path.join(DIST, 'index.html');
  const m = /^\/assets\/([^/]+)$/.exec(urlPath);
  return m && !m[1].startsWith('.') ? path.join(DIST, 'assets', m[1]) : null;
}

// ---- HeyGen: pull videos the user made in their HeyGen account into a project's raw/ ----
export const HEYGEN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const readEnv = () => { try { return fs.readFileSync(path.join(ROOT, '.env'), 'utf8'); } catch { return ''; } };
const envKey = name => process.env[name] || new RegExp(`^${name}=(.+)$`, 'm').exec(readEnv())?.[1].trim();
// Keys the Setup page may write into .env. Printable ASCII, no spaces: a pasted value can't add a line.
export const ENV_KEYS = ['HEYGEN_API_KEY', 'ELEVENLABS_API_KEY', 'LINKEDIN_ACCESS_TOKEN'];
export const ENV_VALUE = /^[\x21-\x7e]{8,1024}$/;
export function setEnvLine(text, name, value) {
  const line = `${name}=${value}`, re = new RegExp(`^${name}=.*$`, 'm');
  return re.test(text) ? text.replace(re, () => line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
}
export const ASPECTS = ['9:16', '1:1', '16:9'];
async function heygen(apiPath, json) {
  const key = envKey('HEYGEN_API_KEY');
  if (!key || key === 'your_api_key_here') throw Object.assign(new Error('Add your HeyGen API key in Setup, then try again.'), { status: 400 });
  const r = await fetch(`https://api.heygen.com${apiPath}`, json
    ? { method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(json) }
    : { headers: { 'X-Api-Key': key } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error('HeyGen rejected the key. Replace your HeyGen API key in Setup.'), { status: 400 });
  if (r.status === 429) throw Object.assign(new Error('HeyGen is rate-limiting. Wait a minute and try again.'), { status: 429 });
  if (!r.ok) throw Object.assign(new Error(body.error?.message || body.message || `HeyGen error ${r.status}`), { status: 502 });
  return body;
}

// ACP frames are newline-delimited JSON; stdout chunks can split them anywhere.
export function lineSplitter(onLine) {
  let buf = '';
  return chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  };
}

// ---- one agent process per project, plus one for the business workspace ----
const BIZ = '@business'; // session key; '@' can't collide with a project slug
const dirFor = key => key === BIZ ? BUSINESS : path.join(PROJECTS, key);
const sessions = new Map();
const readOpt = (name, f) => { try { return fs.readFileSync(path.join(dirFor(name), f), 'utf8').trim(); } catch { return ''; } };
const agentOf = name => AGENTS[readOpt(name, '.agent')] ? readOpt(name, '.agent') : DEFAULT_AGENT;

function getSession(name) {
  if (sessions.has(name)) return sessions.get(name);
  const agent = agentOf(name);
  const [cmd, args] = AGENTS[agent];
  const proc = spawn(cmd, args, { cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'], shell: WIN && cmd.endsWith('.cmd') });
  const s = { agent, proc, clients: new Set(), log: [], busy: false, pending: new Map(), perms: new Map(), nextId: 1, sessionId: null };
  sessions.set(name, s);

  // ponytail: whole conversation kept in memory for replay to reloaded tabs; grows with session length
  s.emit = ev => { s.log.push(ev); for (const res of s.clients) res.write(`data: ${JSON.stringify(ev)}\n\n`); };
  s.send = msg => proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
  s.request = (method, params) => new Promise((resolve, reject) => {
    const id = s.nextId++;
    s.pending.set(id, { resolve, reject });
    s.send({ id, method, params });
  });

  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', lineSplitter(line => {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.id != null && m.method) {           // agent -> us request
      if (m.method === 'session/request_permission') {
        s.perms.set(String(m.id), m.id);
        s.emit({ type: 'permission', id: String(m.id), toolCall: m.params.toolCall, options: m.params.options });
      } else s.send({ id: m.id, error: { code: -32601, message: 'not supported by studio' } });
    } else if (m.id != null) {                 // response to one of ours
      const p = s.pending.get(m.id);
      s.pending.delete(m.id);
      if (p) m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === 'session/update') {
      const u = m.params.update;
      if (['user_message_chunk', 'agent_message_chunk', 'tool_call', 'tool_call_update', 'plan'].includes(u.sessionUpdate)) s.emit({ type: 'update', update: u });
    }
  }));
  const die = msg => {
    if (sessions.get(name) !== s) return;
    sessions.delete(name);
    for (const p of s.pending.values()) p.reject(new Error(msg));
    s.emit({ type: 'exit', message: msg });
    for (const res of s.clients) res.end();
  };
  proc.on('error', e => die(e.code === 'ENOENT' ? `"${cmd}" not found. Install it, then reload.` : e.message));
  proc.on('exit', code => die(`Agent stopped (exit ${code}).`));

  s.ready = (async () => {
    const init = await s.request('initialize', { protocolVersion: 1, clientCapabilities: {} });
    const saved = readOpt(name, '.session');
    if (saved && init.agentCapabilities?.loadSession) {
      try {
        await s.request('session/load', { sessionId: saved, cwd: ROOT, mcpServers: [] });
        return (s.sessionId = saved);
      } catch { /* stale id: start fresh */ }
    }
    const { sessionId } = await s.request('session/new', { cwd: ROOT, mcpServers: [] });
    fs.mkdirSync(dirFor(name), { recursive: true });
    fs.writeFileSync(path.join(dirFor(name), '.session'), sessionId);
    return (s.sessionId = sessionId);
  })();
  s.ready.catch(e => s.emit({ type: 'error', message: `Could not start ${agent}: ${e.message}` }));
  return s;
}

function stopSession(name) {
  const s = sessions.get(name);
  sessions.delete(name); // a reconnect right after this spawns fresh instead of reusing the dying process
  if (s) { s.emit({ type: 'exit', message: 'Conversation closed.' }); for (const res of s.clients) res.end(); s.proc.kill(); }
}

// Past conversations: <dir>/.sessions.json = [{ id, agent, title, at }]. Transcripts live with the agent.
const pastSessions = name => { try { return JSON.parse(readOpt(name, '.sessions.json')) || []; } catch { return []; } };
function rememberSession(name, id, agent, text) {
  const list = pastSessions(name);
  if (!id || list.some(c => c.id === id)) return;
  list.unshift({ id, agent, title: text.replace(/\s+/g, ' ').slice(0, 60), at: new Date().toISOString() });
  fs.writeFileSync(path.join(dirFor(name), '.sessions.json'), JSON.stringify(list, null, 2));
}

async function prompt(name, text) {
  const s = getSession(name);
  if (s.busy) return false;
  s.busy = true;
  s.emit({ type: 'user', text });
  try {
    await s.ready;
    rememberSession(name, s.sessionId, s.agent, text);
    const r = await s.request('session/prompt', { sessionId: s.sessionId, prompt: [{ type: 'text', text }] });
    s.emit({ type: 'done', stopReason: r.stopReason });
  } catch (e) {
    s.emit({ type: 'error', message: e.message });
  } finally {
    s.busy = false;
  }
  return true;
}

// ---- health ----
// The setup checklist. `fix` is the command for the participant's OS (shown with a Copy button).
const VIDEO_USE = 'git clone https://github.com/browser-use/video-use .claude/skills/video-use';
export function setupItems(platform = process.platform) {
  const os = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux';
  const pick = fixes => fixes[os] ?? fixes.mac;
  return [
    { id: 'devin', group: 'required', name: 'Devin CLI', why: 'The assistant that writes every step with you.',
      fix: pick({ mac: 'curl -fsSL https://cli.devin.ai/install.sh | bash', linux: 'curl -fsSL https://cli.devin.ai/install.sh | bash', win: 'irm https://static.devin.ai/cli/setup.ps1 | iex' }) },
    { id: 'devin-auth', group: 'required', name: 'Signed in to Devin', why: 'Connects the assistant to your Devin account.', fix: 'devin auth login' },
    { id: 'ffmpeg', group: 'video', name: 'ffmpeg', why: 'Cuts, renders and burns subtitles into video.',
      fix: pick({ mac: 'brew install ffmpeg', linux: 'sudo apt install ffmpeg', win: 'winget install Gyan.FFmpeg' }),
      refix: pick({ mac: 'brew reinstall ffmpeg', linux: 'sudo apt install --reinstall ffmpeg', win: 'winget install --force Gyan.FFmpeg' }) },
    { id: 'uv', group: 'video', name: 'uv (Python)', why: 'Runs the video editing tools.',
      fix: pick({ mac: 'brew install uv', linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh', win: 'winget install astral-sh.uv' }) },
    { id: 'video-use', group: 'video', name: 'Video editing skill', why: 'Teaches the assistant how to edit footage.', fix: VIDEO_USE },
    { id: 'elevenlabs', group: 'video', name: 'ElevenLabs API key', why: 'Transcribes your footage so cuts land between words.',
      key: 'ELEVENLABS_API_KEY', link: 'https://elevenlabs.io/app/settings/api-keys',
      fix: pick({ mac: 'cp .env.example .env   # then paste your key into .env', linux: 'cp .env.example .env   # then paste your key into .env', win: 'copy .env.example .env   # then paste your key into .env' }) },
    { id: 'heygen', group: 'optional', name: 'HeyGen API key', why: 'Imports your HeyGen videos and makes new ones from your avatars.',
      key: 'HEYGEN_API_KEY', link: 'https://app.heygen.com/settings?nav=API',
      fix: pick({ mac: 'cp .env.example .env   # then paste HEYGEN_API_KEY into .env', linux: 'cp .env.example .env   # then paste HEYGEN_API_KEY into .env', win: 'copy .env.example .env   # then paste HEYGEN_API_KEY into .env' }) },
    { id: 'linkedin', group: 'optional', name: 'LinkedIn access token', why: 'Lets Devin publish posts you approve to your LinkedIn. Expires every 60 days. See "Post to LinkedIn" under Add more.',
      key: 'LINKEDIN_ACCESS_TOKEN', link: 'https://www.linkedin.com/developers/tools/oauth/token-generator',
      fix: pick({ mac: 'cp .env.example .env   # then paste LINKEDIN_ACCESS_TOKEN into .env', linux: 'cp .env.example .env   # then paste LINKEDIN_ACCESS_TOKEN into .env', win: 'copy .env.example .env   # then paste LINKEDIN_ACCESS_TOKEN into .env' }) },
  ];
}
const has = bin => { try { execFileSync(WIN ? 'where' : 'which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
export function hasSubtitlesFilter(text) { return /^\s*\S+\s+subtitles\s/m.test(text); }
function ffmpegStatus() {
  try {
    const out = execFileSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return hasSubtitlesFilter(out) ? 'ok' : 'no-libass';
  } catch { return 'missing'; }
}
const devinLoggedIn = () => { try { return /Logged in/.test(execFileSync('devin', ['auth', 'status'], { encoding: 'utf8' })); } catch { return false; } };
function health() {
  const env = readEnv();
  const devinAuth = devinLoggedIn();
  const ff = ffmpegStatus();
  const ok = {
    devin: has('devin'), 'devin-auth': devinAuth, ffmpeg: ff === 'ok', uv: has('uv'),
    'video-use': fs.existsSync(path.join(ROOT, '.claude/skills/video-use/SKILL.md')),
    elevenlabs: /^ELEVENLABS_API_KEY=(?!your_api_key_here)\S+/m.test(env),
    heygen: /^HEYGEN_API_KEY=(?!your_api_key_here)\S+/m.test(env) || !!process.env.HEYGEN_API_KEY,
    linkedin: /^LINKEDIN_ACCESS_TOKEN=(?!your_api_key_here)\S+/m.test(env) || !!process.env.LINKEDIN_ACCESS_TOKEN,
  };
  return setupItems().map(i => {
    const { refix, ...rest } = i;
    if (i.id === 'ffmpeg' && ff === 'no-libass')
      return { ...rest, ok: false, fix: i.refix, why: "ffmpeg is installed but this build can't burn subtitles (no libass) — reinstall it." };
    return { ...rest, ok: ok[i.id] };
  });
}

// ---- integrations: the MCP servers and plugins Devin can reach (read-only, for Setup) ----
// `devin mcp list` prints "• name" entries with indented "URL:"/"Command:" detail lines.
export function parseMcpList(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const m = /^\s*[•\-*]\s+(\S+)(\s+\(disabled\))?/.exec(line);
    if (m) { out.push({ name: m[1], kind: null, target: '', disabled: !!m[2] }); continue; }
    const d = /^\s+(URL|Command):\s+(.+)$/.exec(line);
    if (d && out.length) { out.at(-1).kind = d[1] === 'URL' ? 'url' : 'command'; out.at(-1).target = d[2].trim(); }
  }
  return out;
}
// No secrets to the page: URLs drop their query string; commands keep only the executable
// plus the basename of its first argument (later args can carry tokens or env paths).
export function safeTarget(kind, target) {
  target = String(target).trim();
  if (kind === 'url') {
    try { const u = new URL(target); return u.origin + u.pathname; } // drops query, hash, userinfo
    catch { return target.split('?')[0]; }
  }
  const [bin, arg] = target.split(/\s+/);
  return arg ? `${path.basename(bin)} ${path.basename(arg)}` : path.basename(bin);
}
// Installed plugins live in the CLI cache as <slug>/<version>/, manifest in
// .devin-plugin/ or .claude-plugin/ or the version dir itself.
export function readPluginManifests(cacheDir) {
  const out = [];
  let slugs;
  try { slugs = fs.readdirSync(cacheDir, { withFileTypes: true }); } catch { return []; }
  for (const slug of slugs) {
    if (!slug.isDirectory()) continue;
    let versions;
    try { versions = fs.readdirSync(path.join(cacheDir, slug.name), { withFileTypes: true }); } catch { continue; }
    for (const v of versions) {
      if (!v.isDirectory()) continue;
      const dir = path.join(cacheDir, slug.name, v.name);
      const manifest = ['.devin-plugin', '.claude-plugin', ''].map(sub => path.join(dir, sub, 'plugin.json')).find(fs.existsSync);
      if (!manifest) continue;
      let j;
      try { j = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch { continue; }
      let skills = [];
      try { skills = fs.readdirSync(path.join(dir, 'skills'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
      out.push({
        name: j.name || slug.name,
        displayName: j.displayName || j.name || slug.name,
        description: j.description || '',
        homepage: j.homepage || '',
        keywords: j.keywords || [],
        mcpServers: Object.keys(j.mcpServers || {}),
        skills,
      });
    }
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
const PLUGIN_CACHE = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || 'x', 'devin', 'cli', 'plugins', 'cache')
  : path.join(os.homedir(), '.local', 'share', 'devin', 'cli', 'plugins', 'cache');
let integCache = { at: 0, value: null };
function integrations(fresh = false) {
  if (!fresh && integCache.value && Date.now() - integCache.at < 30000) return integCache.value;
  let mcp = [], mcpError = null;
  try {
    mcp = parseMcpList(execFileSync('devin', ['mcp', 'list'], { encoding: 'utf8' }))
      .map(m => ({ ...m, target: safeTarget(m.kind, m.target) }));
  } catch { mcpError = 'devin-missing'; }
  const value = {
    mcp, mcpError,
    plugins: readPluginManifests(PLUGIN_CACHE),
    loggedIn: devinLoggedIn(),
    hasProjectMcpConfig: ['mcp_config.json', 'mcp_config.local.json'].some(f => fs.existsSync(path.join(ROOT, '.devin', f))),
  };
  return (integCache = { at: Date.now(), value }).value;
}

function businessState() {
  const read = f => { try { return fs.readFileSync(path.join(BUSINESS, f), 'utf8'); } catch { return null; } };
  const json = f => { const t = read(f); if (t == null) return null; try { return JSON.parse(t); } catch { return 'invalid'; } };
  const mtime = f => { try { return fs.statSync(path.join(BUSINESS, f)).mtimeMs; } catch { return null; } };
  const docs = {};
  for (const id of BUSINESS_DOCS) {
    const content = read(`${id}.md`);
    docs[id] = content == null ? null : { content, mtime: mtime(`${id}.md`) };
  }
  const rawCal = json('calendar.json');
  const cal = rawCal === 'invalid' ? { items: null, issues: 1 } : cleanCalendar(rawCal);
  const history = {};
  try { for (const f of fs.readdirSync(path.join(BUSINESS, 'history')).sort().reverse()) if (historyFile(f)) (history[f.replace(/-\d{8}T.*$/, '')] ||= []).push(f); } catch {}
  const obj = f => { const v = json(f); return v === 'invalid' ? null : v; };
  return {
    sprint: obj('sprint.json'), profile: obj('profile.json'), inputs: obj('inputs.json') || {}, tracker: obj('tracker.json'), calendar: cal.items, calendarIssues: cal.issues, docs, history,
    mtimes: { profile: mtime('profile.json'), calendar: mtime('calendar.json'), tracker: mtime('tracker.json') },
    agent: agentOf(BIZ), busy: !!sessions.get(BIZ)?.busy,
  };
}

// ---- business profiles ----
// Switching moves files between business/ and businesses/<id>/, so every `business/...` path keeps working.
// Each profile carries its own .session/.sessions.json, so chats follow the business.
export const businessId = (name, taken) => {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'business';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
};
const parkedIds = () => { try { return fs.readdirSync(BUSINESSES).filter(f => /^[a-z0-9-]+$/.test(f)); } catch { return []; } };
const profileName = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'profile.json'), 'utf8')).name || ''; } catch { return ''; } };
// ponytail: not transactional; a crash mid-move leaves files split between the two folders (both kept, nothing lost)
const moveAll = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (f !== '.gitkeep') fs.renameSync(path.join(from, f), path.join(to, f));
};
function listBusinesses() {
  return {
    current: profileName(BUSINESS),
    list: parkedIds().map(id => ({ id, name: profileName(path.join(BUSINESSES, id)) || id })),
  };
}
function parkBusiness() {
  fs.mkdirSync(BUSINESS, { recursive: true });
  if (!fs.readdirSync(BUSINESS).some(f => f !== '.gitkeep' && !f.startsWith('.'))) { // nothing worth keeping, not even its chat
    for (const f of fs.readdirSync(BUSINESS)) if (f !== '.gitkeep') fs.rmSync(path.join(BUSINESS, f), { recursive: true, force: true });
    return;
  }
  const id = readOpt(BIZ, '.id') || businessId(profileName(BUSINESS), parkedIds());
  if (fs.existsSync(path.join(BUSINESSES, id))) throw Object.assign(new Error(`businesses/${id} already exists`), { status: 409 });
  fs.writeFileSync(path.join(BUSINESS, '.id'), id);
  moveAll(BUSINESS, path.join(BUSINESSES, id));
}

// Everything in one Markdown file to take home.
function exportMarkdown() {
  const b = businessState();
  const out = [`# ${b.sprint?.name || 'Holiday Growth Sprint'} — ${b.profile?.name || 'my business'}`, `_Exported ${new Date().toLocaleString()}_`];
  if (b.profile) out.push('## Business profile', ...Object.entries(b.profile).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => `- **${k}:** ${v}`));
  for (const id of BUSINESS_DOCS) if (b.docs[id]) out.push(`\n---\n`, b.docs[id].content.trim());
  if (b.calendar?.length) out.push('\n---\n', '## Campaign calendar', ...b.calendar.map(c => `- **${c.date}** · ${c.channel || ''} ${c.format || ''} · ${c.title}${c.status === 'posted' ? ' ✓' : ''}\n\n  ${(c.copy || '').replace(/\n/g, '\n  ')}${c.cta ? `\n\n  _CTA:_ ${c.cta}` : ''}`));
  return out.join('\n\n') + '\n';
}

function snapshot(file) {
  const src = path.join(BUSINESS, file);
  if (!fs.existsSync(src)) return;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // 20261009T183012
  const [base, ext] = file.split('.');
  fs.mkdirSync(path.join(BUSINESS, 'history'), { recursive: true });
  fs.copyFileSync(src, path.join(BUSINESS, 'history', `${base}-${stamp}.${ext}`));
}

function listProjects() {
  const ls = d => { try { return fs.readdirSync(d).filter(f => !f.startsWith('.')); } catch { return []; } };
  return ls(PROJECTS).filter(n => validProject(n) && fs.statSync(path.join(PROJECTS, n)).isDirectory()).map(name => ({
    name,
    raw: ls(path.join(PROJECTS, name, 'raw')),
    out: ls(path.join(PROJECTS, name, 'out')).filter(f => /\.(mp4|mov|webm)$/i.test(f)),
    agent: agentOf(name),
    started: !!readOpt(name, '.session'),
    busy: !!sessions.get(name)?.busy,
  }));
}

// ---- http ----
const MIME = { '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
function serveFile(req, res, file) {
  let st;
  try { st = fs.statSync(file); } catch { return send(res, 404, { error: 'not found' }); }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!r || (!r[1] && !r[2])) {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    return fs.createReadStream(file).pipe(res);
  }
  let start = r[1] ? +r[1] : Math.max(0, st.size - +r[2]);
  let end = r[1] && r[2] ? Math.min(+r[2], st.size - 1) : st.size - 1;
  if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
  res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file, { start, end }).pipe(res);
}
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = async req => { let b = ''; for await (const c of req) b += c; return JSON.parse(b || '{}'); };

const server = http.createServer(async (req, res) => {
  // This server can make an agent run shell commands, so only same-origin localhost calls.
  // Host check blocks DNS rebinding; the JSON content-type requirement forces a CORS
  // preflight (which we never answer) on any cross-site POST/PUT.
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '')) return send(res, 403, { error: 'bad host' });
  if (req.method !== 'GET' && req.method !== 'PUT' && !String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'json only' });

  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (req.method === 'GET' && !/^\/(api|projects|business)\//.test(url.pathname)) {
      if (!fs.existsSync(path.join(DIST, 'index.html'))) return send(res, 503, { error: 'Frontend not built. Run: npm run studio' });
      const file = distFile(url.pathname);
      return file ? serveFile(req, res, file) : send(res, 404, { error: 'not found' });
    }
    if (req.method === 'GET' && url.pathname === '/api/business') return send(res, 200, businessState());
    if (req.method === 'GET' && url.pathname === '/api/businesses') return send(res, 200, listBusinesses());
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'businesses' && ['new', 'switch'].includes(parts[2])) {
      if (sessions.get(BIZ)?.busy) return send(res, 409, { error: 'The agent is still working. Stop it or wait.' });
      const { id } = await readJson(req);
      const from = parts[2] === 'switch' && parkedIds().includes(id) ? path.join(BUSINESSES, id) : null;
      if (parts[2] === 'switch' && !from) return send(res, 404, { error: 'no such business' });
      stopSession(BIZ);
      parkBusiness();
      if (from) { moveAll(from, BUSINESS); fs.rmdirSync(from); }
      return send(res, 200, listBusinesses());
    }
    if (req.method === 'GET' && url.pathname === '/api/business/export.md') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${businessState().sprint?.id === 'growth' ? 'growth-hack' : 'holiday-growth'}-sprint.md"` });
      return res.end(exportMarkdown());
    }
    if (req.method === 'GET' && parts[0] === 'business' && parts[1] === 'history' && parts.length === 3) {
      const file = historyFile(parts[2]);
      return file ? serveFile(req, res, file) : send(res, 400, { error: 'bad path' });
    }
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'business' && parts.length === 3) {
      if (!BUSINESS_JSON.includes(parts[2])) return send(res, 400, { error: 'not writable' });
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'json only' });
      const data = await readJson(req);
      fs.mkdirSync(BUSINESS, { recursive: true });
      const file = path.join(BUSINESS, parts[2]), tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
      fs.renameSync(tmp, file);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, health());
    if (req.method === 'GET' && url.pathname === '/api/integrations') return send(res, 200, integrations(url.searchParams.has('fresh')));
    if (req.method === 'GET' && url.pathname === '/api/heygen/videos') {
      const q = new URLSearchParams({ limit: '24' });
      if (url.searchParams.get('token')) q.set('token', url.searchParams.get('token'));
      const r = await heygen(`/v3/videos?${q}`);
      const videos = (r.data || []).filter(v => v.status === 'completed' && HEYGEN_ID.test(v.id))
        .map(({ id, title, thumbnail_url, duration, created_at }) => ({ id, title, thumbnail_url, duration, created_at }));
      return send(res, 200, { videos, next_token: r.has_more ? r.next_token : null });
    }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'heygen' && parts[2] === 'videos' && parts.length === 4) {
      if (!HEYGEN_ID.test(parts[3])) return send(res, 400, { error: 'bad video id' });
      const { data } = await heygen(`/v3/videos/${parts[3]}`);
      return send(res, 200, { status: data?.status, failure_message: data?.failure_message || null });
    }
    if (req.method === 'GET' && url.pathname === '/api/heygen/avatars') {
      // ponytail: first 3 pages (150 looks); add UI paging if someone has more
      const avatars = [];
      let token = '';
      for (let i = 0; i < 3; i++) {
        const r = await heygen(`/v3/avatars/looks?${new URLSearchParams({ ownership: 'private', limit: '50', ...(token && { token }) })}`);
        for (const a of r.data || []) if ((a.status ?? 'completed') === 'completed' && HEYGEN_ID.test(a.id)) avatars.push({ id: a.id, name: a.name, avatar_type: a.avatar_type, preview_image_url: a.preview_image_url });
        if (!r.has_more || !r.next_token) break;
        token = r.next_token;
      }
      return send(res, 200, { avatars });
    }
    if (req.method === 'POST' && url.pathname === '/api/setup/env') {
      const { name: key, value } = await readJson(req);
      if (!ENV_KEYS.includes(key)) return send(res, 400, { error: 'unknown key' });
      if (!ENV_VALUE.test(value || '')) return send(res, 400, { error: 'That doesn’t look like an API key. Paste it again with no spaces.' });
      const file = path.join(ROOT, '.env'), tmp = file + '.tmp';
      let text = readEnv();
      if (!text) try { text = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'); } catch {}
      fs.writeFileSync(tmp, setEnvLine(text, key, value), { mode: 0o600 });
      fs.renameSync(tmp, file);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/projects') return send(res, 200, { projects: listProjects(), defaultAgent: DEFAULT_AGENT });
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const { name } = await readJson(req);
      if (!validProject(name)) return send(res, 400, { error: 'Use lowercase letters, numbers and dashes.' });
      const dir = path.join(PROJECTS, name);
      if (fs.existsSync(dir)) return send(res, 409, { error: 'A project with that name exists.' });
      fs.cpSync(path.join(PROJECTS, '_template'), dir, { recursive: true });
      return send(res, 201, { name });
    }

    // /projects/:name/(raw|out)/:file  -> media
    if (req.method === 'GET' && parts[0] === 'projects' && parts.length === 4) {
      const file = projectFile(parts[1], parts[2], parts[3]);
      return file ? serveFile(req, res, file) : send(res, 400, { error: 'bad path' });
    }

    // /api/projects/:name/<action>  and  /api/business/<action>  share the agent handlers
    let name, action;
    if (parts[0] === 'api' && parts[1] === 'business') {
      name = BIZ; action = parts[2];
    } else if (parts[0] === 'api' && parts[1] === 'projects' && validProject(parts[2] || '')) {
      name = parts[2]; action = parts[3];
      if (!fs.existsSync(path.join(PROJECTS, name))) return send(res, 404, { error: 'no such project' });
    } else return send(res, 404, { error: 'not found' });

    if (req.method === 'PUT' && action === 'raw' && name !== BIZ) {
      const file = projectFile(name, 'raw', parts[4] || '');
      if (!file) return send(res, 400, { error: 'bad filename' });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = path.join(path.dirname(file), `.upload-${Date.now()}`);
      try { await pipeline(req, fs.createWriteStream(tmp)); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
      fs.renameSync(tmp, file);
      return send(res, 201, { file: path.basename(file) });
    }
    if (req.method === 'POST' && action === 'heygen' && parts[4] === 'generate' && name !== BIZ) {
      const { avatar_id, script, aspect_ratio } = await readJson(req);
      if (!HEYGEN_ID.test(avatar_id || '')) return send(res, 400, { error: 'Pick an avatar.' });
      const text = String(script || '').trim();
      if (!text || text.length > 5000) return send(res, 400, { error: 'Write a script (up to 5000 characters).' });
      if (!ASPECTS.includes(aspect_ratio)) return send(res, 400, { error: 'bad aspect ratio' });
      const { data } = await heygen('/v3/videos', { type: 'avatar', avatar_id, script: text, aspect_ratio, title: `${name} · Studio` });
      return send(res, 202, { video_id: data?.video_id });
    }
    if (req.method === 'POST' && action === 'heygen' && parts.length === 4 && name !== BIZ) {
      const { id } = await readJson(req);
      if (!HEYGEN_ID.test(id || '')) return send(res, 400, { error: 'bad video id' });
      const { data } = await heygen(`/v3/videos/${id}`); // fresh presigned URL; list URLs may have expired
      if (data?.status !== 'completed' || !data.video_url) return send(res, 409, { error: 'That HeyGen video isn’t finished yet.' });
      const dl = await fetch(data.video_url);
      if (!dl.ok) return send(res, 502, { error: `Download failed (${dl.status})` });
      const file = projectFile(name, 'raw', `heygen-${id}.mp4`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = path.join(path.dirname(file), `.upload-${Date.now()}`);
      try { await pipeline(Readable.fromWeb(dl.body), fs.createWriteStream(tmp)); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
      fs.renameSync(tmp, file);
      return send(res, 201, { file: path.basename(file) });
    }
    if (req.method === 'GET' && action === 'events') {
      const s = getSession(name);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'hello', agent: s.agent, busy: s.busy })}\n\n`);
      for (const ev of s.log) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      s.clients.add(res);
      req.on('close', () => s.clients.delete(res));
      return;
    }
    if (req.method === 'POST' && action === 'prompt') {
      const { text, snapshot: snap } = await readJson(req);
      if (!text?.trim()) return send(res, 400, { error: 'empty message' });
      if (sessions.get(name)?.busy) return send(res, 409, { error: 'The agent is still working. Stop it or wait.' });
      if (snap != null && (name !== BIZ || !SNAPSHOT_FILES.includes(snap))) return send(res, 400, { error: 'bad snapshot' });
      if (snap) snapshot(snap); // keep the current version before the agent overwrites it
      prompt(name, text.trim());
      return send(res, 202, { ok: true });
    }
    if (req.method === 'POST' && action === 'permission') {
      const { id, optionId } = await readJson(req);
      const s = sessions.get(name);
      if (!s?.perms.has(id)) return send(res, 404, { error: 'no such request' });
      s.send({ id: s.perms.get(id), result: { outcome: { outcome: 'selected', optionId } } });
      s.perms.delete(id);
      s.emit({ type: 'permission_done', id, optionId });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'cancel') {
      const s = sessions.get(name);
      if (s?.sessionId) {
        for (const [id, raw] of s.perms) { s.send({ id: raw, result: { outcome: { outcome: 'cancelled' } } }); s.emit({ type: 'permission_done', id }); }
        s.perms.clear();
        s.send({ method: 'session/cancel', params: { sessionId: s.sessionId } });
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && action === 'conversations') {
      const agent = agentOf(name);
      return send(res, 200, { current: readOpt(name, '.session'), list: pastSessions(name).filter(c => c.agent === agent) });
    }
    if (req.method === 'POST' && action === 'conversations' && (parts.at(-1) === 'new' || parts.at(-1) === 'open')) {
      if (sessions.get(name)?.busy) return send(res, 409, { error: 'The agent is still working.' });
      const file = path.join(dirFor(name), '.session');
      // ponytail: conversations from before this list existed get a generic title
      if (parts.at(-1) === 'new') { rememberSession(name, readOpt(name, '.session'), agentOf(name), 'Earlier conversation'); stopSession(name); fs.rmSync(file, { force: true }); return send(res, 200, { ok: true }); }
      const { id } = await readJson(req);
      if (!pastSessions(name).some(c => c.id === id && c.agent === agentOf(name))) return send(res, 404, { error: 'no such conversation' });
      stopSession(name);
      fs.writeFileSync(file, id);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'agent') {
      const { agent } = await readJson(req);
      if (!AGENTS[agent]) return send(res, 400, { error: 'unknown agent' });
      if (sessions.get(name)?.busy) return send(res, 409, { error: 'The agent is still working.' });
      stopSession(name);
      fs.mkdirSync(dirFor(name), { recursive: true });
      fs.writeFileSync(path.join(dirFor(name), '.agent'), agent);
      fs.rmSync(path.join(dirFor(name), '.session'), { force: true }); // sessions don't carry across agents
      return send(res, 200, { agent });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
  }
});

if (process.argv[1] === import.meta.filename) {
  server.listen(PORT, '127.0.0.1', () => console.log(`Studio → http://localhost:${PORT}  (agent: ${DEFAULT_AGENT})`));
  setInterval(autopilotTick, 60e3).unref();
  process.on('SIGINT', () => { for (const n of sessions.keys()) stopSession(n); process.exit(0); });
}
