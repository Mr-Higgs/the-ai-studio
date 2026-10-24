import crypto from 'node:crypto';
import { BUSINESS_DOCS, cleanCalendar } from './business.js';

const MAX_DOC = 12000;
const cut = (t, n = MAX_DOC) => (t && t.length > n ? `${t.slice(0, n)}\n\n(truncated)` : t);

// Everything Devin needs to know about this business, inlined into the first prompt
// (cloud sessions have no access to our DB; follow-ups get no re-inline).
export function buildContext(biz, docs) {
  const out = [`Business profile (JSON): ${JSON.stringify(biz.profile || {})}`];
  if (biz.inputs && Object.keys(biz.inputs).length) out.push(`Step answers (JSON): ${JSON.stringify(biz.inputs)}`);
  if (biz.tracker?.length) out.push(`Lead tracker (JSON): ${cut(JSON.stringify(biz.tracker))}`);
  for (const k of BUSINESS_DOCS) if (docs?.[k]?.content) out.push(`### ${k}.md\n${cut(docs[k].content)}`);
  if (biz.calendar?.length) out.push(`### calendar.json\n${cut(JSON.stringify(biz.calendar))}`);
  return out.join('\n\n');
}

export const OUTPUT_CONTRACT = `

How to return your work — IMPORTANT. You have no filesystem access to these files. Put every
document you create or change into the structured output as
{"files": {"<name>": <content>}, "summary": "<3 lines>"} where <name> is one of
${BUSINESS_DOCS.map(d => `${d}.md`).join(', ')} (Markdown strings) or calendar.json (the JSON
array itself, not a string). Update the structured output whenever a document changes — the app
reads it from there. Still reply in chat with a 3-line summary of what you did. Never say
"saved to business/…" — you can't write those files.`;

export const STRUCTURED_SCHEMA = {
  type: 'object',
  properties: {
    files: { type: 'object', additionalProperties: true },
    summary: { type: 'string' },
  },
};

const ALLOWED = [...BUSINESS_DOCS.map(d => `${d}.md`), 'calendar.json'];

// Validate what Devin wrote into its structured output. Returns { docs, calendar, issues, hash }.
export function applyStructuredOutput(so) {
  const files = so?.files;
  if (!files || typeof files !== 'object') return null;
  const docs = {};
  let calendar, issues = 0;
  for (const [name, content] of Object.entries(files)) {
    if (!ALLOWED.includes(name)) continue; // drop anything unexpected
    if (name === 'calendar.json') {
      const c = cleanCalendar(content);
      if (c.items) { calendar = c.items; issues = c.issues; }
    } else if (typeof content === 'string' && content.length <= 200000) {
      docs[name.replace(/\.md$/, '')] = content;
    }
  }
  if (!Object.keys(docs).length && !calendar) return null;
  return { docs, calendar, issues, hash: hashOf(files) };
}
export const hashOf = files => crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');

export function sessionPrompt(ctx, text, { skill, extra } = {}) {
  return [skill, ctx, OUTPUT_CONTRACT, extra, `My request: ${text}`].filter(Boolean).join('\n\n');
}
