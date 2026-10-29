import { admin } from './supabase.js';
import { dec } from './secrets.js';

// v3 org sessions API: https://docs.devin.ai/api-reference/common-flows.md
const BASE = 'https://api.devin.ai/v3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const retryAfterMs = r => {
  const v = r.headers.get('retry-after');
  const secs = Number(v);
  if (Number.isFinite(secs)) return secs * 1000;
  const at = Date.parse(v || '');
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
};
const MAX_INLINE_WAIT = 3000;
export const api = async (creds, path, opts, { retries = 2 } = {}) => {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${BASE}/organizations/${creds.org}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${creds.key}`, 'Content-Type': 'application/json' },
    });
    if (r.status === 429) {
      const wait = retryAfterMs(r) ?? 500 * 2 ** attempt;
      if (attempt < retries && wait <= MAX_INLINE_WAIT) { await sleep(wait); continue; }
      throw Object.assign(new Error('Devin is rate-limiting requests. Studio will retry shortly.'), { status: 429, retryAfter: Math.ceil(Math.max(wait, 5000) / 1000) });
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403)
      throw Object.assign(new Error('Devin rejected your API key or Org ID. Check them in Setup.'), { status: 400 });
    if (!r.ok) throw Object.assign(new Error(`Devin error ${r.status}: ${body.detail || body.title || r.statusText}`), { status: 502 });
    return body;
  }
};

// Every user runs Devin on their own key + org; there is no server-wide fallback, and a saved
// key is never used without its saved org (or vice versa).
export function pickDevinCreds(saved) {
  const { key, org } = saved || {};
  if (key && org) return { key, org };
  throw Object.assign(new Error(key || org ? 'Add both your Devin API key and Org ID in Setup.' : 'Add your Devin API key and Org ID in Setup first.'), { status: 400 });
}

export async function devinCreds(uid) {
  const { data: s } = await admin().from('user_settings').select('devin_api_key, devin_org_id').eq('user_id', uid).maybeSingle();
  const grab = v => { try { return v ? dec(v) : null; } catch { return null; } };
  return pickDevinCreds({ key: grab(s?.devin_api_key), org: grab(s?.devin_org_id) });
}
export const devinClient = creds => ({
  createSession: ({ prompt, title, schema, tags }) =>
    api(creds, '/sessions', { method: 'POST', body: JSON.stringify({ prompt, title, tags, ...(schema !== undefined && { structured_output_schema: schema, structured_output_required: true }), ...(process.env.DEVIN_MAX_ACU && { max_acu_limit: Number(process.env.DEVIN_MAX_ACU) }) }) }),
  sendMessage: (id, text) => api(creds, `/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) }),
  getSession: id => api(creds, `/sessions/${id}`),
  // `after` is an opaque page cursor, not an event_id, so fetch every page and let the caller slice.
  getMessages: async id => {
    const items = [];
    let after = null;
    do {
      const page = await api(creds, `/sessions/${id}/messages?${new URLSearchParams({ first: '200', ...(after && { after }) })}`);
      items.push(...(page.items || []));
      after = page.has_next_page ? page.end_cursor : null;
    } while (after);
    return { items };
  },
});
