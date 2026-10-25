import crypto from 'node:crypto';
import { BUSINESS_DOCS, cleanCalendar, cleanExperiments } from './business.js';
import { answersFromDevin, brainContext } from '../../ui/web/src/brain.js';

const MAX_DOC = 40000;
const cut = (t, n = MAX_DOC) => (t && t.length > n ? `${t.slice(0, n)}\n\n(truncated)` : t);

export function contextParts(biz, docs) {
  const out = [{ key: 'profile', text: `Business profile (JSON): ${JSON.stringify(biz.profile || {})}` }];
  const brain = brainContext(biz.brain, biz.profile);
  if (brain) out.push({ key: 'brain', text: brain });
  if (biz.inputs && Object.keys(biz.inputs).length) out.push({ key: 'inputs', text: `Step answers (JSON): ${JSON.stringify(biz.inputs)}` });
  if (biz.leadFormUrl) out.push({ key: 'leadForm', text: `Website lead form (use this URL wherever a call-to-action needs a link, instead of [link]): ${biz.leadFormUrl}` });
  if (biz.tracker?.length) out.push({ key: 'tracker', text: `Lead tracker (JSON): ${cut(JSON.stringify(biz.tracker))}` });
  if (biz.experiments?.length) out.push({ key: 'experiments', text: `Growth experiments (JSON): ${cut(JSON.stringify(biz.experiments))}` });
  if (biz.adInsights?.campaigns?.length) {
    const { account = {}, syncedAt, campaigns } = biz.adInsights;
    out.push({ key: 'ads', text: `Meta ad results (read-only, pulled by Studio from the owner's ad account "${account.name || ''}", amounts in ${account.currency || ''}, lifetime totals, synced ${syncedAt || ''}): ${cut(JSON.stringify(campaigns))}` });
  }
  if (biz.instagramInsights) {
    const { account = {}, last28, posts, syncedAt } = biz.instagramInsights;
    out.push({ key: 'instagram', text: `Instagram organic results (read-only, pulled by Studio from @${account.username || ''}, last 28 days, synced ${syncedAt || ''}): ${cut(JSON.stringify({ account, last28, posts }))}` });
  }
  for (const k of BUSINESS_DOCS) if (docs?.[k]?.content) out.push({ key: `doc:${k}`, text: `### ${k}.md\n${cut(docs[k].content)}` });
  if (biz.calendar?.length) out.push({ key: 'calendar', text: `### calendar.json\n${cut(JSON.stringify(biz.calendar))}` });
  return out;
}
export function buildContext(biz, docs) {
  return contextParts(biz, docs).map(part => part.text).join('\n\n');
}
export const partHashes = parts => Object.fromEntries(parts.map(({ key, text }) => [
  key, crypto.createHash('sha256').update(text).digest('hex'),
]));
export function changedParts(parts, prevHashes = {}, { skip = [] } = {}) {
  const skipped = new Set(skip);
  const hashes = partHashes(parts);
  return parts.filter(({ key }) => !skipped.has(key) && hashes[key] !== prevHashes?.[key]);
}

export function offerSkill(readFile) {
  return [
    "The grand-slam-offer skill files are included below. Don't try to read or save files: ignore its instructions about reading files or saving to offers/ — return the document as offer.md in the structured output.",
    ['.devin/skills/grand-slam-offer/SKILL.md', readFile('SKILL.md')],
    ['.devin/skills/grand-slam-offer/references/framework.md', readFile('references/framework.md')],
    ['.devin/skills/grand-slam-offer/templates/offer-doc.md', readFile('templates/offer-doc.md')],
  ].map((part, i) => i === 0 ? part : `### ${part[0]}\n${part[1]}`).join('\n\n');
}

export const OUTPUT_CONTRACT = `

How to return your work — IMPORTANT. You have no filesystem access to these files. Put every
document you create or change into the structured output as
{"files": {"<name>": <content>}, "summary": "<3 lines>"} where <name> is one of
${BUSINESS_DOCS.map(d => `${d}.md`).join(', ')}, calendar.json (the JSON
array itself, not a string), or experiments.json (the JSON array itself, not a string). Update the structured output whenever a document changes — the app
reads it from there. Still reply in chat with a 3-line summary of what you did. Never say
"saved to business/…" — you can't write those files.
If I ask you to work out numbers for my profile or Business Brain, also return the ones I've confirmed as "answers.json": {"<question id>": "<value>"} (strings, no units). The app only fills answers that are blank or marked "help me work this out", and marks them as estimates for me to check.`;

// Workshop feedback: constraints were ignored, testimonials were made up, answers were generic.
export const GROUNDING = `
Accuracy rules — follow every one:
- Use only facts from the context above, what I tell you, or research you actually did in this
  session (name the source). If you didn't research something, say so instead of guessing.
- Never invent testimonials, reviews, ratings, customer quotes, statistics or past results. If a
  piece needs one and none is given, write a clearly marked placeholder like [ADD A REAL REVIEW].
- Respect every constraint I gave: budget, capacity, dates, prices, minimum earnings, discounts,
  policies, words to avoid. If a recommendation would break one, say so plainly.
- Label anything that rests on an estimate or an assumption. Use the app-calculated numbers as given.
- Be specific to this business — concrete names, numbers, dates and next actions, nothing generic.`;

export const STRUCTURED_SCHEMA = {
  type: 'object',
  properties: {
    files: { type: 'object', additionalProperties: true },
    summary: { type: 'string' },
  },
};

const ALLOWED = [...BUSINESS_DOCS.map(d => `${d}.md`), 'calendar.json', 'experiments.json', 'answers.json'];

// Validate what Devin wrote into its structured output.
export function applyStructuredOutput(so) {
  const files = so?.files;
  if (!files || typeof files !== 'object') return null;
  const docs = {};
  let calendar, experiments, answers, issues = 0;
  for (const [name, content] of Object.entries(files)) {
    if (!ALLOWED.includes(name)) continue; // drop anything unexpected
    if (name === 'answers.json') {
      answers = answersFromDevin(content);
    } else if (name === 'calendar.json') {
      const c = cleanCalendar(content);
      if (c.items) { calendar = c.items; issues = c.issues; }
    } else if (name === 'experiments.json') {
      const c = cleanExperiments(content);
      if (c.items) experiments = c.items;
    } else if (typeof content === 'string' && content.length <= 200000) {
      docs[name.replace(/\.md$/, '')] = content;
    }
  }
  if (!Object.keys(docs).length && !calendar && !experiments && !answers) return null;
  return { docs, calendar, experiments, issues, answers, hash: hashOf(files) };
}
export const hashOf = files => crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');

export function sessionPrompt(ctx, text, { skill, extra } = {}) {
  return [skill, ctx, GROUNDING, OUTPUT_CONTRACT, extra, `My request: ${text}`].filter(Boolean).join('\n\n');
}
