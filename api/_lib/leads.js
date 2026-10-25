import crypto from 'node:crypto';
import { CHANNELS } from '../../ui/web/src/steps.js';

export const leadToken = () => crypto.randomBytes(12).toString('hex'); // 24 hex chars
export const LEAD_TOKEN = /^[a-f0-9]{24}$/;
export const MAX_TRACKER = 500;

// body: parsed object (JSON or form fields). Returns null when it should be silently
// dropped (honeypot filled) or when name AND contact are both blank.
export function cleanLead(body, experiments = [], now = new Date()) {
  const s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  if (!body || typeof body !== 'object' || s(body.company, 50)) return null; // 'company' is the honeypot
  const name = s(body.name, 200), contact = s(body.contact, 200), message = s(body.message, 2000);
  if (!name && !contact) return null;
  const source = CHANNELS.includes(body.source) ? body.source : 'Website';
  const experiment = experiments.some(e => e.id === body.experiment) ? body.experiment : null;
  return { id: crypto.randomUUID(), name, contact, source, experiment, stage: 'Lead', value: '', date: now.toISOString().slice(0, 10), notes: message };
}

// Newest first (the Tracker UI prepends new rows). Over the cap, drop from the end, Lost rows first.
export function appendLead(tracker, lead) {
  const rows = [lead, ...(Array.isArray(tracker) ? tracker : [])];
  if (rows.length <= MAX_TRACKER) return rows;
  const keep = rows.filter(r => r.stage !== 'Lost');
  return (keep.length >= MAX_TRACKER ? keep : [...keep, ...rows.filter(r => r.stage === 'Lost')]).slice(0, MAX_TRACKER);
}

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Self-contained page: fetch POST when JS is on, plain form POST (urlencoded) when it's off.
export function leadFormHtml({ business, token, exp, src }) {
  const source = CHANNELS.includes(src) ? src : 'Website';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contact ${esc(business)}</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f5f2; color: #1c1c1e; }
  main { max-width: 28rem; margin: 0 auto; padding: 2rem 1rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .4rem; }
  p.sub { color: #555; margin: 0 0 1.5rem; }
  label { display: block; font-weight: 600; margin: 1rem 0 .3rem; }
  input, textarea { width: 100%; box-sizing: border-box; font: inherit; padding: .8rem; border: 1px solid #c9c7c2; border-radius: .6rem; background: #fff; }
  textarea { min-height: 6rem; }
  button { margin-top: 1.2rem; width: 100%; font: inherit; font-weight: 700; padding: .9rem; border: 0; border-radius: .6rem; background: #1c1c1e; color: #fff; cursor: pointer; }
  .hp { position: absolute; left: -9999px; }
  #done { display: none; margin-top: 1.5rem; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Contact ${esc(business)}</h1>
  <p class="sub">Leave your details and we’ll be in touch shortly.</p>
  <form id="f" method="post" action="/api/lead/${esc(token)}">
    <label for="name">Name</label>
    <input id="name" name="name" required>
    <label for="contact">Phone or email</label>
    <input id="contact" name="contact" required>
    <label for="message">How can we help?</label>
    <textarea id="message" name="message"></textarea>
    <input type="hidden" name="source" value="${esc(source)}">
    <input type="hidden" name="experiment" value="${esc(exp)}">
    <div class="hp"><input name="company" tabindex="-1" autocomplete="off"></div>
    <button type="submit">Send</button>
  </form>
  <p id="done"></p>
</main>
<script>
document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const done = document.getElementById('done');
  try {
    const r = await fetch(e.target.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    if (!r.ok) throw 0;
    e.target.remove();
    done.textContent = 'Thanks — we’ll be in touch shortly.';
  } catch { done.textContent = 'Something went wrong, please call us.'; }
  done.style.display = 'block';
});
</script>
</body>
</html>`;
}
