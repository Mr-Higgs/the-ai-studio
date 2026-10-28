// Studio API — one Vercel function. Auth = Supabase Bearer token; per-user data in Postgres.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { admin, userFromReq } from './_lib/supabase.js';
import { enc, dec } from './_lib/secrets.js';
import { activeBusiness, businessState, listBusinesses, switchBusiness, newBusiness, snapshot, exportMarkdown, cleanCalendar, cleanExperiments, cleanPosts, BUSINESS_DOCS } from './_lib/business.js';
import { devinCreds, devinClient } from './_lib/devin.js';
import { cleanBrain, mergeDevinAnswers } from '../ui/web/src/brain.js';
import { contextParts, changedParts, partHashes, offerSkill, siteSkill, sessionPrompt, applyStructuredOutput, STRUCTURED_SCHEMA, GROUNDING } from './_lib/prompts.js';
import { applyAdSpend, findInstagramAccounts, normalizeAccountId, NO_INSTAGRAM_ACCOUNT_MESSAGE, syncAds, syncInstagram, tryConnectInstagram } from './_lib/meta.js';
import { leadToken, LEAD_TOKEN, cleanLead, appendLead, leadFormHtml } from './_lib/leads.js';
import { pkce, randomState, redirectUri, registerClient, buildAuthorizeUrl, exchangeCode, refreshTokens, toStored, revoke, API_BASE } from './_lib/heygen-oauth.js';
import * as google from './_lib/google-oauth.js';

