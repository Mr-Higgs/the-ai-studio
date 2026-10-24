// Studio API — one Vercel function. Auth = Supabase Bearer token; per-user data in Postgres.
import fs from 'node:fs';
import path from 'node:path';
import { admin, userFromReq } from './_lib/supabase.js';
import { enc, dec } from './_lib/secrets.js';
import { activeBusiness, businessState, listBusinesses, switchBusiness, newBusiness, snapshot, exportMarkdown, cleanCalendar, BUSINESS_DOCS } from './_lib/business.js';
import { devinCreds, devinClient } from './_lib/devin.js';
import { buildContext, sessionPrompt, applyStructuredOutput, STRUCTURED_SCHEMA } from './_lib/prompts.js';

export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const validProject = name => SLUG.test(name) && name !== '_template';
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = async req => req.body ?? JSON.parse(await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b || '{}')); }));
const BIZ_FIELDS = { 'brain.json': 'brain', 'profile.json': 'profile', 'inputs.json': 'inputs', 'tracker.json': 'tracker', 'sprint.json': 'sprint', 'calendar.json': 'calendar' };
const ENV_KEYS = { DEVIN_API_KEY: 'devin_api_key', DEVIN_ORG_ID: 'devin_org_id', HEYGEN_API_KEY: 'heygen_api_key' };
// Meta's remote MCP servers. Devin is the MCP client, so users add these in their own Devin
// org (Customize → MCPs); the toggle here only tells Devin it may use them.
export const INTEGRATIONS = {
  meta_ads: { name: 'Meta Ads (Facebook + Instagram)', url: 'https://mcp.facebook.com/ads', why: 'Lets Devin read your ad performance and draft paused ads and campaigns.',
    prompt: 'The owner connected the Meta Ads MCP server (https://mcp.facebook.com/ads) in Devin. Use its tools to read their ad accounts, campaign performance and audiences when it helps. Never publish, activate or spend: create any new campaign, ad set or ad as PAUSED, and tell the owner exactly what to review and switch on.' },
  meta_social: { name: 'Meta Social Technologies (developers)', url: 'https://mcp.facebook.com/devtools', why: 'For owners who build their own Meta app — webhooks, app review, API health.',
    prompt: 'The owner connected the Meta Social Technologies MCP server (https://mcp.facebook.com/devtools) in Devin. Use it read-only to check their Meta app setup (webhooks, app status) when relevant; don’t change configuration without asking.' },
};
export function integrationNotes(on) {
  const lines = Object.entries(INTEGRATIONS).filter(([id]) => on?.[id]).map(([, i]) => i.prompt);
  return lines.length ? `Connected tools:\n- ${lines.join('\n- ')}` : null;
}
const SNAP_ALLOWED = [...BUSINESS_DOCS.map(d => `${d}.md`), 'calendar.json'];

