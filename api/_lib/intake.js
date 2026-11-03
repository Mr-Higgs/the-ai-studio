import { INTAKE_FORM, INTAKE_FIELDS, PREFILL_KEYS, intakeSummary } from '../../ui/web/src/intake.js';

export const INTAKE_MAX_BODY = 32 * 1024;
export const EMAIL = /^\S+@\S+\.\S+$/;

const str = v => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const dedup = a => [...new Set(a)];

// body: parsed JSON. Returns null when it should be dropped (honeypot, no usable email, bad shape).
export function cleanIntake(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.company === 'string' && body.company.trim()) return null; // 'company' is the honeypot
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return null;
  const A = body.answers, answers = {};
  // `site` is a prefill-only key (no field renders it); keep it as a text answer.
  const fields = [...INTAKE_FIELDS, ...PREFILL_KEYS.filter(k => !INTAKE_FIELDS.some(f => f.k === k)).map(k => ({ k, t: 'text' }))];
  for (const f of fields) {
    const v = A[f.k];
    if (f.t === 'text' || f.t === 'email') {
      const s = str(v).trim().slice(0, 300); if (s) answers[f.k] = s;
    } else if (f.t === 'area') {
      const s = str(v).trim().slice(0, 4000); if (s) answers[f.k] = s;
    } else if (f.t === 'chips') {
      const s = str(v).trim(); if (f.opts.includes(s)) answers[f.k] = s;
    } else if (f.t === 'multi') {
      const a = dedup((Array.isArray(v) ? v : []).filter(x => typeof x === 'string' && f.opts.includes(x))).slice(0, 20);
      if (a.length) answers[f.k] = a;
    } else if (f.t === 'cards') {
      const ids = f.opts.map(o => o[0]);
      const a = dedup((Array.isArray(v) ? v : []).filter(x => typeof x === 'string' && ids.includes(x))).slice(0, 20);
      if (a.length) answers[f.k] = a;
    } else if (f.t === 'scale') {
      const n = typeof v === 'boolean' ? NaN : Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) answers[f.k] = n;
    }
  }
  if (!EMAIL.test(answers.email || '')) return null;
  return { form: INTAKE_FORM, name: answers.name || '', email: answers.email, business: answers.biz || '', answers, summary: intakeSummary(answers, now) };
}
