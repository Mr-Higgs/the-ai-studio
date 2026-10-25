// ============================================================================
//  BUSINESS BRAIN — the questions, the math, and how Devin sees the answers.
//  Pure JS (no React): the UI renders it and api/_lib/prompts.js inlines it.
//
//  Stored on the business as `brain`:
//    { answers: { <qid>: { v, s } }, items: [ { <field>: { v, s } } ] }
//    v = the answer, s = 'known' | 'estimate' | 'help' (blank = not tagged yet)
//  Questions with `profile` read/write that business-profile field instead of `answers`.
// ============================================================================

export const TAGS = {
  known: { label: 'Known', hint: 'A real figure or fact' },
  estimate: { label: 'Estimate', hint: 'My best guess — treat it as one' },
  help: { label: 'Help me work this out', hint: 'I don’t know yet' },
};

// The Business profile step. `heading` rows split it into groups; `num` fields feed brainMath.
// Brain questions with `profile: <id>` show and edit the same value, so it's only asked once.
export const PROFILE_FIELDS = [
  { id: 'name', label: 'Business name', placeholder: 'e.g. Juniper & Wick Candle Co.' },
  { id: 'location', label: 'Where you sell', placeholder: 'e.g. Austin, TX + ships nationwide' },
  { id: 'sells', label: 'What you sell', type: 'textarea', placeholder: 'Products or services, in a sentence or two' },
  { id: 'customers', label: 'Who buys from you today', type: 'textarea', placeholder: 'e.g. Women 30–55 buying gifts, local offices ordering client gifts' },
  { id: 'price', label: 'Average sale', placeholder: 'e.g. $48' },
  { id: 'website', label: 'Website', placeholder: 'https://…' },
  { id: 'socials', label: 'Social handles', placeholder: 'e.g. @juniperwick on Instagram and TikTok' },
  { id: 'proof', label: 'Reviews, awards or numbers you’re proud of', placeholder: 'e.g. 4.9★ on Etsy, 300+ reviews' },
  { heading: 'Your time and pay', blurb: 'So every offer pays you for your time, not just your costs. Rough numbers are fine.' },
  { id: 'hoursWeek', label: 'Hours you work in the business each week', num: true, how: 'Count a normal week: making or serving, plus messages, admin, buying supplies and deliveries.', placeholder: 'e.g. 45 — include admin, messages, deliveries' },
  { id: 'payGoal', label: 'What you want to take home from the business per year ($)', num: true, how: 'What you need for your personal bills and savings for a year, plus what would make the work worth it.', placeholder: 'e.g. 60000' },
  { id: 'rate', label: 'What an hour of your time is worth ($/hour)', num: true, how: 'Start from your pay goal ÷ (hours a week × 48 weeks), then compare it with what you’d earn doing similar work for someone else.', placeholder: 'e.g. 30' },
  { id: 'replaceRate', label: 'What you’d pay someone else to do your work ($/hour)', num: true, how: 'What local job ads or freelancers charge for the same kind of work.', placeholder: 'e.g. 22' },
  { heading: 'Running costs in a typical month', blurb: 'Enter 0 for anything you don’t have — a blank means “don’t know yet”.' },
  { id: 'revenueMonth', label: 'Sales ($)', num: true, how: 'Average of the last 3 months of sales from your bank, card reader or shop reports.', placeholder: 'e.g. 6000' },
  { id: 'laborMonth', label: 'Staff and contractor pay — not your own ($)', num: true, how: 'Wages and contractor payments in a normal month; 0 if it’s just you.', placeholder: 'e.g. 0 if it’s just you' },
  { id: 'materialsMonth', label: 'Materials, stock and supplies ($)', num: true, how: 'Supplier receipts or card statements for ingredients, stock, packaging and supplies, averaged over 3 months.', placeholder: 'e.g. 1800' },
  { id: 'overhead', label: 'Other running costs — rent, software, insurance, utilities, fees ($)', num: true, how: 'Rent, software, insurance, phone, utilities, platform and card fees — a monthly average from bank statements.', placeholder: 'e.g. 450' },
  { heading: 'Customers over time' },
  { id: 'newMonth', label: 'New customers in a typical month', num: true, how: 'First-time buyers in a normal month — from order history, booking records, or a rough count.', placeholder: 'e.g. 25' },
  { id: 'cac', label: 'What it costs to win one new customer — ads, samples, discounts (CAC, $)', num: true, how: 'Marketing spend over the last 1–3 months (ads, samples, giveaways, first-order discounts) ÷ new customers in that time.', placeholder: 'marketing spend ÷ new customers' },
  { id: 'buysPerYear', label: 'How many times a customer buys from you per year', num: true, how: 'Look up a few regular customers in your order history and count their purchases in the last year.', placeholder: 'e.g. 3' },
  { id: 'years', label: 'How many years a customer usually stays', num: true, how: 'How long your regulars have been buying from you; use 1 if most buy once.', placeholder: 'e.g. 2' },
  { id: 'ltv', label: 'What a typical customer spends with you over time (lifetime value, $)', num: true, how: 'Average sale × purchases a year × years they stay.', placeholder: 'leave blank and the app works it out' },
];
export const PROFILE_LABELS = Object.fromEntries(PROFILE_FIELDS.filter(f => f.id).map(f => [f.id, f.label]));
const profileHow = id => PROFILE_FIELDS.find(f => f.id === id)?.how;

