export const BUSINESS_JSON = ['profile.json', 'inputs.json', 'calendar.json', 'tracker.json', 'sprint.json'];
export const BUSINESS_DOCS = ['offer', 'research', 'strategy', 'content', 'visibility', 'automation', 'action-plan'];

export function cleanCalendar(data) {
  if (!Array.isArray(data)) return { items: null, issues: data == null ? 0 : 1 };
  const items = data.filter(item => item && typeof item === 'object'
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.title === 'string');
  return { items, issues: data.length - items.length };
}

export function historyName({ file, ext, created_at }) {
  const stamp = new Date(created_at).toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `${file}-${stamp}.${ext}`;
}

export function formatHistoryItem(row) {
  return { id: row.id, name: historyName(row) };
}

export function exportMarkdown(state, exportedAt = new Date()) {
  const out = [`# ${state.sprint?.name || 'Holiday Growth Sprint'} — ${state.profile?.name || 'my business'}`, `_Exported ${exportedAt.toLocaleString()}_`];
  if (state.profile) out.push('## Business profile', ...Object.entries(state.profile)
    .filter(([, value]) => typeof value === 'string' && value)
    .map(([key, value]) => `- **${key}:** ${value}`));
  for (const id of BUSINESS_DOCS) {
    if (state.docs?.[id]) out.push('\n---\n', state.docs[id].content.trim());
  }
  if (state.calendar?.length) {
    out.push('\n---\n', '## Campaign calendar', ...state.calendar.map(item => (
      `- **${item.date}** · ${item.channel || ''} ${item.format || ''} · ${item.title}${item.status === 'posted' ? ' ✓' : ''}\n\n  ${(item.copy || '').replace(/\n/g, '\n  ')}${item.cta ? `\n\n  _CTA:_ ${item.cta}` : ''}`
    )));
  }
  return `${out.join('\n\n')}\n`;
}

export async function saveDoc(supabase, businessId, docId, content) {
  if (!BUSINESS_DOCS.includes(docId)) throw new Error('Unknown business document');
  const { data, error } = await supabase
    .from('business_docs')
    .upsert({ business_id: businessId, doc_id: docId, content, updated_at: new Date().toISOString() })
    .select('business_id,doc_id,content,updated_at')
    .single();
  if (error) throw error;
  return data;
}

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function ensureActiveBusiness(supabase) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const profile = throwIfError(await supabase.from('profiles').select('active_business_id').eq('id', user.id).maybeSingle());
  if (!profile) throw new Error('Profile not found');

  if (profile.active_business_id) {
    const existing = throwIfError(await supabase.from('businesses').select('*').eq('id', profile.active_business_id).maybeSingle());
    if (existing) return existing;
  }

  const business = throwIfError(await supabase.from('businesses').insert({}).select('*').single());
  throwIfError(await supabase.from('profiles').update({ active_business_id: business.id }).eq('id', user.id));
  return business;
}

export async function readBusinessState(supabase, business) {
  const [docsResult, historyResult] = await Promise.all([
    supabase.from('business_docs').select('doc_id,content,updated_at').eq('business_id', business.id),
    supabase.from('business_history').select('id,file,ext,created_at').eq('business_id', business.id).order('created_at', { ascending: false }),
  ]);
  const docsRows = throwIfError(docsResult);
  const historyRows = throwIfError(historyResult);
  const docs = Object.fromEntries(BUSINESS_DOCS.map(id => [id, null]));
  for (const doc of docsRows) {
    docs[doc.doc_id] = { content: doc.content, mtime: new Date(doc.updated_at).getTime() };
  }
  const history = {};
  for (const row of historyRows) {
    (history[row.file] ||= []).push(formatHistoryItem(row));
  }
  const calendar = cleanCalendar(business.calendar);
  return {
    sprint: business.sprint,
    profile: business.profile,
    inputs: business.inputs || {},
    tracker: business.tracker,
    calendar: calendar.items,
    calendarIssues: calendar.issues,
    docs,
    history,
    mtimes: {
      profile: business.profile_updated_at ? new Date(business.profile_updated_at).getTime() : null,
      calendar: business.calendar_updated_at ? new Date(business.calendar_updated_at).getTime() : null,
      tracker: business.tracker_updated_at ? new Date(business.tracker_updated_at).getTime() : null,
    },
    agent: 'devin',
    busy: false,
  };
}

export async function listBusinesses(supabase) {
  await ensureActiveBusiness(supabase);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const profile = throwIfError(await supabase.from('profiles').select('active_business_id').eq('id', user.id).maybeSingle());
  if (!profile) throw new Error('Profile not found');
  const businesses = throwIfError(await supabase.from('businesses').select('id,profile').order('created_at', { ascending: true }));
  const current = businesses.find(item => item.id === profile.active_business_id);
  return {
    current: current?.profile?.name || '',
    list: businesses.filter(item => item.id !== profile.active_business_id).map(item => ({
      id: item.id,
      name: item.profile?.name || 'Unnamed business',
    })),
  };
}
