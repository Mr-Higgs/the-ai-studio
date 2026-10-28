import { useEffect, useReducer, useRef, useState } from 'react';

// The server only accepts JSON writes (CSRF guard), so every call sets the content type.
import { supabase } from './supabase.js';
export async function api(url, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(session && { Authorization: `Bearer ${session.access_token}` }), ...opts.headers } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) dispatchEvent(new CustomEvent('unauth')); // hosted: session expired
  if (!r.ok) throw Object.assign(new Error(body.error || r.statusText), { status: r.status, retryAfter: body.retryAfter });
  return body;
}
export const put = (url, data) => api(url, { method: 'PUT', body: JSON.stringify(data) });
export const post = (url, data = {}) => api(url, { method: 'POST', body: JSON.stringify(data) });

// "Download my sprint": a plain <a download> carries no Bearer token, so fetch with auth and save the text as a file.
export async function downloadExport(e) {
  e?.preventDefault();
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch('/api/business/export.md', { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
  if (r.status === 401) dispatchEvent(new CustomEvent('unauth'));
  if (!r.ok) return toast((await r.json().catch(() => ({}))).error || 'Could not export your sprint.');
  const href = URL.createObjectURL(new Blob([await r.text()], { type: 'text/markdown' }));
  const a = Object.assign(document.createElement('a'), { href, download: 'sprint.md' });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(href);
}

// App-wide toasts: call toast() from anywhere; <Toasts /> in App renders them. kind: 'err' | 'ok' | 'info'.
export const toast = (text, kind = 'err') => dispatchEvent(new CustomEvent('toast', { detail: { text, kind } }));
// Styled confirm(): resolves true/false. <Confirm /> in App renders it.
export const ask = (text, ok = 'Continue') =>
  new Promise(resolve => dispatchEvent(new CustomEvent('ask', { detail: { text, ok, resolve } })));

// Turns the server's agent event stream into a flat, ordered list of chat items.
const initial = { items: [], busy: false, dead: false };
function reduce(state, ev) {
  const items = state.items;
  const last = items[items.length - 1];
  const push = item => ({ ...state, items: [...items, item] });
  const replaceLast = item => ({ ...state, items: [...items.slice(0, -1), item] });
  switch (ev.type) {
    case 'reset': return initial;
    case 'hello': return { ...state, busy: ev.busy, dead: false };
    case 'user': return { ...push({ kind: 'user', local: true, text: ev.text }), busy: true };
    case 'done': return ev.stopReason === 'cancelled'
      ? { ...push({ kind: 'sys', text: 'Stopped.' }), busy: false }
      : { ...state, busy: false };
    case 'error': return { ...push({ kind: 'err', text: ev.message }), busy: false };
    case 'exit': return { ...push({ kind: 'err', text: ev.message }), busy: false, dead: true };
    case 'permission': return push({ kind: 'perm', id: ev.id, toolCall: ev.toolCall || {}, options: ev.options });
    case 'permission_done': return {
      ...state,
      items: items.map(i => i.kind === 'perm' && i.id === ev.id
        ? { kind: 'sys', text: (i.options.find(o => o.optionId === ev.optionId)?.name || 'Request cancelled') + (ev.optionId ? ' ✓' : '') }
        : i),
    };
    case 'msg': {
      const kept = items.filter(i => !i.starting);
      // Devin echoes what we sent; confirm the optimistic bubble instead of adding a second one.
      const local = ev.kind === 'user' ? kept.findIndex(i => i.local) : -1;
      if (local >= 0) return { ...state, items: kept.map((x, j) => (j === local ? { ...x, local: false } : x)) };
      return { ...state, items: [...kept, { kind: ev.kind, text: ev.text }] };
    }
    case 'starting': return items.some(i => i.starting) ? state
      : { ...state, items: [...items, { kind: 'sys', starting: true, text: 'Devin is starting up — this takes a minute or two.' }] };
    case 'status': return { ...state, busy: ev.busy };
    case 'applied': return { ...state, items: [...items.filter(i => !i.starting), { kind: 'sys', text: `Updated: ${ev.applied.join(', ')}` }] };
    case 'update': {
      const u = ev.update;
      switch (u.sessionUpdate) {
        case 'agent_message_chunk':
          return last?.kind === 'agent' ? replaceLast({ ...last, text: last.text + (u.content?.text || '') }) : push({ kind: 'agent', text: u.content?.text || '' });
        case 'user_message_chunk': // history replayed after the agent resumes a saved session
          return last?.kind === 'user' && last.replay ? replaceLast({ ...last, text: last.text + (u.content?.text || '') }) : push({ kind: 'user', replay: true, text: u.content?.text || '' });
        case 'tool_call':
        case 'tool_call_update': {
          const i = items.findIndex(x => x.kind === 'tool' && x.id === u.toolCallId);
          const out = toolText(u.content);
          if (i < 0) return push({ kind: 'tool', id: u.toolCallId, title: u.title || 'Working', status: u.status || 'pending', output: out });
          const t = items[i];
          const next = { ...t, title: u.title || t.title, status: u.status || t.status, output: out || t.output };
          return { ...state, items: items.map((x, j) => (j === i ? next : x)) };
        }
        case 'plan': {
          const i = items.findIndex(x => x.kind === 'plan');
          return i < 0 ? push({ kind: 'plan', entries: u.entries }) : { ...state, items: items.map((x, j) => (j === i ? { ...x, entries: u.entries } : x)) };
        }
      }
      return state;
    }
  }
  return state;
}
const toolText = content => (content || [])
  .map(c => c.content?.text ?? c.content?.resource?.text ?? (c.type === 'diff' ? `Edited ${c.path}` : ''))
  .filter(Boolean).join('\n').slice(-4000);

const POLL_BUSY = 4000, POLL_IDLE = 60000;

// Polls a Devin-cloud session via the API. Same reducer; user/agent text items only.
export function useAgent(base, onDone) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [generation, setGeneration] = useState(0);
  const cursor = useRef('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const wake = useRef(() => {});

  // Each poll costs two Devin API calls, so poll fast only while Devin is working,
  // slowly when idle, not at all in a hidden tab, and back off when Devin rate-limits.
  useEffect(() => {
    if (!base) return;
    dispatch({ type: 'reset' });
    cursor.current = '';
    let stop = false, timer, busy = true, backoff = 0, inFlight = false;
    const schedule = ms => { clearTimeout(timer); if (!stop && !document.hidden) timer = setTimeout(tick, ms); };
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await api(`${base}/poll${cursor.current ? `?cursor=${cursor.current}` : ''}`);
        if (stop) return;
        backoff = 0;
        for (const m of r.messages || []) {
          cursor.current = m.id;
          dispatch({ type: 'msg', kind: m.kind, text: m.text });
        }
        if (r.starting) dispatch({ type: 'starting' });
        busy = r.busy;
        dispatch({ type: 'status', busy: r.busy });
        if (r.applied?.length) { dispatch({ type: 'applied', applied: r.applied }); doneRef.current?.(); }
      } catch (e) {
        if (e.status === 429) backoff = Math.min(Math.max((e.retryAfter || 0) * 1000, backoff * 2 || 15000), 120000);
      } finally { inFlight = false; }
      schedule(backoff || (busy ? POLL_BUSY : POLL_IDLE));
    };
    const onVisible = () => { if (!document.hidden) schedule(0); };
    wake.current = () => { busy = true; backoff = 0; schedule(POLL_BUSY); };
    document.addEventListener('visibilitychange', onVisible);
    tick();
    return () => { stop = true; clearTimeout(timer); wake.current = () => {}; document.removeEventListener('visibilitychange', onVisible); };
  }, [base, generation]);

  const fail = e => dispatch({ type: 'error', message: e.message });
  return {
    ...state,
    base,
    send: async (text, snapshot, step) => {
      dispatch({ type: 'user', text });
      dispatch({ type: 'status', busy: true });
      try { await post(`${base}/prompt`, { text, snapshot, step }); wake.current(); } catch (e) { fail(e); }
    },
    restart: () => { post(`${base}/new`).catch(() => {}); cursor.current = ''; setGeneration(g => g + 1); },
  };
}
