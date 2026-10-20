import { useCallback, useEffect, useRef, useState } from 'react';

// The server only accepts JSON writes (CSRF guard), so every call sets the content type.
export async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}
export const put = (url, data) => api(url, { method: 'PUT', body: JSON.stringify(data) });
export const post = (url, data = {}) => api(url, { method: 'POST', body: JSON.stringify(data) });
export async function signOut() {
  await fetch('/api/auth/signout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  location.assign('/login');
}

// App-wide toasts: call toast() from anywhere; <Toasts /> in App renders them. kind: 'err' | 'ok' | 'info'.
export const toast = (text, kind = 'err') => dispatchEvent(new CustomEvent('toast', { detail: { text, kind } }));
// Styled confirm(): resolves true/false. <Confirm /> in App renders it.
export const ask = (text, ok = 'Continue') =>
  new Promise(resolve => dispatchEvent(new CustomEvent('ask', { detail: { text, ok, resolve } })));

const ACTIVE_STATUSES = new Set(['new', 'claimed', 'running', 'resuming']);
const TERMINAL_STATUSES = new Set(['exit', 'error', 'suspended']);

export function useAgent(refreshBusiness) {
  const [items, setItems] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [status, setStatus] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(refreshBusiness);

  useEffect(() => { refreshRef.current = refreshBusiness; }, [refreshBusiness]);

  const setCurrentConversation = useCallback(id => setConversation(id), []);

  const loadConversations = useCallback(async () => {
    const result = await api('/api/business/conversations');
    const list = result.conversations || [];
    setConversations(list);
    return list;
  }, []);

  const loadMessages = useCallback(async id => {
    const result = await api(`/api/business/agent/messages?conversation=${encodeURIComponent(id)}`);
    setItems(result.messages || []);
    setStatus(result.status || null);
    setUrl(result.url || null);
    await refreshRef.current?.();
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadConversations().then(list => {
      if (cancelled || !list.length) return;
      const current = list[0];
      setCurrentConversation(current.id);
      setStatus(current.status || null);
      setUrl(current.url || null);
      loadMessages(current.id).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadConversations, loadMessages, setCurrentConversation]);

  useEffect(() => {
    if (!conversation || !ACTIVE_STATUSES.has(status)) return undefined;
    let timer = null;
    let loading = false;
    const poll = () => {
      if (document.hidden || loading) return;
      loading = true;
      loadMessages(conversation).catch(() => {}).finally(() => { loading = false; });
    };
    const schedule = () => {
      clearInterval(timer);
      timer = document.hidden ? null : setInterval(poll, 3000);
    };
    const visibilityChanged = () => {
      if (document.hidden) {
        clearInterval(timer);
        timer = null;
      } else {
        poll();
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [conversation, status, loadMessages]);

  const openConversation = useCallback(async id => {
    const selected = conversations.find(item => item.id === id);
    setCurrentConversation(id);
    setItems([]);
    setStatus(selected?.status || null);
    setUrl(selected?.url || null);
    setBusy(true);
    try {
      await loadMessages(id);
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }, [conversations, loadMessages, setCurrentConversation]);

  const newConversation = useCallback(() => {
    setCurrentConversation(null);
    setItems([]);
    setStatus(null);
    setUrl(null);
    setBusy(false);
  }, [setCurrentConversation]);

  const send = useCallback(async (text, title) => {
    const message = String(text || '').trim();
    if (!message || busy) return;
    const startNew = !conversation || status === 'exit' || status === 'error';
    setBusy(true);
    try {
      const result = await post('/api/business/agent', {
        text: message,
        conversation: startNew ? undefined : conversation,
        new: startNew,
        title,
      });
      const current = result.conversation;
      if (!current?.id) throw new Error('Devin did not return a conversation');
      setCurrentConversation(current.id);
      setStatus(current.status || null);
      setUrl(current.url || null);
      await loadConversations();
      await loadMessages(current.id);
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }, [busy, conversation, status, setCurrentConversation, loadConversations, loadMessages]);

  const cancel = useCallback(async () => {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      await post('/api/business/agent/cancel', { conversation });
      await loadMessages(conversation);
      await loadConversations();
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }, [conversation, busy, loadMessages, loadConversations]);

  return {
    items,
    conversations,
    conversation,
    status,
    url,
    busy,
    active: ACTIVE_STATUSES.has(status),
    dead: TERMINAL_STATUSES.has(status),
    send,
    answer: send,
    cancel,
    restart: newConversation,
    newConversation,
    openConversation,
  };
}