// Offer costs: one row per product/service the owner might promote (max 2).
export const MAX_ITEMS = 2;
export const ITEM_FIELDS = [
  { id: 'name', label: 'Product or service', placeholder: 'e.g. Holiday gift box', key: true },
  { id: 'kind', label: 'Type', type: 'select', options: ['Product', 'Service'] },
  { id: 'price', label: 'What you charge ($)', num: true, key: true, hint: { Product: 'Per item, dozen, box or bundle?', Service: 'Per hour, visit, project or package?' } },
  { id: 'unit', label: 'Per…', placeholder: 'e.g. box of 12, 1-hour session' },
  { id: 'materials', label: 'Materials per sale ($)', num: true, hint: { Product: 'Ingredients, components, purchased stock', Service: 'Consumables, supplies, customer materials' } },
  { id: 'hours', label: 'Labor per sale (hours)', num: true, hint: { Product: 'Preparation, production, decorating, packing', Service: 'Consultation, prep, travel, delivery, follow-up' } },
  { id: 'other', label: 'Other costs per sale ($)', num: true, hint: { Product: 'Packaging, shipping, delivery, transaction fees', Service: 'Mileage, parking, rental, booking and transaction fees' } },
  { id: 'loss', label: 'Losses / extra work (% of costs)', num: true, hint: { Product: 'Waste, spoilage, returns, remakes', Service: 'Cancellations, no-shows, revisions, repeat visits' } },
  { id: 'seasonal', label: 'Extra cost for the campaign version ($)', num: true, hint: { Product: 'Special materials, designs, gift wrapping', Service: 'Longer appointments, peak staffing, travel, extra inclusions' } },
];

