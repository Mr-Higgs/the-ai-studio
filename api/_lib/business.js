import { admin } from './supabase.js';
import { PROFILE_LABELS, brainContext } from '../../ui/web/src/brain.js';

export const BUSINESS_DOCS = ['brain', 'offer', 'research', 'strategy', 'content', 'visibility', 'automation', 'action-plan'];

// The agent writes calendar items; keep only ones the UI can render and count the rest.
export function cleanCalendar(data) {
  if (!Array.isArray(data)) return { items: null, issues: data == null ? 0 : 1 };
  const items = data.filter(x => x && typeof x === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && typeof x.title === 'string');
  return { items, issues: data.length - items.length };
}

const EXPERIMENT_STATUSES = ['running', 'scale', 'keep', 'kill'];
const experimentText = value => typeof value === 'string' ? value.trim().slice(0, 500) : '';
const experimentNumber = value => {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
export function cleanExperiments(data) {
  if (!Array.isArray(data)) return { items: null, issues: data == null ? 0 : 1 };
  const valid = data.filter(item => item && typeof item === 'object' && !Array.isArray(item)
    && typeof item.id === 'string' && item.id.trim() && typeof item.name === 'string' && item.name.trim());
  const items = valid.slice(0, 8).map(item => ({
    id: item.id.trim().slice(0, 80),
    name: experimentText(item.name),
    campaignId: typeof item.campaignId === 'string' && /^\d{1,40}$/.test(item.campaignId) ? item.campaignId : null,
    hypothesis: experimentText(item.hypothesis),
    channel: experimentText(item.channel),
    cost: experimentNumber(item.cost),
    spent: experimentNumber(item.spent),
    metric: experimentText(item.metric),
    target: experimentNumber(item.target),
    maxCac: experimentNumber(item.maxCac),
    rule: experimentText(item.rule),
    status: EXPERIMENT_STATUSES.includes(item.status) ? item.status : 'running',
    verdict: experimentText(item.verdict),
  }));
  return { items, issues: data.length - items.length };
}

export async function activeBusiness(uid) {
  const db = admin();
  const { data: rows } = await db.from('businesses').select('*').eq('user_id', uid).eq('is_active', true).limit(1);
  if (rows?.[0]) return rows[0];
  const { data: ins, error } = await db.from('businesses').insert({ user_id: uid }).select().single();
  if (error) {
    // lost the one-active race; re-read
    const { data: r2 } = await db.from('businesses').select('*').eq('user_id', uid).eq('is_active', true).limit(1);
    return r2[0];
  }
  return ins;
}

// Same JSON shape the UI consumed from the old file-based /api/business.
export async function businessState(uid) {
  const db = admin();
  const biz = await activeBusiness(uid);
  const [{ data: docs }, { data: hist }, { data: sess }] = await Promise.all([
    db.from('docs').select('kind, content, updated_at').eq('user_id', uid).eq('business_id', biz.id),
    db.from('doc_history').select('id, kind').eq('user_id', uid).eq('business_id', biz.id).order('created_at', { ascending: false }),
    db.from('agent_sessions').select('scope, devin_status').eq('user_id', uid).eq('business_id', biz.id),
  ]);
  const docsOut = {}, history = {};
  for (const k of BUSINESS_DOCS) docsOut[k] = null;
  for (const d of docs || []) docsOut[d.kind] = { content: d.content, mtime: Date.parse(d.updated_at) };
  for (const h of hist || []) (history[h.kind] ||= []).push(h.id);
  const cal = cleanCalendar(biz.calendar);
  const mt = f => (biz[f] ? Date.parse(biz.updated_at) : null);
  return {
    sprint: biz.sprint, profile: biz.profile, inputs: biz.inputs || {}, tracker: biz.tracker, brain: biz.brain || {},
    experiments: cleanExperiments(biz.experiments).items || [],
    adInsights: biz.ad_insights || null,
    calendar: cal.items, calendarIssues: Math.max(cal.issues, biz.calendar_issues || 0), docs: docsOut, history,
    mtimes: { profile: mt('profile'), calendar: mt('calendar'), tracker: mt('tracker'), brain: biz.brain_updated_at ? Date.parse(biz.brain_updated_at) : null },
    agent: 'devin', busy: (sess || []).some(s => s.devin_status === 'working'),
  };
}

export async function listBusinesses(uid) {
  const { data } = await admin().from('businesses').select('id, name, is_active, profile').eq('user_id', uid).order('created_at');
  const name = b => b.name || b.profile?.name || '';
  return { current: name((data || []).find(b => b.is_active) || {}), list: (data || []).map(b => ({ id: b.id, name: name(b) || 'business' })) };
}

// Switching activates another parked business (every business row carries its own state).
export async function switchBusiness(uid, id) {
  const db = admin();
  const { data: target } = await db.from('businesses').select('id').eq('user_id', uid).eq('id', id).limit(1);
  if (!target?.length) throw Object.assign(new Error('no such business'), { status: 404 });
  await db.from('businesses').update({ is_active: false }).eq('user_id', uid).eq('is_active', true);
  await db.from('businesses').update({ is_active: true }).eq('user_id', uid).eq('id', id);
}
export async function newBusiness(uid) {
  const db = admin();
  await db.from('businesses').update({ is_active: false }).eq('user_id', uid).eq('is_active', true);
  await db.from('businesses').insert({ user_id: uid, is_active: true });
}

export async function snapshot(uid, bizId, kind, content) {
  await admin().from('doc_history').insert({ user_id: uid, business_id: bizId, kind, content });
}

export async function exportMarkdown(uid) {
  const b = await businessState(uid);
  const out = [`# ${b.sprint?.name || 'Holiday Growth Sprint'} — ${b.profile?.name || 'my business'}`, `_Exported ${new Date().toLocaleString()}_`];
  if (b.profile) out.push('## Business profile', ...Object.entries(b.profile).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => `- **${PROFILE_LABELS[k] || k}:** ${v}`));
  const brain = brainContext(b.brain, b.profile);
  if (brain) out.push('\n---\n', brain);
  for (const id of BUSINESS_DOCS) if (b.docs[id]) out.push(`\n---\n`, b.docs[id].content.trim());
  if (b.experiments?.length) out.push('\n---\n', '## Growth experiments', ...b.experiments.map(e => `- **${e.name}** · ${e.status}${e.target != null ? ` · target: ${e.target} ${e.metric}` : ''}${e.verdict ? ` — ${e.verdict}` : ''}`));
  if (b.calendar?.length) out.push('\n---\n', '## Campaign calendar', ...b.calendar.map(c => `- **${c.date}** · ${c.channel || ''} ${c.format || ''} · ${c.title}${c.status === 'posted' ? ' ✓' : ''}\n\n  ${(c.copy || '').replace(/\n/g, '\n  ')}${c.cta ? `\n\n  _CTA:_ ${c.cta}` : ''}`));
  return out.join('\n\n') + '\n';
}