export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const validProject = name => SLUG.test(name) && name !== '_template';
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = async req => req.body ?? JSON.parse(await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b || '{}')); }));
const BIZ_FIELDS = { 'brain.json': 'brain', 'profile.json': 'profile', 'inputs.json': 'inputs', 'tracker.json': 'tracker', 'sprint.json': 'sprint', 'calendar.json': 'calendar', 'experiments.json': 'experiments', 'posts.json': 'posts' };
const ENV_KEYS = { DEVIN_API_KEY: 'devin_api_key', DEVIN_ORG_ID: 'devin_org_id', HEYGEN_API_KEY: 'heygen_api_key' };
// MCP servers Devin can use. Devin is the MCP client, so users add these in their own Devin
// org (Customize → MCPs): Meta's as custom remote servers (`url`), the rest from Devin's
// marketplace (`marketplace` = listing name). The toggle here only tells Devin it may use them.
export const INTEGRATIONS = {
  meta_ads: { name: 'Meta Ads (Facebook + Instagram)', url: 'https://mcp.facebook.com/ads', why: 'Lets Devin read your ad performance and draft paused ads and campaigns.',
    prompt: 'The owner connected the Meta Ads MCP server (https://mcp.facebook.com/ads) in Devin. Use its tools to read their ad accounts, campaign performance and audiences when it helps. Never publish, activate or spend: create any new campaign, ad set or ad as PAUSED, and tell the owner exactly what to review and switch on.' },
  meta_social: { name: 'Meta Social Technologies (developers)', url: 'https://mcp.facebook.com/devtools', why: 'For owners who build their own Meta app — webhooks, app review, API health.',
    prompt: 'The owner connected the Meta Social Technologies MCP server (https://mcp.facebook.com/devtools) in Devin. Use it read-only to check their Meta app setup (webhooks, app status) when relevant; don’t change configuration without asking.' },
  hubspot: { name: 'HubSpot', marketplace: 'HubSpot', why: 'Lets Devin read your contacts, deals and lists to aim offers at real customers.',
    prompt: 'The owner connected HubSpot in Devin. Read their contacts, companies, deals and lists to ground audiences, offers and follow-ups in real customer data. Never send emails, enroll contacts or change records without asking.' },
  stripe: { name: 'Stripe', marketplace: 'Stripe', why: 'Lets Devin check your products, prices and recent sales against the offer math.',
    prompt: 'The owner connected Stripe in Devin. Use it read-only to check products, prices and recent sales against the offer math and tracker. Never create charges, refunds, payment links or change prices without asking.' },
  square: { name: 'Square', marketplace: 'Square', why: 'Lets Devin check your catalog and recent sales against the offer math.',
    prompt: 'The owner connected Square in Devin. Use it read-only to check their catalog, prices and recent sales against the offer math and tracker. Never take payments, issue refunds or change the catalog without asking.' },
  notion: { name: 'Notion', marketplace: 'Notion', why: 'Lets Devin read the notes and plans you already keep in Notion.',
    prompt: 'The owner connected Notion in Devin. Read their existing pages for context on the business when it helps. Only create or edit pages when the owner asks.' },
  airtable: { name: 'Airtable', marketplace: 'Airtable', why: 'Lets Devin read the customer lists and trackers you keep in Airtable.',
    prompt: 'The owner connected Airtable in Devin. Read their bases for customer lists, leads and trackers when it helps. Only create or edit records when the owner asks.' },
  firecrawl: { name: 'Firecrawl', marketplace: 'Firecrawl', why: 'Lets Devin read competitor websites for positioning research.',
    prompt: 'The owner connected Firecrawl in Devin. Use it to read competitor and reference websites (from the profile or brain) for positioning, pricing and messaging research. Cite the pages you used.' },
  google_maps: { name: 'Google Maps', marketplace: 'Google Maps', why: 'Lets Devin look up local competitors, ratings and review themes near you.',
    prompt: 'The owner connected Google Maps in Devin. Use it to find local competitors near the business, their categories, ratings and common review themes. Cite the places you used.' },
};
export const metaHealthItem = (settings, instagram = null) => ({
  id: 'meta_api',
  group: 'optional',
  name: 'Meta ad results',
  why: 'Studio reads spend, clicks and leads from your Meta ad account. Read-only.',
  ok: !!(settings.meta_access_token && settings.meta_ad_account_id),
  meta: true,
  instagram: instagram || null,
});
// Account label shown on the Setup row; tokens never leave the ciphertext column.
const heygenAccount = s => {
  try { return s.heygen_oauth ? JSON.parse(dec(s.heygen_oauth)).account || null : null; }
  catch { return null; }
};
// The Setup row's view of the Google connection — everything except tokens.
const googleAccount = s => {
  try {
    if (!s.google_oauth) return null;
    const stored = JSON.parse(dec(s.google_oauth));
    return {
      email: stored.account?.email || null,
      locations: (stored.locations || []).map(l => ({ name: l.name, title: l.title, address: l.address })),
      location: stored.location?.name || null,
      pending: !!stored.pending_approval,
    };
  } catch { return null; }
};
// The chosen listing's full summary, inlined into Devin context as the authoritative NAP.
async function gbpFor(uid) {
  try {
    const s = await settings(uid);
    if (!s.google_oauth) return null;
    const stored = JSON.parse(dec(s.google_oauth));
    return (stored.locations || []).find(l => l.name === stored.location?.name) || null;
  } catch { return null; }
}
// A valid Google access token, refreshing and re-encrypting when near expiry.
async function googleAuth(uid) {
  const s = await settings(uid);
  if (s.google_oauth) {
    let stored = null;
    try { stored = JSON.parse(dec(s.google_oauth)); } catch { stored = null; }
    if (stored?.access_token) {
      if ((stored.expires_at || 0) - 60000 < Date.now() && stored.refresh_token) {
        try {
          const t = await google.refreshTokens({ refreshToken: stored.refresh_token });
          stored = { ...google.toStored(t, stored), pending_approval: stored.pending_approval, account: stored.account };
          await settingsUpsert(uid, { google_oauth: enc(JSON.stringify(stored)) });
        } catch {
          await settingsUpsert(uid, { google_oauth: null });
          throw Object.assign(new Error('Your Google connection expired. Reconnect Google Business Profile in Setup.'), { status: 400 });
        }
      }
      return stored.access_token;
    }
  }
  throw Object.assign(new Error('Connect Google Business Profile in Setup first.'), { status: 400 });
}
// Read every account's locations and keep them in the ciphertext; one location auto-selects.
async function syncGoogleLocations(uid) {
  const token = await googleAuth(uid);
  const s = await settings(uid);
  const stored = s.google_oauth ? JSON.parse(dec(s.google_oauth)) : {};
  const persist = fields => settingsUpsert(uid, { google_oauth: enc(JSON.stringify({ ...stored, ...fields })) });
  try {
    const accounts = await google.listAccounts(token);
    const locations = [];
    for (const a of accounts.slice(0, 5)) locations.push(...(await google.listLocations(token, a.name)).map(google.locationSummary));
    const location = locations.length === 1 ? locations[0] : (locations.find(l => l.name === stored.location?.name) || null);
    await persist({ locations, location, pending_approval: false });
    return { pending: false };
  } catch (e) {
    if (e.code === 'pending_approval') { await persist({ pending_approval: true }); return { pending: true }; }
    throw e;
  }
}
// Browser-redirect target for the Google OAuth flow — unauthenticated; the pending row's
// `state` identifies the user. Never puts tokens in the page or logs.
async function googleOauthCallback(res, url) {
  const err = url.searchParams.get('error');
  if (err) return htmlPage(res, `<p>Google didn’t connect: ${escHtml(url.searchParams.get('error_description') || err)}. Close this tab and try again.</p>`);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '';
  const { data: rows } = await admin().from('user_settings').select('user_id, google_oauth_pending').not('google_oauth_pending', 'is', null);
  let hit = null;
  for (const row of rows || []) {
    let p = null;
    try { p = JSON.parse(dec(row.google_oauth_pending)); } catch { continue; }
    if (!p?.state || Date.now() - (p.created_at || 0) > 15 * 60 * 1000) continue;
    const a = Buffer.from(String(p.state)), b = Buffer.from(state);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) { hit = { uid: row.user_id, pending: p }; break; }
  }
  if (!hit || !code) return htmlPage(res, '<p>This sign-in link expired. Go back to Studio Setup and click Connect Google Business Profile again.</p>', 400);
  try {
    const tokens = await google.exchangeCode({ code, redirectUri: hit.pending.redirect_uri });
    const stored = google.toStored(tokens, {});
    const info = await google.userInfo(stored.access_token);
    if (info.email) stored.account = { email: info.email };
    await settingsUpsert(hit.uid, { google_oauth: enc(JSON.stringify(stored)), google_oauth_pending: null });
    try { await syncGoogleLocations(hit.uid); } catch { /* picks up again on Check again */ }
    return htmlPage(res, `<p>Google Business Profile connected. You can close this tab.</p><script>try{window.opener&&window.opener.postMessage({type:'google-connected'},'*')}catch(e){};setTimeout(()=>window.close(),800)</script>`);
  } catch (e) {
    return htmlPage(res, `<p>Google didn’t connect: ${escHtml(e.message)}. Close this tab and try again.</p>`);
  }
}
// Devin has no API for adding org MCPs and Meta needs the owner's own Facebook login, so for
// custom (url) servers a Devin session walks them through it, then checks the tools respond.
const SETUP_SCHEMA = { type: 'object', properties: { connected: { type: 'boolean' }, note: { type: 'string' } }, required: ['connected', 'note'] };
const setupPrompt = i => `You are helping a small business owner who is not technical connect "${i.name}" to their Devin account as an MCP server. Be warm and plain-spoken. Give ONE step per message and wait for them to reply before the next.

1. Open https://app.devin.ai/customize?tab=mcps, choose "Add MCP", then "Add custom MCP". (No button? They need the Manage MCP Servers permission from their Devin org admin.)
2. Fill in: Server Name "${i.name}", Transport "HTTP", Server URL ${i.url}, Authentication "OAuth", Access "Personal". Save.
3. Choose "Connect" on the new server and sign in with the Facebook account that manages their business, approving every permission asked.
4. When they say it's done, call one read-only tool from the server (e.g. list their ad accounts or app info) to check it works. Never create, change, publish or spend anything.

Set the structured output: connected=true only after a tool call succeeded; otherwise connected=false. note = one plain sentence for the owner. If the server's tools don't show up in this session, set connected=false and tell them to go back to Studio Setup and click "Set up with Devin" again — a fresh session will see it.`;