// type: text (default) | textarea | select | checks; num: parsed as a number for the math.
export const BRAIN_SECTIONS = [
  {
    id: 'basics', title: 'Business basics', required: true,
    questions: [
      { id: 'name', profile: 'name', label: 'Business name', placeholder: 'e.g. Juniper & Wick Candle Co.', key: true },
      { id: 'location', profile: 'location', label: 'Location and service area', placeholder: 'e.g. Austin, TX — ships nationwide' },
      { id: 'mix', label: 'Do you sell products, services, or both?', type: 'select', options: ['Products', 'Services', 'Both'], key: true },
      { id: 'sells', profile: 'sells', label: 'What you sell, and what makes customers choose you', type: 'textarea' },
      { id: 'flow', label: 'How customers order, book, pay and receive their purchase', type: 'textarea', placeholder: 'e.g. Order on Etsy or DM, pay by card, local pickup Saturdays or USPS' },
      { id: 'where', label: 'Where you operate', type: 'checks', options: ['Home', 'Storefront', 'Online', 'At customers’ locations'] },
    ],
  },
  {
    id: 'customers', title: 'Customers and evidence',
    questions: [
      { id: 'customers', profile: 'customers', label: 'Who buys from you now?', type: 'textarea' },
      { id: 'reach', label: 'Who would you like to reach this campaign?', type: 'textarea' },
      { id: 'need', label: 'What occasion, problem or need brings them to you?', type: 'textarea' },
      { id: 'objections', label: 'Questions or objections customers commonly raise', type: 'textarea' },
      { id: 'proof', profile: 'proof', label: 'Proof we can use: real reviews, feedback, photos, qualifications, past results', type: 'textarea', placeholder: 'Only real ones — Devin will never invent testimonials' },
      { id: 'avoidClaims', label: 'Claims to avoid or verify first', type: 'textarea' },
    ],
  },
  {
    id: 'costs', title: 'Prices and costs', required: true, items: true,
    blurb: 'Fill this in for one or two products or services you’d promote this campaign — not your whole catalog.',
    questions: [
      { id: 'rate', profile: 'rate', label: 'Hourly labor cost ($/hour) — your own pay allowance, or blended with staff', num: true, how: profileHow('rate'), key: true, placeholder: 'e.g. 25' },
      { id: 'hoursWeek', profile: 'hoursWeek', label: 'Hours you work in the business each week', num: true, how: profileHow('hoursWeek') },
      { id: 'payGoal', profile: 'payGoal', label: 'What you want to take home from the business per year ($)', num: true, how: profileHow('payGoal') },
      { id: 'replaceRate', profile: 'replaceRate', label: 'What you’d pay someone else to do your work ($/hour)', num: true, how: profileHow('replaceRate') },
      { id: 'batch', label: 'For batches: what a whole batch costs, how long it takes, and how many sellable units it makes', type: 'textarea' },
      { id: 'package', label: 'For packages: what exactly is included, and where an extra charge begins', type: 'textarea' },
      { id: 'mixed', label: 'For mixed businesses: product and service costs, separately', type: 'textarea' },
    ],
  },
  {
    id: 'expenses', title: 'Operating expenses and owner earnings',
    questions: [
      { id: 'recurring', label: 'Recurring expenses that keep the business running (rent, insurance, software, utilities, equipment, marketing, admin)', type: 'textarea' },
      { id: 'overhead', profile: 'overhead', label: 'Those recurring expenses, per month ($)', num: true, how: profileHow('overhead') },
      { id: 'revenueMonth', profile: 'revenueMonth', label: 'Sales in a typical month ($)', num: true, how: profileHow('revenueMonth') },
      { id: 'laborMonth', profile: 'laborMonth', label: 'Staff and contractor pay per month, not your own ($)', num: true, how: profileHow('laborMonth') },
      { id: 'materialsMonth', profile: 'materialsMonth', label: 'Materials, stock and supplies per month ($)', num: true, how: profileHow('materialsMonth') },
      { id: 'overheadIncluded', label: 'Are those already counted in your per-sale costs above?', type: 'select', options: ['No', 'Partly', 'Yes'] },
      { id: 'coverSales', label: 'How many sales or billable hours normally cover those expenses?' },
      { id: 'campaignCosts', label: 'Extra costs this campaign creates (samples, ads, seasonal help, photography, subscriptions)', type: 'textarea' },
      { id: 'campaignSpend', label: 'Those campaign costs, total ($)', num: true },
      { id: 'profitTarget', label: 'Profit that would make the campaign worthwhile, after paying your labor ($)', num: true },
    ],
  },
  {
    id: 'capacity', title: 'Capacity and cash', required: true,
    questions: [
      { id: 'weekly', label: 'Items, appointments or projects you can realistically fulfill per week', num: true, key: true },
      { id: 'committed', label: 'How many of those are already committed to regular customers?', num: true },
      { id: 'limits', label: 'What limits you most?', type: 'checks', options: ['Time', 'Equipment', 'Stock', 'Staffing', 'Storage', 'Delivery'] },
      { id: 'orders', label: 'Order sizes, lead times and fulfillment dates you can support', type: 'textarea' },
      { id: 'upfront', label: 'How much you can spend upfront before customers pay ($)', num: true },
      { id: 'deposits', label: 'Can you take deposits? When are supplier and staff payments due?', type: 'textarea' },
      { id: 'buffer', label: 'Room needed for cancellations, delays or remakes', type: 'textarea' },
    ],
  },
  {
    id: 'goals', title: 'Campaign goals and boundaries', required: true,
    questions: [
      { id: 'occasions', label: 'Which holidays or occasions you want to serve' },
      { id: 'dates', label: 'Promotion dates, ordering deadlines and fulfillment dates', type: 'textarea', key: true },
      { id: 'weeks', label: 'How many weeks the campaign runs', num: true },
      { id: 'priority', label: 'Your priority', type: 'select', options: ['Profit', 'Revenue', 'New customers', 'Repeat purchases', 'Filling quiet periods'], key: true },
      { id: 'goal', label: 'A numerical goal you’d like to reach', placeholder: 'e.g. 40 orders and $4,000 by Dec 24' },
      { id: 'promote', label: 'Products/services to promote — or avoid', type: 'textarea' },
      { id: 'discount', label: 'Largest discount you’d accept (%)', num: true, placeholder: '0 if no discounts' },
      { id: 'minEarn', label: 'Minimum earnings per sale that must remain ($)', num: true },
      { id: 'bonuses', label: 'Bonuses you could offer, and what they cost in time and money', type: 'textarea' },
      { id: 'policies', label: 'Cancellation, refund, rescheduling and guarantee terms you can actually support', type: 'textarea' },
    ],
  },
  {
    id: 'marketing', title: 'Marketing resources and voice',
    questions: [
      { id: 'channels', label: 'Channels you already use, and where inquiries actually come from', type: 'textarea' },
      { id: 'website', profile: 'website', label: 'Website', placeholder: 'https://…' },
      { id: 'socials', profile: 'socials', label: 'Social accounts, business listings, opted-in email list' },
      { id: 'budget', label: 'Marketing budget and weekly time you can commit' },
      { id: 'newMonth', profile: 'newMonth', label: 'New customers in a typical month', num: true, how: profileHow('newMonth') },
      { id: 'cac', profile: 'cac', label: 'What it costs you to win one new customer today (CAC, $)', num: true, how: profileHow('cac'), placeholder: 'ad spend ÷ new customers, if you know it' },
      { id: 'buysPerYear', profile: 'buysPerYear', label: 'How many times a customer buys from you per year', num: true, how: profileHow('buysPerYear') },
      { id: 'years', profile: 'years', label: 'How many years a customer usually stays', num: true, how: profileHow('years') },
      { id: 'ltv', profile: 'ltv', label: 'What a typical customer spends with you over time (lifetime value, $)', num: true, how: profileHow('ltv'), placeholder: 'leave blank and the app works it out' },
      { id: 'assets', label: 'Photos, footage, logo, testimonials or previous content you have', type: 'textarea' },
      { id: 'voice', label: 'How the business should sound — and words or promises to avoid', type: 'textarea' },
      { id: 'camera', label: 'Comfortable on camera, with an avatar, or recording your voice?', type: 'checks', options: ['On camera', 'Avatar', 'Voice only', 'None of these'] },
    ],
  },
  {
    id: 'leads', title: 'Leads and follow-up',
    questions: [
      { id: 'inbox', label: 'Where campaign inquiries should go', type: 'checks', options: ['Form', 'Instagram', 'WhatsApp', 'Email', 'Phone', 'Booking page'] },
      { id: 'quoteInfo', label: 'Information you need before quoting or confirming an order', type: 'textarea' },
      { id: 'tracking', label: 'How you track inquiries, deposits, bookings and completed sales now', type: 'textarea' },
      { id: 'response', label: 'How quickly you can realistically respond' },
      { id: 'automate', label: 'The repetitive task that would help most to automate' },
      { id: 'tools', label: 'Accounts/tools you already have, and an acceptable subscription budget', type: 'textarea' },
    ],
  },
];

