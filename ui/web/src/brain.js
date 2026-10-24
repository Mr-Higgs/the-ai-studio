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
      { id: 'rate', label: 'Hourly labor cost ($/hour) — your own pay allowance, or blended with staff', num: true, key: true, placeholder: 'e.g. 25' },
      { id: 'batch', label: 'For batches: what a whole batch costs, how long it takes, and how many sellable units it makes', type: 'textarea' },
      { id: 'package', label: 'For packages: what exactly is included, and where an extra charge begins', type: 'textarea' },
      { id: 'mixed', label: 'For mixed businesses: product and service costs, separately', type: 'textarea' },
    ],
  },
  {
    id: 'expenses', title: 'Operating expenses and owner earnings',
    questions: [
      { id: 'recurring', label: 'Recurring expenses that keep the business running (rent, insurance, software, utilities, equipment, marketing, admin)', type: 'textarea' },
      { id: 'overhead', label: 'Those recurring expenses, per month ($)', num: true },
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
      { id: 'cac', label: 'What it costs you to win one new customer today (CAC, $)', num: true, placeholder: 'ad spend ÷ new customers, if you know it' },
      { id: 'ltv', label: 'What a typical customer spends with you over time (lifetime value, $)', num: true },
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
export function answerOf(brain, profile, q) {
  const a = brain?.answers?.[q.id] || {};
  return q.profile ? { ...a, v: profile?.[q.profile] ?? '' } : a;
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

const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// Deterministic numbers the app shows and hands to Devin, so it never has to guess them.
export function brainMath(brain) {
  const A = id => num(brain?.answers?.[id]?.v);
  const rate = A('rate');
  const discount = Math.min(Math.max(A('discount') ?? 0, 0), 100);
  const weeks = A('weeks');
  const overhead = A('overhead');
  const included = brain?.answers?.overheadIncluded?.v || '';
  const overheadShare = overhead != null && weeks != null && included !== 'Yes' ? overhead * (weeks / (52 / 12)) : 0;
  const campaignSpend = A('campaignSpend') ?? 0;
  const fixed = overheadShare + campaignSpend;
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
    const need = goal => (per > 0 ? Math.ceil(goal / per) : null);
    const breakEven = need(fixed), forTarget = need(fixed + profitTarget);
    const hoursFor = n => (n == null ? null : round(n * f('hours'), 1));
    const estimated = ITEM_FIELDS.filter(x => it?.[x.id]?.s && it[x.id].s !== 'known').map(x => x.label);
    return {
      name: it?.name?.v || 'Unnamed', unit: it?.unit?.v || '', purchases: round(purchases), losses: round(losses), labor: round(labor),
      ...full, discounted: disc, breakEven, forTarget,
      hoursBreakEven: hoursFor(breakEven), hoursTarget: hoursFor(forTarget),
      fits: capacity != null && forTarget != null ? forTarget <= capacity : null,
      cashForTarget: forTarget != null ? round(forTarget * (purchases + losses)) : null,
      belowMin: minEarn != null && per < minEarn,
      notProfitable: per <= 0,
      estimated,
    };
  });
  if (!items.length) missing.push('Price and costs for at least one product or service');
  const ltv = A('ltv'), cac = A('cac');
  return {
    rate, discount, weeks, overheadShare: round(overheadShare), campaignSpend: round(campaignSpend), fixed: round(fixed), profitTarget,
    free, capacity, upfront: A('upfront'), minEarn, items,
    ltvCac: ltv != null && cac ? round(ltv / cac, 1) : null, ltv, cac,
    missing,
  };
}

const money = n => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const show = v => (Array.isArray(v) ? v.join(', ') : String(v ?? '').trim());
const tagOf = a => (a?.s ? ` [${a.s}]` : '');

// The Brain as Devin reads it: every answer with its tag, then the app's numbers.
export function brainContext(brain, profile) {
  const hasAny = BRAIN_SECTIONS.some(s => s.questions.some(q => !q.profile && isAnswered(brain?.answers?.[q.id]))) || (brain?.items || []).length;
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
  const m = brainMath(brain);
  const calc = ['### App-calculated numbers (use these; don’t recompute them differently)'];
  if (m.rate != null) calc.push(`- Labor is costed at ${money(m.rate)}/hour.`);
  calc.push(`- Fixed costs to recover this campaign: ${money(m.fixed)} (${money(m.overheadShare)} share of overhead + ${money(m.campaignSpend)} campaign costs).`);
  if (m.capacity != null) calc.push(`- Free capacity: ${m.free}/week × ${m.weeks} weeks = ${m.capacity} sales/appointments.`);
  for (const it of m.items) {
    calc.push(`- ${it.name}${it.unit ? ` (per ${it.unit})` : ''}: price ${money(it.price)}; cash left after purchases ${money(it.cashLeft)}; labor allowance ${money(it.labor)}; earnings after labor ${money(it.earnings)}.`
      + (it.discounted ? ` At the max ${m.discount}% discount: price ${money(it.discounted.price)}, earnings after labor ${money(it.discounted.earnings)}.` : '')
      + (it.notProfitable ? ' NOT PROFITABLE at this price once labor is paid.' : ` Break-even: ${it.breakEven} sales; for the profit target: ${it.forTarget} sales (${it.hoursTarget ?? '?'} labor hours)${it.fits == null ? '' : it.fits ? ', fits capacity' : ', MORE THAN CAPACITY'}.`)
      + (it.belowMin ? ` Below the owner’s minimum earnings per sale (${money(m.minEarn)}).` : '')
      + (it.estimated.length ? ` Based on estimates for: ${it.estimated.join(', ')}.` : ''));
  }
  if (m.ltvCac != null) calc.push(`- Lifetime value ${money(m.ltv)} vs. acquisition cost ${money(m.cac)}: LTV:CAC = ${m.ltvCac}.`);
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