export function integrationNotes(on) {
  const lines = Object.entries(INTEGRATIONS).filter(([id]) => on?.[id]).map(([, i]) => i.prompt);
  return lines.length ? `Connected tools:\n- ${lines.join('\n- ')}` : null;
}
const SNAP_ALLOWED = [...BUSINESS_DOCS.map(d => `${d}.md`), 'calendar.json'];
const SITE_REQUEST = `My request: Build and publish my website by following the site-build skill above, start to finish. Begin by sending me the first message the skill describes, then design, build, run the anti-generic-audit until everything passes, publish to GitHub Pages, and send me the live link with desktop and phone screenshots. I’m not technical — keep every message in plain words and never ask me a technical question.`;
const DEAD_STATUSES = ['expired', 'finished', 'suspended', 'exit', 'error'];

async function settings(uid) {
  const { data } = await admin().from('user_settings').select('*').eq('user_id', uid).maybeSingle();
  return data || {};
}
const settingsUpsert = (uid, fields) =>
  admin().from('user_settings').upsert({ user_id: uid, ...fields, updated_at: new Date().toISOString() });

// HeyGen credentials: OAuth bearer (plan credits) preferred, API key (API credits) as fallback.
async function heygenAuth(uid) {
  const s = await settings(uid);
  if (s.heygen_oauth) {
    let stored = null;
    try { stored = JSON.parse(dec(s.heygen_oauth)); } catch { stored = null; }
    if (stored?.access_token) {
      if ((stored.expires_at || 0) - 60000 < Date.now() && stored.refresh_token) {
        try {
          const t = await refreshTokens({ clientId: stored.client_id, refreshToken: stored.refresh_token });
          stored = toStored(t, stored.client_id, stored);
          await settingsUpsert(uid, { heygen_oauth: enc(JSON.stringify(stored)) });
        } catch {
          await settingsUpsert(uid, { heygen_oauth: null });
          throw Object.assign(new Error('Your HeyGen connection expired. Reconnect HeyGen in Setup.'), { status: 400 });
        }
      }
      return { headers: { Authorization: `Bearer ${stored.access_token}` }, mode: 'oauth' };
    }
  }
  const k = s.heygen_api_key ? dec(s.heygen_api_key) : null;
  if (k && k !== 'your_api_key_here') return { headers: { 'X-Api-Key': k }, mode: 'key' };
  throw Object.assign(new Error('Connect HeyGen in Setup, then try again.'), { status: 400 });
}
async function heygen(uid, apiPath, json) {
  const { headers, mode } = await heygenAuth(uid);
  const r = await fetch(`${API_BASE}${apiPath}`, json
    ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(json) }
    : { headers });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error(mode === 'oauth'
    ? 'HeyGen rejected the connection. Reconnect HeyGen in Setup.'
    : 'HeyGen rejected the key. Replace your HeyGen API key in Setup.'), { status: 400 });
  if (r.status === 403 && body.error?.code === 'api_key_required')
    throw Object.assign(new Error('This HeyGen feature needs an API key (API credits). Add one in Setup.'), { status: 400 });
  if (r.status === 429) throw Object.assign(new Error('HeyGen is rate-limiting. Wait a minute and try again.'), { status: 429 });
  if (!r.ok) throw Object.assign(new Error(body.error?.message || body.message || `HeyGen error ${r.status}`), { status: 502 });
  return body;
}