// Steps that read the Brain (drives the Builds-on link and "changed, rewrite" notices) and
// which sections feed each — the graph draws these links.
export const BRAIN_FEEDS = {
  offer: ['costs', 'goals', 'customers', 'capacity'],
  research: ['customers'],
  strategy: ['goals', 'marketing', 'capacity', 'expenses'],
  content: ['marketing', 'customers'],
  calendar: ['goals', 'capacity'],
  visibility: ['basics', 'marketing'],
  automation: ['leads', 'capacity'],
  'action-plan': ['goals', 'expenses'],
};

export const num = v => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const blank = v => v == null || (Array.isArray(v) ? !v.length : !String(v).trim());

// The stored { v, s } for a question, with profile-backed values read from the profile.
// A profile field never set falls back to an older Brain answer (rate, cac, ltv used to live there).
export function answerOf(brain, profile, q) {
  const a = brain?.answers?.[q.id] || {};
  return q.profile ? { ...a, v: profile?.[q.profile] ?? a.v ?? '' } : a;
}
const SHARED = BRAIN_SECTIONS.flatMap(s => s.questions).filter(q => q.profile);
export function profileWithBrain(profile, brain) {
  const out = { ...(profile || {}) };
  for (const q of SHARED) if (out[q.profile] === undefined && !blank(brain?.answers?.[q.id]?.v)) out[q.profile] = brain.answers[q.id].v;
  return out;
}
export const isAnswered = a => !!a && (!blank(a.v) || a.s === 'help');

export function sectionProgress(brain, profile, section) {
  const qs = section.questions.map(q => answerOf(brain, profile, q));
  const items = section.items ? (brain?.items || []).flatMap(it => ITEM_FIELDS.map(f => it?.[f.id])) : [];
  const all = [...qs, ...items];
  const keyQs = section.questions.filter(q => q.key).map(q => answerOf(brain, profile, q));
  const keyItem = section.items ? [(brain?.items || [])[0]?.price] : [];
  return {
    answered: all.filter(isAnswered).length,
    total: section.questions.length + (section.items ? Math.max(1, (brain?.items || []).length) * ITEM_FIELDS.length : 0),
    ready: [...keyQs, ...keyItem].every(isAnswered),
  };
}
// Basics → Offer costs → Capacity and goals is the required first pass.
export const brainReady = (brain, profile) => BRAIN_SECTIONS.filter(s => s.required).every(s => sectionProgress(brain, profile, s).ready);

// Saved Brains come from the browser: keep only known questions/fields, string values and known tags.
const TAG_IDS = Object.keys(TAGS);
const QIDS = new Set(BRAIN_SECTIONS.flatMap(s => s.questions.map(q => q.id)));
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
function cleanAnswer(raw) {
  const a = obj(raw);
  if (!a) return null;
  const v = Array.isArray(a.v) ? a.v.filter(x => typeof x === 'string').slice(0, 20).map(x => x.slice(0, 200))
    : typeof a.v === 'number' && Number.isFinite(a.v) ? String(a.v)
    : typeof a.v === 'string' ? a.v.slice(0, 4000) : '';
  const s = TAG_IDS.includes(a.s) ? a.s : '';
  if (blank(v) && !s) return null;
  return s ? { v, s } : { v };
}
export function cleanBrain(raw) {
  const b = obj(raw) || {};
  const answers = {};
  for (const [k, a] of Object.entries(obj(b.answers) || {})) if (QIDS.has(k)) { const c = cleanAnswer(a); if (c) answers[k] = c; }
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20)
    .map(it => Object.fromEntries(ITEM_FIELDS.map(f => [f.id, cleanAnswer(obj(it)?.[f.id])]).filter(([, a]) => a)))
    .filter(it => Object.keys(it).length).slice(0, MAX_ITEMS);
  return { answers, items };
}

