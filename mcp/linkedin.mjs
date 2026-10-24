#!/usr/bin/env node
// LinkedIn MCP for Devin: stdio JSON-RPC, Node stdlib only. Posts as the member who owns LINKEDIN_ACCESS_TOKEN.
// ponytail: no OAuth flow; the token comes from LinkedIn's token generator and lasts 60 days. Add refresh when that hurts.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

// .env lives next to the caller's cwd: repo root locally, the user's workspace root in hosted mode.
const ENV = path.join(process.cwd(), '.env');
const token = () => {
  let env = ''; try { env = fs.readFileSync(ENV, 'utf8'); } catch {}
  const t = process.env.LINKEDIN_ACCESS_TOKEN || /^LINKEDIN_ACCESS_TOKEN=(.+)$/m.exec(env)?.[1].trim();
  if (!t || t === 'your_api_key_here') throw new Error('No LinkedIn token. Paste LINKEDIN_ACCESS_TOKEN in Studio Setup, then restart.');
  return t;
};
// LinkedIn versions are monthly and sunset after ~1 year; two months back is always live.
const version = (d = new Date()) => { d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2)); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

async function li(url, init = {}, tok) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tok || token()}`, ...init.headers } });
  if (r.status === 401) throw new Error('LinkedIn rejected the token (expired after 60 days?). Generate a new one and paste it in Setup.');
  if (!r.ok) throw new Error(`LinkedIn ${r.status}: ${(await r.text()).slice(0, 500)}`);
  return r;
}
export const whoami = async tok => (await li('https://api.linkedin.com/v2/userinfo', {}, tok)).json();

// Publishes a public text post and returns its URL. Shared with Studio's autopilot (ui/server.mjs),
// which passes the calling user's token explicitly in hosted mode.
export async function postToLinkedIn(text, tok) {
  if (typeof text !== 'string' || !text.trim() || text.length > 3000) throw new Error('text must be 1-3000 characters.');
  const { sub } = await whoami(tok);
  const r = await li('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'LinkedIn-Version': version(), 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({ author: `urn:li:person:${sub}`, commentary: text, visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }),
  }, tok);
  return `https://www.linkedin.com/feed/update/${r.headers.get('x-restli-id')}/`;
}

const TOOLS = {
  linkedin_whoami: {
    description: 'Show which LinkedIn member the token posts as (name, email, member id).',
    inputSchema: { type: 'object', properties: {} },
    run: async () => { const u = await whoami(); return `${u.name} <${u.email ?? 'no email scope'}> urn:li:person:${u.sub}`; },
  },
  linkedin_post: {
    description: 'Publish a PUBLIC text post on the member\'s LinkedIn feed. Posting is public and immediate: only call after the user has approved the exact text.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Post body, max 3000 characters.' } }, required: ['text'] },
    run: async ({ text }) => `Posted: ${await postToLinkedIn(text)}`,
  },
};

async function handle({ id, method, params }) {
  if (method === 'initialize') return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'linkedin', version: '0.1.0' } };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) };
  if (method === 'tools/call') {
    const tool = TOOLS[params?.name];
    if (!tool) throw Object.assign(new Error(`unknown tool ${params?.name}`), { code: -32602 });
    try { return { content: [{ type: 'text', text: await tool.run(params.arguments ?? {}) }] }; }
    catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; }
  }
  throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const out = msg => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
readline.createInterface({ input: process.stdin }).on('line', async line => {
  let msg; try { msg = JSON.parse(line); } catch { return out({ id: null, error: { code: -32700, message: 'parse error' } }); }
  if (msg.id === undefined) return; // notifications need no reply
  try { out({ id: msg.id, result: await handle(msg) }); }
  catch (e) { out({ id: msg.id, error: { code: e.code ?? -32603, message: e.message } }); }
});
}
