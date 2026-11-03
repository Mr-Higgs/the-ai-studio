import { INTAKE_FORM, INTAKE_STEPS, PREFILL_KEYS, SEND_TO, intakeSummary } from './intake.js';

/* ---------- STATE ---------- */
const KEY = INTAKE_FORM;
let A = {}, idx = 0, done = false, sent = false, text = '', hp = '';
try { A = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
try { // prefill from link, e.g. ?name=Jean&biz=Acme&email=a@b.com&site=acme.com
  const p = new URLSearchParams(location.search);
  PREFILL_KEYS.forEach(k => { if (p.get(k) && !A[k]) A[k] = p.get(k); });
} catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch {} };
const vis = () => INTAKE_STEPS.filter(s => !s.mod || (A.modules || []).includes(s.mod));

/* ---------- MARKDOWN ---------- */
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function mdInline(t) {
  t = esc(t);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}
function mdBlock(src) {
  const out = []; let list = false;
  const close = () => { if (list) { out.push('</ul>'); list = false; } };
  src.split('\n').forEach(line => {
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { close(); out.push(`<h${m[1].length + 2}>${mdInline(m[2])}</h${m[1].length + 2}>`); }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${mdInline(m[1])}`); out.push('</li>'); }
    else if (/^\s{2,}\S/.test(line) && list) { out.splice(out.length - 1, 0, '<br>' + mdInline(line.trim())); }
    else if (!line.trim()) { close(); }
    else { close(); out.push(`<p>${mdInline(line)}</p>`); }
  });
  close(); return out.join('');
}

/* ---------- RENDER ---------- */
const app = document.getElementById('app');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function field(f) {
  const w = el('div', 'field');
  if (f.label) { const l = el('label', 'q'); l.innerHTML = mdInline(f.label); w.appendChild(l); }
  if (f.hint) { const h = el('span', 'hint'); h.innerHTML = mdInline(f.hint); w.appendChild(h); }
  if (f.t === 'text' || f.t === 'email') {
    const i = el('input'); i.type = f.t === 'email' ? 'email' : 'text'; i.value = A[f.k] || ''; if (f.ph) i.placeholder = f.ph;
    i.autocomplete = f.k === 'email' ? 'email' : f.k === 'name' ? 'name' : 'off';
    i.oninput = () => { A[f.k] = i.value; save(); }; w.appendChild(i);
  } else if (f.t === 'area') {
    const i = el('textarea'); i.value = A[f.k] || ''; i.oninput = () => { A[f.k] = i.value; save(); }; w.appendChild(i);
  } else if (f.t === 'chips') {
    const c = el('div', 'chips');
    f.opts.forEach(o => { const b = el('button', 'chip' + (A[f.k] === o ? ' on' : '')); b.type = 'button'; b.textContent = o;
      b.onclick = () => { A[f.k] = A[f.k] === o ? '' : o; save(); [...c.children].forEach(x => x.classList.toggle('on', x.textContent === A[f.k])); };
      c.appendChild(b); });
    w.appendChild(c);
  } else if (f.t === 'multi') {
    const c = el('div', 'chips');
    f.opts.forEach(o => { const b = el('button', 'chip' + ((A[f.k] || []).includes(o) ? ' on' : '')); b.type = 'button'; b.textContent = o;
      b.onclick = () => { const s = new Set(A[f.k] || []); s.has(o) ? s.delete(o) : s.add(o); A[f.k] = [...s]; save(); b.classList.toggle('on', s.has(o)); };
      c.appendChild(b); });
    w.appendChild(c);
  } else if (f.t === 'scale') {
    const c = el('div', 'scale'); c.appendChild(el('small', '', f.lo));
    for (let n = 1; n <= 5; n++) { const b = el('button', 'chip' + (A[f.k] == n ? ' on' : '')); b.type = 'button'; b.textContent = n;
      b.onclick = () => { A[f.k] = n; save(); [...c.querySelectorAll('.chip')].forEach(x => x.classList.toggle('on', +x.textContent === n)); }; c.appendChild(b); }
    c.appendChild(el('small', '', f.hi)); w.appendChild(c);
  } else if (f.t === 'cards') {
    const c = el('div', 'cards');
    f.opts.forEach(([id, t, d]) => { const on = (A[f.k] || []).includes(id);
      const b = el('button', 'card' + (on ? ' on' : ''), `<span class="box">${on ? '✓' : ''}</span><span><strong></strong><span class="d"></span></span>`);
      b.type = 'button'; b.querySelector('strong').textContent = t; b.querySelector('.d').textContent = d;
      b.onclick = () => { const s = new Set(A[f.k] || []); s.has(id) ? s.delete(id) : s.add(id); A[f.k] = [...s]; save();
        b.classList.toggle('on', s.has(id)); b.querySelector('.box').textContent = s.has(id) ? '✓' : ''; update(); };
      c.appendChild(b); });
    w.appendChild(c);
  }
  return w;
}

function render() {
  const V = vis(), s = V[idx]; app.innerHTML = ''; window.scrollTo(0, 0);
  const back = document.getElementById('back'), next = document.getElementById('next');
  if (done) { renderDone(); back.hidden = next.hidden = true; setProg(100); document.getElementById('count').textContent = ''; return; }
  const d = el('div', 'step');
  if (s.intro) {
    d.appendChild(el('h1', '', "Let's lock in your proposal."));
    d.appendChild(el('p', 'sub', 'About 3 minutes. We already have your details from our call, so this is mostly about budget and priorities. Your answers save as you go.'));
    d.appendChild(el('div', 'note', 'Ranges are fine. There are no wrong answers, and nothing here commits you.'));
    next.textContent = 'Start'; back.hidden = true;
  } else {
    d.appendChild(el('h2', '', s.title)); d.appendChild(el('p', 'sub', mdInline(s.sub || '')));
    if (s.note) d.appendChild(el('div', 'note' + (s.note.warn ? ' warn' : ''), mdInline(s.note.text)));
    s.fields.forEach(f => d.appendChild(field(f)));
    if (s.id === 'you') {
      const h = el('div', 'hp');
      const i = el('input'); i.name = 'company'; i.tabIndex = -1; i.autocomplete = 'off'; i.value = hp;
      i.oninput = () => { hp = i.value; };
      h.appendChild(i); d.appendChild(h);
    }
    back.hidden = false; next.textContent = idx === V.length - 1 ? 'Send it' : 'Continue';
  }
  next.hidden = false; app.appendChild(d);
  d.appendChild(el('div', 'saved', 'Saved automatically'));
  setProg(Math.round(idx / (V.length - 1) * 100));
  document.getElementById('count').textContent = s.intro ? '' : `Step ${idx} of ${V.length - 1}`;
}
function update() { const V = vis(); setProg(Math.round(idx / (V.length - 1) * 100)); document.getElementById('count').textContent = `Step ${idx} of ${V.length - 1}`; }
function setProg(p) { document.getElementById('prog').style.width = p + '%'; }

function validate(s) {
  document.querySelectorAll('.err').forEach(e => e.remove());
  if (!s.fields) return true;
  let ok = true;
  s.fields.forEach((f, i) => {
    if (!f.req) return;
    const v = (A[f.k] || '').toString().trim();
    const bad = !v || (f.t === 'email' && !/^\S+@\S+\.\S+$/.test(v));
    if (bad) { ok = false; const box = app.querySelectorAll('.field')[i]; box.appendChild(el('div', 'err', f.t === 'email' ? 'Please enter a valid email.' : 'Required.')); }
  });
  return ok;
}

document.getElementById('next').onclick = () => {
  const V = vis(), s = V[idx];
  if (!validate(s)) return;
  if (idx === V.length - 1) { submit(); return; }
  idx++; render();
};
document.getElementById('back').onclick = () => { if (idx > 0) { idx--; render(); } };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') document.getElementById('next').click(); });

/* ---------- SUBMIT ---------- */
async function submit() {
  text = intakeSummary(A);
  try {
    const r = await fetch('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form: INTAKE_FORM, answers: A, company: hp }) });
    if (r.ok) { sent = true; try { localStorage.removeItem(KEY); } catch {} }
  } catch {}
  done = true; render();
}
function renderDone() {
  const d = el('div', 'step');
  if (sent) {
    d.appendChild(el('h1', '', 'Got it. Thank you.'));
    d.appendChild(el('p', 'sub', 'Sam will review your answers and follow up before our next call.'));
  } else {
    d.appendChild(el('h1', '', 'One last step.'));
    d.appendChild(el('p', 'sub', "Send your answers to Sam with either button below. If the email button doesn't open anything, use Copy or Download and email it to " + SEND_TO + '.'));
    const row = el('div', 'row');
    const mail = el('button', 'btn', 'Email my answers'); mail.onclick = () => { location.href = `mailto:${SEND_TO}?subject=${encodeURIComponent('Proposal intake: ' + (A.biz || ''))}&body=${encodeURIComponent(text.slice(0, 1800) + (text.length > 1800 ? '\n\n[Truncated. Full answers attached or pasted separately.]' : ''))}`; };
    const cp = el('button', 'btn ghost', 'Copy as Markdown'); cp.onclick = async () => { try { await navigator.clipboard.writeText(text); cp.textContent = 'Copied'; } catch { cp.textContent = 'Select and copy below'; } };
    const dl = el('button', 'btn ghost', 'Download .md'); dl.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = `intake-${(A.biz || 'client').replace(/\W+/g, '-').toLowerCase()}.md`; a.click(); };
    row.append(mail, cp, dl); d.appendChild(row);
  }
  const pre = el('div', 'sum md'); pre.innerHTML = mdBlock(text); d.appendChild(pre);
  app.appendChild(d);
}
render();