const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// Deterministic numbers the app shows and hands to Devin, so it never has to guess them.
const QBY = Object.fromEntries(BRAIN_SECTIONS.flatMap(s => s.questions).map(q => [q.id, q]));
const WORK_WEEKS = 48; // a year with ~4 weeks off

const PROFILE_NUMS = new Map(PROFILE_FIELDS.filter(f => f.id && f.num).map(f => [f.id, f]));
// "Sales ($)" only makes sense under its heading, so prompts get "Running costs in a typical month — Sales ($)".
const PROFILE_FULL = {};
{ let h = null; for (const f of PROFILE_FIELDS) { if (f.heading) h = f.heading; else PROFILE_FULL[f.id] = h ? `${h} — ${f.label}` : f.label; } }
const ANSWER_IDS = new Set([...Object.keys(QBY), ...PROFILE_NUMS.keys()]);

export function answersFromDevin(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const answers = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!ANSWER_IDS.has(id) || Object.keys(answers).length >= 60) continue;
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) continue;
    const v = String(value).trim().slice(0, 200);
    if (v) answers[id] = v;
  }
  return Object.keys(answers).length ? answers : null;
}

export function mergeDevinAnswers(profile, brain, answers) {
  const nextProfile = { ...(profile || {}) };
  const nextBrain = { ...(brain || {}), answers: { ...(brain?.answers || {}) } };
  const changed = [];
  for (const [id, v] of Object.entries(answers || {})) {
    const q = QBY[id];
    const pkey = q?.profile ?? PROFILE_NUMS.get(id)?.id;
    if (!q && !pkey) continue;
    const current = q ? answerOf(brain, profile, q) : { v: profile?.[pkey] };
    if (!blank(current.v) && current.s !== 'help') continue;
    if (pkey) nextProfile[pkey] = v;
    else nextBrain.answers[id] = { ...(nextBrain.answers[id] || {}), v };
    if (q) nextBrain.answers[id] = { ...(nextBrain.answers[id] || {}), s: 'estimate' };
    changed.push(id);
  }
  return { profile: nextProfile, brain: nextBrain, changed };
}

export function helpPrompt(profile, brain, ids) {
  const promptIds = [...new Set((Array.isArray(ids) ? ids : []).filter(id => ANSWER_IDS.has(id)))];
  const getAnswer = id => {
    const q = QBY[id];
    return q ? answerOf(brain, profile, q) : { v: profile?.[id] };
  };
  const numberLines = promptIds.map(id => {
    const q = QBY[id];
    const field = PROFILE_NUMS.get(id);
    const answer = getAnswer(id);
    const value = blank(answer.v) ? (answer.s === 'help' ? 'not sure' : 'blank')
      : answer.s === 'help' ? `not sure (I put ${answer.v})` : String(answer.v);
    return `- ${id} — ${field ? PROFILE_FULL[id] : q?.label} — ${field?.how || q?.how || 'ask me'} — ${value}`;
  });
  const filled = [];
  if (!promptIds.includes('price') && !blank(profile?.price)) filled.push(`- Average sale: ${profile.price}`);
  for (const field of PROFILE_FIELDS.filter(f => f.id && f.num && !promptIds.includes(f.id))) {
    const answer = getAnswer(field.id);
    if (!blank(answer.v)) filled.push(`- ${PROFILE_FULL[field.id]}: ${answer.v}`);
  }
  return `Help me work out some numbers for my business — I don’t know them yet. Walk me through them one at a time, like a patient bookkeeper:
- Ask at most 2 simple questions per number, about things I’m likely to know (last month’s spend, roughly how many customers), and tell me where to look (bank statement, Etsy/Square/Shopify reports, invoices, my calendar).
- Do the math for me and show it in one line, e.g. “$300 ads ÷ 12 new customers = $25 per customer”.
- If I can’t find a figure, help me make a reasonable estimate from what I do know, and call it an estimate. Mention a typical range for businesses like mine only if you say where it comes from, and only as a starting point I agree to.
- Confirm each number with me before moving to the next.
- As soon as I confirm a number, add it to the structured output as answers.json: {"<id>": "<value>"} using the ids below (just the number — no $ or units). Never fill in a number I haven’t confirmed.
When we’re done, sum up the numbers in 3 lines and say which are estimates.

The numbers to work out (id — question — how to work it out — what I have now):
${numberLines.join('\n')}
${filled.length ? `\nAlready filled in (use these in the math):\n${filled.join('\n')}` : ''}`;
}