const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const htmlPage = (res, inner, code = 200) => {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>HeyGen</title><body style="font-family:system-ui;padding:2em">${inner}</body>`);
};
// Browser-redirect target for the HeyGen OAuth flow — unauthenticated; the pending row's
// `state` identifies the user. Never puts tokens in the page or logs.
// Failure page: show the reason and post it to the opener so the UI can react (e.g. an
// unallowlisted redirect_uri means telling the user to fall back to an API key).
const heygenFailPage = (res, text) => {
  const reason = /redirect_uri/i.test(text) ? 'redirect_uri' : 'other';
  const msg = reason === 'redirect_uri'
    ? 'HeyGen hasn’t approved sign-in from this site yet. Close this tab and use a HeyGen API key in Studio instead.'
    : `HeyGen didn’t connect: ${text}. Close this tab and try again.`;
  const payload = JSON.stringify({ type: 'heygen-failed', reason, message: msg }).replace(/<\//g, '<\\/');
  return htmlPage(res, `<p>${escHtml(msg)}</p><script>try{window.opener&&window.opener.postMessage(${payload},'*')}catch(e){}</script>`);
};
async function heygenOauthCallback(res, url) {
  const err = url.searchParams.get('error');
  if (err) return heygenFailPage(res, url.searchParams.get('error_description') || err);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '';
  const { data: rows } = await admin().from('user_settings').select('user_id, heygen_oauth_pending').not('heygen_oauth_pending', 'is', null);
  let hit = null;
  for (const row of rows || []) {
    let p = null;
    try { p = JSON.parse(dec(row.heygen_oauth_pending)); } catch { continue; }
    if (!p?.state || Date.now() - (p.created_at || 0) > 15 * 60 * 1000) continue;
    const a = Buffer.from(String(p.state)), b = Buffer.from(state);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) { hit = { uid: row.user_id, pending: p }; break; }
  }
  if (!hit || !code) return htmlPage(res, '<p>This sign-in link expired. Go back to Studio and click Connect HeyGen again.</p>', 400);
  try {
    const tokens = await exchangeCode({ clientId: hit.pending.client_id, code, verifier: hit.pending.verifier, redirectUri: hit.pending.redirect_uri });
    const stored = toStored(tokens, hit.pending.client_id);
    try { // best-effort account label for the Setup row
      const r = await fetch(`${API_BASE}/v3/users/me`, { headers: { Authorization: `Bearer ${stored.access_token}` } });
      if (r.ok) {
        const b = await r.json().catch(() => ({}));
        const u = b.data || b;
        stored.account = { email: u.email || null, username: u.username || u.name || null, plan: u.plan || null };
      }
    } catch { /* account label is optional */ }
    await settingsUpsert(hit.uid, { heygen_oauth: enc(JSON.stringify(stored)), heygen_oauth_pending: null });
    return htmlPage(res, `<p>HeyGen connected. You can close this tab.</p><script>try{window.opener&&window.opener.postMessage({type:'heygen-connected'},'*')}catch(e){};setTimeout(()=>window.close(),800)</script>`);
  } catch (e) {
    return heygenFailPage(res, e.message);
  }
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
// Public lead form lives at /api/lead/<token>; forwarded headers carry the real origin on Vercel.
const leadFormUrl = (req, token) => {
  if (!token) return null;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (String(host || '').startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/lead/${token}`;
};

// Docs + business context for a new Devin session's first prompt.
async function docContext(uid, biz, req) {
  const { data: docs } = await admin().from('docs').select('kind, content, updated_at').eq('user_id', uid).eq('business_id', biz.id);
  const docMap = Object.fromEntries((docs || []).map(d => [d.kind, d]));
  const b2 = { ...biz, calendar: biz.calendar, adInsights: biz.ad_insights || null, instagramInsights: biz.instagram_insights || null, leadFormUrl: leadFormUrl(req, biz.lead_token), gbp: await gbpFor(uid) };
  const parts = contextParts(b2, docMap);
  return { docMap, b2, parts, ctx: parts.map(part => part.text).join('\n\n') };
}

