import { useEffect, useReducer, useRef, useState } from 'react';

// The server only accepts JSON writes (CSRF guard), so every call sets the content type.
export async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) dispatchEvent(new CustomEvent('unauth')); // hosted: session expired
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}
export const put = (url, data) => api(url, { method: 'PUT', body: JSON.stringify(data) });
export const post = (url, data = {}) => api(url, { method: 'POST', body: JSON.stringify(data) });

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
    case 'user': return { ...push({ kind: 'user', text: ev.text }), busy: true };
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

// One live connection to an agent session: '/api/business' or '/api/projects/<name>'.
export function useAgent(base, onDone) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [generation, setGeneration] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!base) return;
    dispatch({ type: 'reset' });
    const es = new EventSource(`${base}/events`);
    es.onmessage = m => {
      const ev = JSON.parse(m.data);
      dispatch(ev);
      if (ev.type === 'done') doneRef.current?.();
      if (ev.type === 'exit') es.close();
    };
    return () => es.close();
  }, [base, generation]);

  const fail = e => dispatch({ type: 'error', message: e.message });
  return {
    ...state,
    base,
    send: (text, snapshot) => post(`${base}/prompt`, { text, snapshot }).catch(fail),
    cancel: () => post(`${base}/cancel`).catch(fail),
    answer: (id, optionId) => post(`${base}/permission`, { id, optionId }).catch(fail),
    restart: () => setGeneration(g => g + 1),
  };
}