export function brainMath(raw, profile) {
  const brain = cleanBrain(raw);
  const A = id => num(QBY[id] ? answerOf(brain, profile, QBY[id]).v : brain?.answers?.[id]?.v);
  const rate = A('rate');
  const discount = Math.min(Math.max(A('discount') ?? 0, 0), 100);
  const weeks = A('weeks');
  const overhead = A('overhead');
  const included = brain?.answers?.overheadIncluded?.v || '';
  // Unknown campaign length with real overhead = unknown fixed costs, not $0.
  const overheadShare = !overhead || included === 'Yes' ? 0 : weeks == null ? null : overhead * (weeks / (52 / 12));
  const campaignSpend = A('campaignSpend') ?? 0;
  const fixed = overheadShare == null ? null : overheadShare + campaignSpend;
  const profitTarget = A('profitTarget') ?? 0;
  const free = A('weekly') != null ? Math.max(0, A('weekly') - (A('committed') ?? 0)) : null;
  const capacity = free != null && weeks != null ? free * weeks : null;
  const minEarn = A('minEarn');
  const missing = [];
  if (rate == null) missing.push('Hourly labor cost');
  if (weeks == null) missing.push('Campaign length in weeks');
  if (A('weekly') == null) missing.push('Weekly capacity');
  if (overhead == null) missing.push('Monthly recurring expenses');
  if (included === 'Partly') missing.push('Which recurring expenses are already in per-sale costs (answered “Partly”)');

  const cac = A('cac');
  const items = (brain?.items || []).filter(it => num(it?.price?.v) != null).map(it => {
    const f = id => num(it?.[id]?.v) ?? 0;
    const price = f('price');
    const purchases = f('materials') + f('other') + f('seasonal');
    const losses = purchases * Math.min(Math.max(f('loss'), 0), 100) / 100;
    const labor = f('hours') * (rate ?? 0);
    const at = p => {
      const cashLeft = p - purchases - losses;
      return { price: round(p), cashLeft: round(cashLeft), earnings: round(cashLeft - labor) };
    };
    const full = at(price), disc = discount ? at(price * (1 - discount / 100)) : null;
    const per = (disc || full).earnings;
    // Blank costs aren't $0: earnings become an upper bound and the sales counts are withheld.
    const gaps = ITEM_FIELDS.filter(x => ['materials', 'hours', 'other'].includes(x.id) && num(it?.[x.id]?.v) == null).map(x => x.label);
    if (f('hours') > 0 && rate == null) gaps.push('Hourly labor cost');
    const need = goal => (per > 0 && goal != null && !gaps.length ? Math.ceil(goal / per) : null);
    const breakEven = need(fixed), forTarget = need(fixed == null ? null : fixed + profitTarget);
    const hoursFor = n => (n == null ? null : round(n * f('hours'), 1));
    const estimated = ITEM_FIELDS.filter(x => it?.[x.id]?.s && it[x.id].s !== 'known').map(x => x.label);
    return {
      name: it?.name?.v || 'Unnamed', unit: it?.unit?.v || '', purchases: round(purchases), losses: round(losses), labor: round(labor),
      ...full, discounted: disc, breakEven, forTarget,
      hoursBreakEven: hoursFor(breakEven), hoursTarget: hoursFor(forTarget),
      fits: capacity != null && forTarget != null ? forTarget <= capacity : null,
      cashForTarget: forTarget != null ? round(forTarget * (purchases + losses)) : null,
      belowMin: minEarn != null && per < minEarn,
      firstSale: cac != null ? round(per - cac) : null,
      firstSaleLoses: cac != null && per - cac <= 0,
      notProfitable: per <= 0,
      estimated, gaps,
    };
  });
  for (const it of items) if (it.gaps.length) missing.push(`${it.name}: ${it.gaps.join(', ')}`);
  if (!items.length) missing.push('Price and costs for at least one product or service');
  // Time: the pay goal as an hourly rate, and what a typical month actually pays per hour worked.
  const hoursWeek = A('hoursWeek'), payGoal = A('payGoal');
  const goalRate = payGoal != null && hoursWeek ? round(payGoal / (hoursWeek * WORK_WEEKS)) : null;
  const monthParts = [A('laborMonth'), A('materialsMonth'), overhead];
  const monthCosts = monthParts.some(x => x == null) ? null : round(monthParts.reduce((t, x) => t + x, 0));
  const revenueMonth = A('revenueMonth');
  const monthLeft = revenueMonth != null && monthCosts != null ? round(revenueMonth - monthCosts) : null;
  const earnedRate = monthLeft != null && hoursWeek ? round(monthLeft / (hoursWeek * 52 / 12)) : null;
  const monthForGoal = monthCosts != null && payGoal != null ? round(monthCosts + payGoal / 12) : null;
  // Lifetime value: the owner's figure, else average sale × purchases a year × years.
  const avgSale = num(profile?.price), buys = A('buysPerYear'), years = A('years');
  const ltvCalc = avgSale != null && buys != null && years != null ? round(avgSale * buys * years) : null;
  const ltv = A('ltv') ?? ltvCalc;
  return {
    rate, discount, weeks, overheadShare: round(overheadShare), campaignSpend: round(campaignSpend), fixed: round(fixed), profitTarget,
    free, capacity, upfront: A('upfront'), minEarn, items,
    hoursWeek, payGoal, goalRate, replaceRate: A('replaceRate'),
    revenueMonth, monthCosts, monthLeft, earnedRate, monthForGoal, newMonth: A('newMonth'),
    ltvCac: ltv != null && cac ? round(ltv / cac, 1) : null, ltv, ltvCalculated: A('ltv') == null && ltvCalc != null, cac,
    missing,
  };
}