async function latestContext(uid, bizId, req) {
  const db = admin();
  const [{ data: biz }, { data: docs }] = await Promise.all([
    db.from('businesses').select('*').eq('user_id', uid).eq('id', bizId).maybeSingle(),
    db.from('docs').select('kind, content, updated_at').eq('user_id', uid).eq('business_id', bizId),
  ]);
  const docMap = Object.fromEntries((docs || []).map(d => [d.kind, d]));
  const contextBiz = biz ? { ...biz, adInsights: biz.ad_insights || null, instagramInsights: biz.instagram_insights || null, leadFormUrl: leadFormUrl(req, biz.lead_token), gbp: await gbpFor(uid) } : null;
  return { biz: contextBiz, parts: contextBiz ? contextParts(contextBiz, docMap) : [] };
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
    const now = new Date().toISOString();
    await db.from('businesses').update({ calendar: applied.calendar, calendar_issues: applied.issues, calendar_updated_at: now, updated_at: now }).eq('user_id', uid).eq('id', biz.id);
  }
  if (applied.experiments) {
    await db.from('businesses').update({ experiments: applied.experiments, updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
  }
  if (applied.posts) {
    const now = new Date().toISOString();
    await db.from('businesses').update({ posts: applied.posts, posts_updated_at: now, updated_at: now }).eq('user_id', uid).eq('id', biz.id);
  }
  let profileNumbers = false;
  if (applied.answers) {
    const merged = mergeDevinAnswers(biz.profile || {}, cleanBrain(biz.brain), applied.answers);
    if (merged.changed.length) {
      const now = new Date().toISOString();
      await db.from('businesses').update({
        profile: merged.profile,
        brain: cleanBrain(merged.brain),
        brain_updated_at: now,
        updated_at: now,
      }).eq('user_id', uid).eq('id', biz.id);
      profileNumbers = true;
    }
  }
  return { applied: [...Object.keys(applied.docs), ...(applied.calendar ? ['calendar'] : []), ...(applied.experiments ? ['experiments'] : []), ...(applied.posts ? ['posts'] : []), ...(profileNumbers ? ['profile numbers'] : [])], hash: applied.hash };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health' && !/^Bearer /.test(req.headers.authorization || ''))
      return send(res, 200, { hosted: true, items: [] });
    // Public lead-capture form — no auth. Always 200 on POST so bots learn nothing.
    if (parts[0] === 'api' && parts[1] === 'lead' && parts.length === 3) {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
      const ok = () => { res.writeHead(200, { 'Content-Type': 'application/json', ...cors }); res.end('{"ok":true}'); };
      const thanks = () => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors }); res.end('<!doctype html><meta charset="utf-8"><title>Thanks</title><p>Thanks — we’ll be in touch shortly.</p>'); };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (!LEAD_TOKEN.test(parts[2])) return send(res, 404, { error: 'not found' });
      const { data: biz } = await admin().from('businesses').select('id, user_id, name, profile, tracker, experiments').eq('lead_token', parts[2]).maybeSingle();
      if (!biz) return send(res, 404, { error: 'not found' });
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors });
        return res.end(leadFormHtml({ business: biz.name || biz.profile?.name || 'us', token: parts[2], exp: url.searchParams.get('exp') || '', src: url.searchParams.get('src') || '' }));
      }
      if (req.method === 'POST') {
        let body = req.body;
        if (body == null || typeof body === 'string') {
          const raw = typeof body === 'string' ? body : await new Promise((resolve, reject) => {
            let b = '';
            req.on('data', c => { b += c; if (b.length > 8192) reject(Object.assign(new Error('too big'), { status: 413 })); });
            req.on('end', () => resolve(b));
            req.on('error', reject);
          });
          try { body = String(req.headers['content-type'] || '').includes('json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw)); } catch { body = null; }
        }
        const lead = cleanLead(body, cleanExperiments(biz.experiments).items || []);
        if (lead) {
          const now = new Date().toISOString();
          await admin().from('businesses').update({ tracker: appendLead(biz.tracker, lead), tracker_updated_at: now, updated_at: now }).eq('id', biz.id);
        }
        return String(req.headers['content-type'] || '').includes('json') ? ok() : thanks();
      }
      res.writeHead(405, { ...cors });
      return res.end('{"error":"method"}');
    }

    // HeyGen OAuth browser redirect — unauthenticated; state in the pending row identifies the user.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'heygen' && parts[2] === 'oauth' && parts[3] === 'callback')
      return heygenOauthCallback(res, url);
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'google' && parts[2] === 'oauth' && parts[3] === 'callback')
      return googleOauthCallback(res, url);

    const user = await userFromReq(req);
    if (!user) return send(res, 401, { error: 'Sign in first.' });
    const uid = user.id;
    const db = admin();

    if (req.method === 'GET' && url.pathname === '/api/auth/me') return send(res, 200, { hosted: true, email: user.email });
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const s = await settings(uid);
      const { data: active } = await db.from('businesses').select('instagram_insights').eq('user_id', uid).eq('is_active', true).maybeSingle();
      // Settle pending "Set up with Devin" sessions: Devin's structured output decides.
      const integ = { ...(s.integrations || {}) }, pending = { ...(integ._setup || {}) };
      const client = Object.keys(pending).length && await devinCreds(uid).then(devinClient, () => null);
      if (client) {
        await Promise.all(Object.entries(pending).map(async ([id, p]) => {
          try {
            const ses = await client.getSession(p.id);
            const so = ses.structured_output;
            if (so?.note) p.note = so.note;
            if (so?.connected === true) { integ[id] = true; delete pending[id]; }
            else if (['expired', 'finished', 'suspended', 'exit', 'error'].includes(ses.status_enum || ses.status)) delete pending[id];
          } catch { delete pending[id]; }
        }));
        integ._setup = pending;
        await db.from('user_settings').upsert({ user_id: uid, integrations: integ, updated_at: new Date().toISOString() });
        s.integrations = integ;
      }
      const devinOwn = !!(s.devin_api_key && s.devin_org_id);
      return send(res, 200, { hosted: true, items: [
        { id: 'devin', group: 'required', name: 'Devin API key + Org ID', why: 'Runs the assistant on your own Devin account.', ok: devinOwn, key: 'DEVIN_API_KEY', key2: 'DEVIN_ORG_ID', link: 'https://app.devin.ai/settings' },
        ...Object.entries(INTEGRATIONS).map(([id, i]) => ({ id, group: 'integrations', name: i.name, why: i.why, url: i.url, marketplace: i.marketplace, toggle: true, ok: !!s.integrations?.[id], setup: s.integrations?._setup?.[id] })),
        { id: 'heygen', group: 'optional', name: 'HeyGen', why: 'Makes avatar videos from your scripts and imports them. Connect your HeyGen account to use your plan credits.', ok: !!(s.heygen_oauth || s.heygen_api_key), oauth: !!s.heygen_oauth, apiKey: !!s.heygen_api_key, account: heygenAccount(s), key: 'HEYGEN_API_KEY', link: 'https://app.heygen.com/settings?nav=API' },
        { id: 'google_business', group: 'optional', name: 'Google Business Profile', why: 'Studio reads your listing — exact name, address, phone, hours and categories — so every document and your website match Google word for word.', ok: !!s.google_oauth, oauth: !!s.google_oauth, available: google.configured(), account: googleAccount(s), link: 'https://business.google.com/' },
        metaHealthItem(s, active?.instagram_insights?.account?.username || null),
      ] });
    }
    if (req.method === 'POST' && url.pathname === '/api/setup/meta') {
      const data = await readJson(req);
      if (data.disconnect === true) {
        await db.from('user_settings').upsert({
          user_id: uid,
          meta_access_token: null,
          meta_ad_account_id: null,
          meta_instagram_id: null,
          updated_at: new Date().toISOString(),
        });
        return send(res, 200, { ok: true });
      }
      const accountId = normalizeAccountId(data.accountId);
      if (!accountId) return send(res, 400, { error: 'Enter a valid ad account ID.' });
      if (!/^[\x21-\x7e]{4,1024}$/.test(data.token || ''))
        return send(res, 400, { error: 'That doesn’t look like an API key. Paste it again with no spaces.' });
      const adInsights = await syncAds({ token: data.token, accountId });
      const instagram = await tryConnectInstagram(data.token);
      const biz = await activeBusiness(uid);
      await db.from('user_settings').upsert({
        user_id: uid,
        meta_access_token: enc(data.token),
        meta_ad_account_id: enc(accountId),
        meta_instagram_id: instagram.igId,
        updated_at: new Date().toISOString(),
      });
      await db.from('businesses').update({
        ad_insights: adInsights,
        ...(instagram.insights ? { instagram_insights: instagram.insights } : {}),
        updated_at: new Date().toISOString(),
      }).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, { ok: true, account: adInsights.account.name, instagram: instagram.instagram });
    }
    if (req.method === 'POST' && url.pathname === '/api/ads/sync') {
      const s = await settings(uid);
      if (!s.meta_access_token || !s.meta_ad_account_id)
        return send(res, 400, { error: 'Connect your Meta ad account in Setup first.' });
      const credentials = { token: dec(s.meta_access_token), accountId: dec(s.meta_ad_account_id) };
      const adInsights = await syncAds(credentials);
      const biz = await activeBusiness(uid);
      const { items: experiments, changed } = applyAdSpend(biz.experiments || [], adInsights.campaigns);
      await db.from('businesses').update({
        ad_insights: adInsights,
        ...(changed ? { experiments } : {}),
        updated_at: new Date().toISOString(),
      }).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, await businessState(uid));
    }
    if (req.method === 'POST' && url.pathname === '/api/instagram/account') {
      const data = await readJson(req);
      const s = await settings(uid);
      if (!s.meta_access_token) return send(res, 400, { error: 'Connect your Meta account in Setup first.' });
      const token = dec(s.meta_access_token);
      const accounts = await findInstagramAccounts(token);
      const account = accounts.find(item => item.id === String(data.igId || ''));
      if (!account) return send(res, 400, { error: NO_INSTAGRAM_ACCOUNT_MESSAGE });
      await db.from('user_settings').upsert({ user_id: uid, meta_instagram_id: account.id, updated_at: new Date().toISOString() });
      const instagramInsights = await syncInstagram({ token, igId: account.id });
      const biz = await activeBusiness(uid);
      await db.from('businesses').update({ instagram_insights: instagramInsights, updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, await businessState(uid));
    }
    if (req.method === 'POST' && url.pathname === '/api/instagram/sync') {
      const s = await settings(uid);
      if (!s.meta_access_token) return send(res, 400, { error: 'Connect your Meta account in Setup first.' });
      if (!s.meta_instagram_id) return send(res, 400, { error: NO_INSTAGRAM_ACCOUNT_MESSAGE });
      const instagramInsights = await syncInstagram({ token: dec(s.meta_access_token), igId: s.meta_instagram_id });
      const biz = await activeBusiness(uid);
      await db.from('businesses').update({ instagram_insights: instagramInsights, updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, await businessState(uid));
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
    if (req.method === 'POST' && parts[1] === 'setup' && parts[2] === 'integration' && parts[4] === 'devin') {
      const i = INTEGRATIONS[parts[3]];
      if (!i?.url) return send(res, 400, { error: 'unknown integration' });
      const ses = await devinClient(await devinCreds(uid)).createSession({ prompt: setupPrompt(i), title: `Connect ${i.name} · Studio`, schema: SETUP_SCHEMA, tags: ['studio', 'setup'] });
      const setup = { id: ses.session_id, url: ses.url || `https://app.devin.ai/sessions/${ses.session_id}` };
      const s = await settings(uid);
      await db.from('user_settings').upsert({ user_id: uid, integrations: { ...(s.integrations || {}), _setup: { ...(s.integrations?._setup || {}), [parts[3]]: setup } }, updated_at: new Date().toISOString() });
      return send(res, 200, { url: setup.url });
    }

    // ---- business state ----
    if (req.method === 'GET' && url.pathname === '/api/business') return send(res, 200, await businessState(uid));
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'business' && BIZ_FIELDS[parts[2]]) {
      const biz = await activeBusiness(uid);
      const data = await readJson(req);
      const col = BIZ_FIELDS[parts[2]];
      if (col === 'brain') {
        if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 200000) return send(res, 400, { error: 'bad brain' });
        await db.from('businesses').update({ brain: cleanBrain(data), brain_updated_at: new Date().toISOString() }).eq('user_id', uid).eq('id', biz.id);
        return send(res, 200, { ok: true });
      }
      const fields = { updated_at: new Date().toISOString(), [col]: col === 'calendar' ? cleanCalendar(data).items : data };
      if (['profile', 'calendar', 'tracker'].includes(col)) fields[`${col}_updated_at`] = fields.updated_at;
      if (col === 'calendar') fields.calendar_issues = cleanCalendar(data).issues;
      if (col === 'experiments') fields.experiments = cleanExperiments(data).items;
      if (col === 'posts') { fields.posts = cleanPosts(data).items || []; fields.posts_updated_at = fields.updated_at; }
      await db.from('businesses').update(fields).eq('user_id', uid).eq('id', biz.id);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/businesses') return send(res, 200, await listBusinesses(uid));
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'businesses' && ['new', 'switch'].includes(parts[2])) {
      const { id } = await readJson(req);
      if (parts[2] === 'switch') await switchBusiness(uid, id); else await newBusiness(uid);
      return send(res, 200, await listBusinesses(uid));
    }
    if (parts[0] === 'api' && parts[1] === 'business' && parts[2] === 'lead-form') {
      const biz = await activeBusiness(uid);
      const rotate = req.method === 'POST' && parts[3] === 'rotate';
      if (!(req.method === 'GET' && parts.length === 3) && !rotate) return send(res, 405, { error: 'method' });
      let token = biz.lead_token;
      if (!token || rotate) {
        for (let tries = 0; tries < 2; tries++) {
          token = leadToken();
          const { error } = await db.from('businesses').update({ lead_token: token }).eq('user_id', uid).eq('id', biz.id);
          if (!error) break;
          if (tries === 1) throw error;
        }
      }
      const url = leadFormUrl(req, token);
      const embed = `<form action="${url}" method="post"><input name="name" placeholder="Your name" required><input name="contact" placeholder="Phone or email" required><textarea name="message" placeholder="How can we help?"></textarea><button>Send</button></form>`;
      const experiments = (cleanExperiments(biz.experiments).items || []).map(e => ({ id: e.id, name: e.name, url: `${url}?exp=${e.id}` }));
      return send(res, 200, { url, embed, experiments });
    }
    if (req.method === 'GET' && url.pathname === '/api/business/export.md') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="sprint.md"' });
      return res.end(await exportMarkdown(uid));
    }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'business' && parts[2] === 'history' && parts.length === 4) {
      const { data } = await db.from('doc_history').select('kind, content').eq('user_id', uid).eq('id', parts[3]).maybeSingle();
      if (!data) return send(res, 404, { error: 'not found' });
      return send(res, 200, { kind: data.kind, content: data.content });
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

    // ---- HeyGen OAuth ----
    if (req.method === 'POST' && url.pathname === '/api/heygen/oauth/start') {
      const redirect_uri = redirectUri(req);
      const client_id = await registerClient(redirect_uri);
      const { verifier, challenge } = pkce();
      const state = randomState();
      await settingsUpsert(uid, { heygen_oauth_pending: enc(JSON.stringify({ state, verifier, client_id, redirect_uri, created_at: Date.now() })) });
      return send(res, 200, { url: buildAuthorizeUrl({ clientId: client_id, redirectUri: redirect_uri, state, challenge }) });
    }
    if (req.method === 'POST' && url.pathname === '/api/heygen/oauth/disconnect') {
      const s = await settings(uid);
      if (s.heygen_oauth) {
        try {
          const st = JSON.parse(dec(s.heygen_oauth));
          if (st?.client_id) await revoke({ clientId: st.client_id, token: st.refresh_token || st.access_token });
        } catch { /* best effort */ }
      }
      await settingsUpsert(uid, { heygen_oauth: null, heygen_oauth_pending: null });
      return send(res, 200, { ok: true });
    }

    // ---- Google Business Profile OAuth ----
    if (req.method === 'POST' && url.pathname === '/api/google/oauth/start') {
      if (!google.configured()) return send(res, 400, { error: 'Google Business Profile isn’t available yet — Studio is waiting on Google’s approval.' });
      const redirect_uri = google.redirectUri(req);
      const state = randomState();
      await settingsUpsert(uid, { google_oauth_pending: enc(JSON.stringify({ state, redirect_uri, created_at: Date.now() })) });
      return send(res, 200, { url: google.buildAuthorizeUrl({ redirectUri: redirect_uri, state }) });
    }
    if (req.method === 'POST' && url.pathname === '/api/google/oauth/disconnect') {
      const s = await settings(uid);
      if (s.google_oauth) {
        try {
          const st = JSON.parse(dec(s.google_oauth));
          if (st?.access_token) await google.revoke(st.access_token);
        } catch { /* best effort */ }
      }
      await settingsUpsert(uid, { google_oauth: null, google_oauth_pending: null });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/google')
      return send(res, 200, googleAccount(await settings(uid)) || {});
    if (req.method === 'POST' && url.pathname === '/api/google/sync') {
      await syncGoogleLocations(uid);
      return send(res, 200, googleAccount(await settings(uid)) || {});
    }
    if (req.method === 'POST' && url.pathname === '/api/google/location') {
      const { name } = await readJson(req);
      const s = await settings(uid);
      const stored = s.google_oauth ? JSON.parse(dec(s.google_oauth)) : null;
      const loc = (stored?.locations || []).find(l => l.name === name);
      if (!loc) return send(res, 400, { error: 'Unknown listing. Sync your locations first.' });
      await settingsUpsert(uid, { google_oauth: enc(JSON.stringify({ ...stored, location: loc })) });
      return send(res, 200, googleAccount(await settings(uid)) || {});
    }

    // ---- HeyGen passthrough (OAuth bearer or per-user API key) ----
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

    // ---- website session: a plain interactive Devin session the owner works in directly ----
    if (parts[0] === 'api' && parts[1] === 'site') {
      const biz = await activeBusiness(uid);
      const row = await agentRow(uid, biz.id, 'site');
      if (req.method === 'GET' && parts.length === 2 && !row?.devin_session_id) return send(res, 200, {});
      const client = devinClient(await devinCreds(uid)); // throws 400 with setup hint when missing
      const refreshStatus = async () => {
        if (!row?.devin_session_id) return null;
        try { const s = await client.getSession(row.devin_session_id); return s.status_enum || s.status; }
        catch { return 'expired'; }
      };

      if (req.method === 'POST' && parts[2] === 'start') {
        const { fresh } = await readJson(req);
        if (row?.devin_session_id && row.devin_url && !fresh) {
          const status = await refreshStatus();
          if (status && !DEAD_STATUSES.includes(status)) {
            if (status !== row.devin_status) await agentUpsert(uid, biz.id, 'site', { devin_status: status });
            return send(res, 200, { url: row.devin_url, reused: true });
          }
        }
        const { ctx } = await docContext(uid, biz, req);
        const skill = siteSkill(f => fs.readFileSync(path.join(process.cwd(), '.devin/skills', f), 'utf8'));
        const prompt = [skill, ctx, GROUNDING, SITE_REQUEST].join('\n\n'); // no OUTPUT_CONTRACT: this session has a filesystem
        const s = await client.createSession({ prompt, title: `${biz.name || biz.profile?.name || 'Studio'} · Website`, tags: ['studio', 'website'] });
        await agentUpsert(uid, biz.id, 'site', { devin_session_id: s.session_id, devin_status: 'working', devin_url: s.url, last_prompt_at: new Date().toISOString(), applied_hash: null });
        return send(res, 201, { url: s.url });
      }

      if (req.method === 'GET' && parts.length === 2) {
        if (!row?.devin_url) return send(res, 200, {});
        const status = await refreshStatus();
        if (status && status !== row.devin_status) await agentUpsert(uid, biz.id, 'site', { devin_status: status });
        return send(res, 200, { url: row.devin_url, status: status || row.devin_status, startedAt: row.last_prompt_at });
      }
      return send(res, 404, { error: 'not found' });
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
        const { text, snapshot: snap, step } = await readJson(req);
        if (!text?.trim()) return send(res, 400, { error: 'empty message' });
        if (step != null && (typeof step !== 'string' || step.length > 40)) return send(res, 400, { error: 'bad step' });
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
        if (!row?.devin_session_id || DEAD_STATUSES.includes(row.devin_status)) {
          const { parts, ctx } = await docContext(uid, biz, req);
          const extra = [scope !== 'business' ? `This conversation is about the promo video project '${scope}'.` : null, integrationNotes((await settings(uid)).integrations)].filter(Boolean).join('\n\n') || null;
          let skill = null;
          if (step === 'offer') skill = offerSkill(file => fs.readFileSync(path.join(process.cwd(), '.devin/skills/grand-slam-offer', file), 'utf8'));
          const s = await client.createSession({ prompt: sessionPrompt(ctx, text.trim(), { skill, extra }), title: `${biz.name || biz.profile?.name || 'Studio'} · Studio`, schema: STRUCTURED_SCHEMA, tags: ['studio'] });
          await agentUpsert(uid, biz.id, scope, { devin_session_id: s.session_id, devin_status: 'working', last_prompt_at: new Date().toISOString(), context_hashes: partHashes(parts) });
        } else {
          const { parts } = await latestContext(uid, biz.id, req);
          const hashes = partHashes(parts);
          const changed = changedParts(parts, row.context_hashes, { skip: snap === 'brain.md' ? ['brain'] : [] });
          const fresh = changed.length ? `Things changed in Studio since my last message. Use these versions from now on, replacing earlier ones:\n\n${changed.map(part => part.text).join('\n\n')}\n\n---\n\n` : '';
          const skill = step === 'offer'
            ? `${offerSkill(file => fs.readFileSync(path.join(process.cwd(), '.devin/skills/grand-slam-offer', file), 'utf8'))}\n\n`
            : '';
          await client.sendMessage(row.devin_session_id, `${skill}${fresh}${text.trim()}`);
          await agentUpsert(uid, biz.id, scope, { devin_status: 'working', last_prompt_at: new Date().toISOString(), context_hashes: hashes });
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
        if (res2) {
          const { parts } = await latestContext(uid, biz.id, req);
          const hashes = partHashes(parts);
          const appliedHashes = {};
          for (const kind of res2.applied) {
            const key = kind === 'calendar' ? 'calendar'
              : kind === 'experiments' ? 'experiments'
                : kind === 'posts' ? 'posts'
                : kind === 'profile numbers' ? null : `doc:${kind}`;
            if (key && hashes[key]) appliedHashes[key] = hashes[key];
            if (kind === 'profile numbers') {
              for (const profileKey of ['profile', 'brain']) if (hashes[profileKey]) appliedHashes[profileKey] = hashes[profileKey];
            }
          }
          await agentUpsert(uid, biz.id, scope, { applied_hash: res2.hash, context_hashes: { ...(row.context_hashes || {}), ...appliedHashes } });
        }
        const busy = isBusy(s);
        if (row.devin_status !== status) await agentUpsert(uid, biz.id, scope, { devin_status: status });
        const starting = busy && !items.some(m => m.kind === 'agent') && Date.now() - Date.parse(row.last_prompt_at || 0) < 180000;
        return send(res, 200, { messages, busy, starting, ...(res2?.applied?.length && { applied: res2.applied }) });
      }
      return send(res, 404, { error: 'not found' });
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.message, ...(e.retryAfter && { retryAfter: e.retryAfter }) });
  }
}
