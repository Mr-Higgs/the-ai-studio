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

export function useAgent() {
  return { items: [], busy: false, dead: false, send() {}, cancel() {}, answer() {}, restart() {} };
}
