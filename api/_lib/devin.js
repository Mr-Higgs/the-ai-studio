import { admin } from './supabase.js';
import { dec } from './secrets.js';

// v3 org sessions API: https://docs.devin.ai/api-reference/common-flows.md
const BASE = 'https://api.devin.ai/v3';
const api = async (creds, path, opts) => {
  const r = await fetch(`${BASE}/organizations/${creds.org}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${creds.key}`, 'Content-Type': 'application/json' },
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403)
    throw Object.assign(new Error('Devin rejected your API key or Org ID. Check them in Setup.'), { status: 400 });
  if (!r.ok) throw Object.assign(new Error(`Devin error ${r.status}: ${body.detail || body.title || r.statusText}`), { status: 502 });
  return body;
};

// Per-user keys from user_settings (encrypted), with a server-wide fallback.
export async function devinCreds(uid) {
  const { data: s } = await admin().from('user_settings').select('devin_api_key, devin_org_id').eq('user_id', uid).maybeSingle();
  const grab = v => { try { return v ? dec(v) : null; } catch { return null; } };
  const key = grab(s?.devin_api_key) || process.env.DEVIN_API_KEY;
  const org = grab(s?.devin_org_id) || process.env.DEVIN_ORG_ID;
  if (!key || !org) throw Object.assign(new Error('Add your Devin API key and Org ID in Setup first.'), { status: 400 });
  return { key, org };
}
export const devinClient = creds => ({
  createSession: ({ prompt, title, schema, tags }) =>
    api(creds, '/sessions', { method: 'POST', body: JSON.stringify({ prompt, title, tags, structured_output_schema: schema, structured_output_required: true, ...(process.env.DEVIN_MAX_ACU && { max_acu_limit: Number(process.env.DEVIN_MAX_ACU) }) }) }),
  sendMessage: (id, text) => api(creds, `/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) }),
  getSession: id => api(creds, `/sessions/${id}`),
  getMessages: (id, after) => api(creds, `/sessions/${id}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`),
});
