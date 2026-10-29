import { post } from './api.js';

// Google OAuth in a popup: get the authorize URL from the API, navigate the popup, then call
// onDone when the callback postMessages back — or when focus returns (user closed it).
export async function connectGoogle(onDone) {
  const w = window.open('', '_blank'); // opened now so the popup blocker allows it
  let url;
  try { ({ url } = await post('/api/google/oauth/start')); }
  catch (e) { w?.close(); throw e; }
  if (!w) { window.location.href = url; return; }
  w.location = url;
  const done = () => { cleanup(); onDone?.(); };
  const onMsg = e => { if (e?.data?.type === 'google-connected') done(); };
  const onFocus = () => done();
  const cleanup = () => { removeEventListener('message', onMsg); removeEventListener('focus', onFocus); };
  addEventListener('message', onMsg);
  addEventListener('focus', onFocus);
}
