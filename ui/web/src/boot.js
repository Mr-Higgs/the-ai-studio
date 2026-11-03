// First-load trace: how long each boot leg took and how it failed. Read window.__studioBoot,
// or set localStorage.debug = 'boot' to see each mark in the console.
const marks = [];
const debug = () => { try { return localStorage.getItem('debug') === 'boot'; } catch { return false; } };
export function mark(phase, { ms, ok, status, message } = {}) {
  const m = { phase, ms: Math.round(ms), ok, status, message, at: Date.now() };
  if (marks.push(m) > 50) marks.shift();
  if (debug()) console.debug('[boot]', m);
}
export const BOOT_PATHS = { '/api/auth/me': 'me', '/api/business': 'business' };
if (typeof window !== 'undefined') window.__studioBoot = marks;