export function growthTargets(raw, profile) {
  const cleaned = cleanBrain(raw);
  const math = brainMath(cleaned, profile);
  const item = math.items.find(candidate => !candidate.gaps.length && !candidate.notProfitable) || null;
  const perSale = item ? (item.discounted?.earnings ?? item.earnings) : null;
  const maxCac = math.ltv != null ? round(math.ltv / 3) : perSale > 0 ? perSale : null;
  const campaignSpend = num(answerOf(cleaned, profile, QBY.campaignSpend).v);
  const missing = [...math.missing];
  if (math.ltv == null && !(perSale > 0)) missing.push('Lifetime value or profitable per-sale earnings');
  if (campaignSpend == null) missing.push('Sprint budget');
  return {
    item: item?.name || null,
    breakEven: item?.breakEven ?? null,
    forTarget: item?.forTarget ?? null,
    maxCac,
    maxCacBasis: math.ltv != null ? 'ltv' : perSale > 0 ? 'first-sale' : null,
    budget: campaignSpend,
    missing: [...new Set(missing)],
  };
}

const money = n => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const show = v => (Array.isArray(v) ? v.join(', ') : String(v ?? '').trim());
const tagOf = a => (a?.s ? ` [${a.s}]` : '');

// The Brain as Devin reads it: every answer with its tag, then the app's numbers.
export function brainContext(raw, profile) {
  const brain = cleanBrain(raw);
  const hasAny = BRAIN_SECTIONS.some(s => s.questions.some(q => (q.profile ? q.num && isAnswered(answerOf(brain, profile, q)) : isAnswered(brain?.answers?.[q.id])))) || (brain?.items || []).length;
  if (!hasAny) return '';
  const out = ['## Business Brain',
    'The owner’s own answers. Tags: [known] = confirmed fact; [estimate] = the owner’s estimate — say “estimated” whenever you rely on it; [help] = the owner doesn’t know — work it out with them, never present it as fact. Unanswered questions are missing, not zero.'];
  for (const s of BRAIN_SECTIONS) {
    const lines = s.questions.map(q => { const a = answerOf(brain, profile, q); return isAnswered(a) ? `- ${q.label}: ${show(a.v) || '(unknown)'}${tagOf(a)}` : null; }).filter(Boolean);
    if (s.items) (brain?.items || []).forEach((it, i) => {
      const parts = ITEM_FIELDS.filter(f => isAnswered(it?.[f.id])).map(f => `${f.label}: ${show(it[f.id].v) || '(unknown)'}${tagOf(it[f.id])}`);
      if (parts.length) lines.push(`- Offer item ${i + 1}: ${parts.join('; ')}`);
    });
    if (lines.length) out.push(`### ${s.title}`, ...lines);
  }
  const m = brainMath(brain, profile);
  const calc = ['### App-calculated numbers (use these; don’t recompute them differently)'];
  if (m.rate != null) calc.push(`- Labor is costed at ${money(m.rate)}/hour.`);
  if (m.goalRate != null) calc.push(`- The owner’s pay goal (${money(m.payGoal)}/year at ${m.hoursWeek} h/week, ${WORK_WEEKS} weeks) works out to ${money(m.goalRate)}/hour${m.rate != null && m.rate < m.goalRate ? ` — more than the ${money(m.rate)}/hour labor allowance, so offers priced on that allowance won’t reach the goal` : ''}.`);
  if (m.monthLeft != null) calc.push(`- A typical month: ${money(m.revenueMonth)} sales − ${money(m.monthCosts)} running costs (staff, materials, other) = ${money(m.monthLeft)} left for the owner${m.earnedRate != null ? `, about ${money(m.earnedRate)}/hour for the hours worked` : ''}${m.monthForGoal != null ? `. Monthly break-even is ${money(m.monthCosts)} in sales; ${money(m.monthForGoal)} also pays the owner’s goal` : ''} (at today’s cost level).`);
  else if (m.monthCosts != null) calc.push(`- Running costs: ${money(m.monthCosts)} a month — the monthly break-even before the owner’s pay.`);
  calc.push(m.fixed == null
    ? `- Fixed costs to recover this campaign: UNKNOWN — monthly overhead is entered but the campaign length isn’t, so break-even can’t be calculated yet (plus ${money(m.campaignSpend)} campaign costs).`
    : `- Fixed costs to recover this campaign: ${money(m.fixed)} (${money(m.overheadShare)} share of overhead + ${money(m.campaignSpend)} campaign costs).`);
  if (m.capacity != null) calc.push(`- Free capacity: ${m.free}/week × ${m.weeks} weeks = ${m.capacity} sales/appointments.`);
  for (const it of m.items) {
    calc.push(`- ${it.name}${it.unit ? ` (per ${it.unit})` : ''}: price ${money(it.price)}; cash left after purchases ${money(it.cashLeft)}; labor allowance ${money(it.labor)}; earnings after labor ${money(it.earnings)}.`
      + (it.discounted ? ` At the max ${m.discount}% discount: price ${money(it.discounted.price)}, earnings after labor ${money(it.discounted.earnings)}.` : '')
      + (it.gaps.length ? ` INCOMPLETE — blank: ${it.gaps.join(', ')}. The earnings above count those as $0, so they are an upper bound; don’t call this offer profitable until they’re filled in.` : '')
      + (it.notProfitable ? ' NOT PROFITABLE at this price once labor is paid.' : ` Break-even: ${it.breakEven ?? 'not calculated yet'} sales; for the profit target: ${it.forTarget ?? 'not calculated yet'} sales${it.hoursTarget != null ? ` (${it.hoursTarget} labor hours)` : ''}${it.fits == null ? '' : it.fits ? ', fits capacity' : ', MORE THAN CAPACITY'}.`)
      + (it.belowMin ? ` Below the owner’s minimum earnings per sale (${money(m.minEarn)}).` : '')
      + (it.firstSale != null ? ` A first sale to a NEW customer, after the ${money(m.cac)} it costs to win them: ${money(it.firstSale)}${it.firstSaleLoses ? ' — LOSES MONEY; it only pays off through repeat purchases' : ''}.` : '')
      + (it.estimated.length ? ` Based on estimates for: ${it.estimated.join(', ')}.` : ''));
  }
  if (m.ltv != null || m.cac != null) calc.push(`- Lifetime value ${money(m.ltv)}${m.ltvCalculated ? ' (calculated: average sale × purchases a year × years)' : ''} vs. cost to win a customer (CAC) ${money(m.cac)}${m.ltvCac != null ? `: LTV:CAC = ${m.ltvCac}` : ''}. CAC is the everyday figure; if the campaign costs above already pay for the ads, don’t subtract both.`);
  if (m.missing.length) calc.push(`- Missing for a reliable profit estimate: ${m.missing.join('; ')}. Any offer is provisional until these are confirmed — say so.`);
  out.push(...calc);
  return out.join('\n');
}

