export const INTAKE_FORM = 'rll-intake-v2';
export const SEND_TO = 'sam@patterned.work';
export const PREFILL_KEYS = ['name', 'biz', 'email', 'site']; // ?name=&biz=&email=&site= on the page URL

export const INTAKE_STEPS = [
  { id: 'intro', intro: true },
  { id: 'you', title: 'Quick confirm', sub: 'Fix anything that\'s off.', fields: [
    { k: 'name', label: 'Your name', t: 'text', req: 1 },
    { k: 'email', label: 'Best email', t: 'email', req: 1 },
    { k: 'biz', label: 'Business name', hint: 'Exactly how you spell it.', t: 'text', req: 1 },
    { k: 'orgs', label: 'Programs or organizations you\'re part of', hint: 'For example, Branches.', t: 'text', ph: 'Branches, chamber of commerce, etc.' },
  ] },
  { id: 'scope', title: 'What matters most?', sub: 'Based on our call, here\'s what we could build. Pick what you want in the first phase.', fields: [
    { k: 'modules', t: 'cards', opts: [
      ['website', 'Website', 'New site, revamp, or fixes'],
      ['aisearch', 'Getting found (Google + AI search)', 'Articles and setup so you show up when people search'],
      ['comms', 'Email and text follow-up', 'Welcome messages, reminders, event blasts'],
      ['ads', 'Ads', 'Facebook and Instagram'],
      ['events', 'Events', 'Hosting, promoting, recapping'],
      ['agent', 'AI assistant', 'Handles email, scheduling, reminders, lead replies'],
      ['booking', 'Booking, quotes and payments', 'Customers book or order online'],
      ['training', 'Training', 'So you can run it yourself'],
    ] },
    { k: 'top', label: 'If you could only do one, which?', t: 'chips', opts: ['Website', 'Getting found', 'Email and text', 'Ads', 'Events', 'AI assistant', 'Booking and payments', 'Training'] },
  ] },
  { id: 'budget', title: 'Budget', sub: 'This is the main thing we need. A range is perfect. It helps us design something that fits instead of guessing.', fields: [
    { k: 'b1', label: 'One-time budget to get set up', t: 'chips', opts: ['$750 to $1,500', '$1,500 to $2,500', '$2,500 to $3,500', '$3,500+', 'Not sure yet'] },
    { k: 'b2', label: 'Monthly budget for ongoing support (2 to 3 month retainer)', t: 'chips', opts: ['$500 to $750', '$750 to $1,000', '$1,000+', 'Not sure yet'] },
    { k: 'bmax', label: 'The most you\'d be comfortable spending in the first 3 months, all in', t: 'text', ph: 'e.g. $2,500' },
    { k: 'pay', label: 'How would you like to pay?', t: 'chips', opts: ['All upfront', 'Split into 2 or 3 installments'] },
    { k: 'urgency', label: 'How important is getting new clients before the end of the year?', t: 'scale', lo: 'Not important', hi: 'Very important' },
    { k: 'grant', label: 'If you received a grant or stipend for building, what is it for and how much do you have remaining?', hint: 'Leave blank if this doesn\'t apply.', t: 'area' },
  ] },
  { id: 'timing', title: 'Timing and decisions', sub: 'Almost done.', fields: [
    { k: 'when', label: 'When do you want to start?', t: 'chips', opts: ['This week', 'Within a month', '1 to 3 months', 'Not sure'] },
    { k: 'decider', label: 'Does anyone else need to approve this?', t: 'text', ph: 'Just me, or name someone' },
    { k: 'times', label: 'Best times for our next call', t: 'multi', opts: ['Mornings', 'Midday', 'Afternoons'] },
    { k: 'owner', label: 'Whose name are your website and domain accounts in?', t: 'chips', opts: ['Mine', 'Someone else\'s', 'Not sure'] },
    { k: 'more', label: 'Anything else we should know before we send your proposal?', t: 'area' },
  ], note: { warn: 1, text: 'Never send passwords. When we need access we\'ll ask you to invite us as a collaborator.' } },
];

export const INTAKE_FIELDS = INTAKE_STEPS.flatMap(s => (s.fields || []).map(f => ({ ...f, step: s.id })));

const str = v => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const strArr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

// Markdown rendering of one submission — shared by the page's fallback screen and the API row.
export function intakeSummary(answers, now = new Date()) {
  const A = answers && typeof answers === 'object' ? answers : {};
  const out = [`# Proposal intake: ${str(A.biz)}`, `*Submitted ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC*`, ''];
  INTAKE_STEPS.forEach(s => {
    if (!s.fields) return;
    const rows = [];
    s.fields.forEach(f => {
      if (f.k === 'modules') {
        const m = strArr(A.modules).map(id => f.opts.find(o => o[0] === id)?.[1] ?? id);
        if (m.length) rows.push(`- **Wants help with:** ${m.join(', ')}`);
        return;
      }
      const t = (Array.isArray(A[f.k]) ? strArr(A[f.k]).join(', ') : str(A[f.k])).trim();
      if (t && f.label) rows.push(`- **${f.label}:** ${t.replace(/\n+/g, '\n  ')}`);
    });
    if (rows.length) out.push(`## ${s.title}`, ...rows, '');
  });
  return out.join('\n');
}