async function settings(uid) {
  const { data } = await admin().from('user_settings').select('*').eq('user_id', uid).maybeSingle();
  return data || {};
}
async function heygen(uid, apiPath, json) {
  const raw = (await settings(uid)).heygen_api_key;
  const k = raw ? dec(raw) : null;
  if (!k || k === 'your_api_key_here') throw Object.assign(new Error('Add your HeyGen API key in Setup, then try again.'), { status: 400 });
  const r = await fetch(`https://api.heygen.com${apiPath}`, json
    ? { method: 'POST', headers: { 'X-Api-Key': k, 'Content-Type': 'application/json' }, body: JSON.stringify(json) }
    : { headers: { 'X-Api-Key': k } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error('HeyGen rejected the key. Replace your HeyGen API key in Setup.'), { status: 400 });
  if (r.status === 429) throw Object.assign(new Error('HeyGen is rate-limiting. Wait a minute and try again.'), { status: 429 });
  if (!r.ok) throw Object.assign(new Error(body.error?.message || body.message || `HeyGen error ${r.status}`), { status: 502 });
  return body;
}

const HEYGEN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ASPECTS = ['9:16', '1:1', '16:9'];

async function agentRow(uid, bizId, scope) {
  const { data } = await admin().from('agent_sessions').select('*').eq('user_id', uid).eq('business_id', bizId).eq('scope', scope).maybeSingle();
  return data;
}
async function agentUpsert(uid, bizId, scope, fields) {
  await admin().from('agent_sessions').upsert({ user_id: uid, business_id: bizId, scope, ...fields }, { onConflict: 'business_id,scope' });
}

// v3 status: new | claimed | running | resuming | suspended | exit | error; while running,
// status_detail says whether Devin is working or waiting on the user.
export const isBusy = s => ['new', 'claimed', 'resuming'].includes(s.status)
  || (s.status === 'running' && (!s.status_detail || s.status_detail === 'working'));

// Apply Devin's structured output to docs/calendar when its hash changed.
async function applyOutput(uid, biz, row, session) {
  const so = session.structured_output;
  const applied = applyStructuredOutput(so);
  if (!applied || applied.hash === row.applied_hash) return null;
  const db = admin();
  for (const [kind, content] of Object.entries(applied.docs)) {
    const { data: prev } = await db.from('docs').select('content').eq('user_id', uid).eq('business_id', biz.id).eq('kind', kind).maybeSingle();
    if (prev && prev.content !== content) await snapshot(uid, biz.id, kind, prev.content);
    await db.from('docs').upsert({ user_id: uid, business_id: biz.id, kind, content, updated_at: new Date().toISOString() }, { onConflict: 'business_id,kind' });
  }
  if (applied.calendar) {
    await snapshot(uid, biz.id, 'calendar', JSON.stringify(biz.calendar));
    await db.from('businesses').update({ calendar: applied.calendar, calendar_issues: applied.issues, updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
  }
  return { applied: [...Object.keys(applied.docs), ...(applied.calendar ? ['calendar'] : [])], hash: applied.hash };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health' && !/^Bearer /.test(req.headers.authorization || ''))
      return send(res, 200, { hosted: true, items: [] });
    const user = await userFromReq(req);
    if (!user) return send(res, 401, { error: 'Sign in first.' });
    const uid = user.id;
    const db = admin();

    if (req.method === 'GET' && url.pathname === '/api/auth/me') return send(res, 200, { hosted: true, email: user.email });
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const s = await settings(uid);
      return send(res, 200, { hosted: true, items: [
        { id: 'devin', group: 'required', name: 'Devin API key + Org ID', why: 'Runs the assistant on your own Devin account.', ok: !!(s.devin_api_key && s.devin_org_id), key: 'DEVIN_API_KEY', key2: 'DEVIN_ORG_ID', link: 'https://app.devin.ai/settings' },
        ...Object.entries(INTEGRATIONS).map(([id, i]) => ({ id, group: 'integrations', name: i.name, why: i.why, url: i.url, toggle: true, ok: !!s.integrations?.[id] })),
        { id: 'heygen', group: 'optional', name: 'HeyGen API key', why: 'Imports your HeyGen videos and makes new ones from your avatars.', ok: !!s.heygen_api_key, key: 'HEYGEN_API_KEY', link: 'https://app.heygen.com/settings?nav=API' },
      ] });
    }
    if (req.method === 'POST' && url.pathname === '/api/setup/env') {
      const { name, value } = await readJson(req);
      const col = ENV_KEYS[name];
      if (!col) return send(res, 400, { error: 'unknown key' });
      if (!/^[\x21-\x7e]{4,1024}$/.test(value || '')) return send(res, 400, { error: 'That doesn’t look like an API key. Paste it again with no spaces.' });
      await db.from('user_settings').upsert({ user_id: uid, [col]: enc(value), updated_at: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/setup/integration') {
      const { id, on } = await readJson(req);
      if (!INTEGRATIONS[id]) return send(res, 400, { error: 'unknown integration' });
      const s = await settings(uid);
      await db.from('user_settings').upsert({ user_id: uid, integrations: { ...(s.integrations || {}), [id]: !!on }, updated_at: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }

    // ---- business state ----
    if (req.method === 'GET' && url.pathname === '/api/business') return send(res, 200, await businessState(uid));
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'business' && BIZ_FIELDS[parts[2]]) {
      const biz = await activeBusiness(uid);
      const data = await readJson(req);
      const col = BIZ_FIELDS[parts[2]];
      if (col === 'brain') {
        if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 200000) return send(res, 400, { error: 'bad brain' });
        await db.from('businesses').update({ brain: data, brain_updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
        return send(res, 200, { ok: true });
      }
      const fields = { updated_at: new Date().toISOString(), [col]: col === 'calendar' ? cleanCalendar(data).items : data };
      if (col === 'calendar') fields.calendar_issues = cleanCalendar(data).issues;
      await db.from('businesses').update(fields).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/businesses') return send(res, 200, await listBusinesses(uid));
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'businesses' && ['new', 'switch'].includes(parts[2])) {
      const { id } = await readJson(req);
      if (parts[2] === 'switch') await switchBusiness(uid, id); else await newBusiness(uid);
      return send(res, 200, await listBusinesses(uid));
    }
    if (req.method === 'GET' && url.pathname === '/api/business/export.md') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="sprint.md"' });
      return res.end(await exportMarkdown(uid));
    }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'business' && parts[2] === 'history' && parts.length === 4) {
      const { data } = await db.from('doc_history').select('kind, content').eq('user_id', uid).eq('id', parts[3]).maybeSingle();
      if (!data) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': data.kind === 'calendar' ? 'application/json' : 'text/markdown; charset=utf-8' });
      return res.end(data.content);
    }

    // ---- projects + storage ----
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const { data: projs } = await db.from('projects').select('name').eq('user_id', uid).order('created_at');
      const projects = [];
      for (const p of projs || []) {
        const { data: files } = await db.storage.from('videos').list(`${uid}/${p.name}`);
        const videos = [];
        for (const f of (files || []).filter(f => /\.mp4$/i.test(f.name))) {
          const { data: s } = await db.storage.from('videos').createSignedUrl(`${uid}/${p.name}/${f.name}`, 3600);
          if (s?.signedUrl) videos.push({ file: f.name, url: s.signedUrl });
        }
        projects.push({ name: p.name, videos });
      }
      return send(res, 200, { projects, defaultAgent: 'devin' });
    }
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const { name } = await readJson(req);
      if (!validProject(name)) return send(res, 400, { error: 'Use lowercase letters, numbers and dashes.' });
      const { error } = await db.from('projects').insert({ user_id: uid, name });
      if (error) return send(res, 409, { error: 'A project with that name exists.' });
      return send(res, 201, { name });
    }

    // ---- HeyGen passthrough (per-user key) ----
    if (req.method === 'GET' && url.pathname === '/api/heygen/videos') {
      const q = new URLSearchParams({ limit: '24' });
      if (url.searchParams.get('token')) q.set('token', url.searchParams.get('token'));
      const r = await heygen(uid, `/v3/videos?${q}`);
      const videos = (r.data || []).filter(v => v.status === 'completed' && HEYGEN_ID.test(v.id))
        .map(({ id, title, thumbnail_url, duration, created_at }) => ({ id, title, thumbnail_url, duration, created_at }));
      return send(res, 200, { videos, next_token: r.has_more ? r.next_token : null });
    }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'heygen' && parts[2] === 'videos' && parts.length === 4) {
      if (!HEYGEN_ID.test(parts[3])) return send(res, 400, { error: 'bad video id' });
      const { data } = await heygen(uid, `/v3/videos/${parts[3]}`);
      return send(res, 200, { status: data?.status, failure_message: data?.failure_message || null });
    }
    if (req.method === 'GET' && url.pathname === '/api/heygen/avatars') {
      const avatars = [];
      let token = '';
      for (let i = 0; i < 3; i++) {
        const r = await heygen(uid, `/v3/avatars/looks?${new URLSearchParams({ ownership: 'private', limit: '50', ...(token && { token }) })}`);
        for (const a of r.data || []) if ((a.status ?? 'completed') === 'completed' && HEYGEN_ID.test(a.id)) avatars.push({ id: a.id, name: a.name, avatar_type: a.avatar_type, preview_image_url: a.preview_image_url });
        if (!r.has_more || !r.next_token) break;
        token = r.next_token;
      }
      return send(res, 200, { avatars });
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'projects' && validProject(parts[2] || '') && parts[3] === 'heygen') {
      const name = parts[2];
      if (parts[4] === 'generate') {
        const { avatar_id, script, aspect_ratio } = await readJson(req);
        if (!HEYGEN_ID.test(avatar_id || '')) return send(res, 400, { error: 'Pick an avatar.' });
        const text = String(script || '').trim();
        if (!text || text.length > 5000) return send(res, 400, { error: 'Write a script (up to 5000 characters).' });
        if (!ASPECTS.includes(aspect_ratio)) return send(res, 400, { error: 'bad aspect ratio' });
        const { data } = await heygen(uid, '/v3/videos', { type: 'avatar', avatar_id, script: text, aspect_ratio, title: `${name} · Studio` });
        return send(res, 202, { video_id: data?.video_id });
      }
      const { id } = await readJson(req);
      if (!HEYGEN_ID.test(id || '')) return send(res, 400, { error: 'bad video id' });
      const { data } = await heygen(uid, `/v3/videos/${id}`);
      if (data?.status !== 'completed' || !data.video_url) return send(res, 409, { error: 'That HeyGen video isn’t finished yet.' });
      const dl = await fetch(data.video_url);
      if (!dl.ok) return send(res, 502, { error: `Download failed (${dl.status})` });
      if (Number(dl.headers.get('content-length')) > 200e6) return send(res, 413, { error: 'That video is over 200 MB.' });
      const buf = Buffer.from(await dl.arrayBuffer());
      const { error } = await db.storage.from('videos').upload(`${uid}/${name}/heygen-${id}.mp4`, buf, { contentType: 'video/mp4', upsert: true });
      if (error) return send(res, 502, { error: error.message });
      return send(res, 201, { file: `heygen-${id}.mp4` });
    }

    // ---- agent (Devin cloud sessions) ----
    if (parts[0] === 'api' && parts[1] === 'agent' && parts[2]) {
      const scope = parts[2] === 'business' ? 'business' : validProject(parts[2]) ? parts[2] : null;
      if (!scope) return send(res, 404, { error: 'not found' });
      const action = parts[3];
      const biz = await activeBusiness(uid);
      let row = await agentRow(uid, biz.id, scope);

      if (req.method === 'POST' && action === 'new') {
        if (row) await agentUpsert(uid, biz.id, scope, { devin_session_id: null, devin_status: null, applied_hash: null });
        return send(res, 200, { ok: true });
      }
      const creds = await devinCreds(uid); // throws 400 with setup hint when missing
      const client = devinClient(creds);

      if (req.method === 'POST' && action === 'prompt') {
        const { text, snapshot: snap } = await readJson(req);
        if (!text?.trim()) return send(res, 400, { error: 'empty message' });
        if (snap != null && (scope !== 'business' || !SNAP_ALLOWED.includes(snap))) return send(res, 400, { error: 'bad snapshot' });
        if (row?.devin_session_id) { // refresh status before deciding
          try { const s = await client.getSession(row.devin_session_id); row.devin_status = s.status_enum || s.status; } catch { row.devin_status = 'expired'; }
        }
        if (snap) {
          const kind = snap.replace(/\.(md|json)$/, '');
          const cur = await businessState(uid);
          const content = snap === 'calendar.json' ? JSON.stringify(cur.calendar) : cur.docs[kind]?.content;
          if (content != null) await snapshot(uid, biz.id, kind, content);
        }
        if (!row?.devin_session_id || ['expired', 'finished', 'suspended', 'exit', 'error'].includes(row.devin_status)) {
          const { data: docs } = await db.from('docs').select('kind, content, updated_at').eq('user_id', uid).eq('business_id', biz.id);
          const docMap = Object.fromEntries((docs || []).map(d => [d.kind, d]));
          const b2 = { ...biz, calendar: biz.calendar };
          const ctx = buildContext(b2, docMap);
          const extra = [scope !== 'business' ? `This conversation is about the promo video project '${scope}'.` : null, integrationNotes((await settings(uid)).integrations)].filter(Boolean).join('\n\n') || null;
          let skill = null;
          if (snap === 'offer.md') try { skill = fs.readFileSync(path.join(process.cwd(), '.devin/skills/grand-slam-offer/SKILL.md'), 'utf8'); } catch {}
          const s = await client.createSession({ prompt: sessionPrompt(ctx, text.trim(), { skill, extra }), title: `${biz.name || biz.profile?.name || 'Studio'} · Studio`, schema: STRUCTURED_SCHEMA, tags: ['studio'] });
          await agentUpsert(uid, biz.id, scope, { devin_session_id: s.session_id, devin_status: 'working', last_prompt_at: new Date().toISOString() });
        } else {
          await client.sendMessage(row.devin_session_id, text.trim());
          await agentUpsert(uid, biz.id, scope, { devin_status: 'working', last_prompt_at: new Date().toISOString() });
        }
        return send(res, 202, { ok: true });
      }

      if (req.method === 'GET' && action === 'poll') {
        if (!row?.devin_session_id) return send(res, 200, { messages: [], busy: false });
        const [s, msgs] = await Promise.all([client.getSession(row.devin_session_id), client.getMessages(row.devin_session_id)]);
        const status = s.status_enum || s.status;
        const cursor = url.searchParams.get('cursor');
        const items = (msgs.items || []).map(m => ({ id: m.event_id, kind: m.source === 'user' ? 'user' : 'agent', text: m.message, at: m.created_at }));
        const seen = cursor ? items.findIndex(m => m.id === cursor) : -1;
        const messages = seen >= 0 ? items.slice(seen + 1) : items;
        const res2 = await applyOutput(uid, biz, row, s);
        if (res2) await agentUpsert(uid, biz.id, scope, { applied_hash: res2.hash });
        const busy = isBusy(s);
        if (row.devin_status !== status) await agentUpsert(uid, biz.id, scope, { devin_status: status });
        const starting = busy && !items.some(m => m.kind === 'agent') && Date.now() - Date.parse(row.last_prompt_at || 0) < 180000;
        return send(res, 200, { messages, busy, starting, ...(res2?.applied?.length && { applied: res2.applied }) });
      }
      return send(res, 404, { error: 'not found' });
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
  }
}