// Lives outside STEPS (no step number, not in the progress count) but other steps can `use` it.
export const BRAIN_STEP = {
  id: 'brain', kind: 'brain', title: 'Business Brain', file: 'brain.md',
  blurb: 'The facts every step reads from: what you sell, what it really costs, how much you can handle and what you want out of this campaign.',
  guide: {
    time: '30–45 min',
    why: 'Offers, posts and calendars are only as good as the numbers under them. One confirmed Brain means every step uses the same prices, deadlines and capacity.',
    done: ['Basics, Prices and costs, Capacity and Campaign goals answered (the rest can wait)', 'Every number tagged Known, Estimate or Help me work this out', 'Devin’s review read, and the missing pieces it flags noted'],
    tips: ['Do the costs for one or two things you want to sell more of — not your whole catalog.', 'Not sure? Tag it “Help me work this out” and ask Devin in the chat.', 'Pay yourself: an hourly rate of $0 makes every offer look profitable.'],
  },
};

export const brainReviewPrompt = (brain, profile) => `Review my Business Brain. Here is the latest version, with the app-calculated numbers:

${brainContext(brain, profile) || '(It’s mostly empty — ask me the Basics, Prices and costs, Capacity and Campaign goals questions first, at most 5 at a time.)'}

Write brain.md, for a busy non-technical owner, with:
1. **Snapshot** — the business in 5 short lines.
2. **The numbers** — earnings per sale including a realistic labor allowance; a campaign profit estimate with overhead and campaign costs counted once (no double-counting); break-even sales and the workload they need, compared with my free capacity; the effect of discounts, bundles, bonuses, fees and guarantees. Use the app-calculated numbers above, and keep cash left after purchases, my pay, and profit as separate figures.
3. **Missing information and assumptions** that could change the recommendation, most important first, with which are estimates.
4. **Provisional offer direction** that fits my capacity, cash, dates and minimum earnings. If costs are incomplete, say exactly what must be confirmed before calling it profitable.
5. **Answer next** — the 3 questions I should answer to firm this up.

Don't promise profit or demand, and don't invent figures I didn't give. Return the document as brain.md in the structured output, then reply with a 3-line summary.`;
