// ============================================================================
//  MOCK BACKEND for guide screenshots — NOT for production.
//  A plain node http server on 127.0.0.1:4322 that fakes BOTH Supabase Auth
//  (/auth/v1/*) and the Studio API (/api/*) so ui/web runs unchanged against it.
//
//  Run:  npm run dev:mock          (this file)
//        vite ui/web --mode mock   (vite proxies /api → 4322, env from .env.mock)
//
//  Stage control (so the same UI can be shot "brand new" or "finished"):
//    GET /mock/stage?done=profile,offer&brain=1&devin=1&heygen=1&chat=1&busy=0
//      done   comma list of step ids; docs/calendar/tracker/posts/experiments
//             only appear for steps in the list. `done=` alone = nothing done.
//             Absent `done` param = every step done.
//      brain  0 empty Business Brain · 1 filled Brain + Devin's review
//      devin  health devin.ok        heygen  health heygen.ok (+avatars)
//      chat   0 empty agent chat     busy   1 = poll reports Devin working
// ============================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const PORT = 4322;
const ROOT = path.resolve(import.meta.dirname, '..');
const USER = { id: 'mock-user-maria', email: 'maria@example.com', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString() };

// ---- stage -----------------------------------------------------------------
const ALL_STEPS = ['profile', 'offer', 'research', 'visibility', 'strategy', 'content', 'video', 'calendar', 'automation', 'tracker', 'action-plan'];
const stage = { done: new Set(ALL_STEPS), brain: 1, devin: 1, heygen: 1, chat: 1, busy: 0, site: null, google: null };

// ---- supabase auth ---------------------------------------------------------
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 * 24 * 365 * 10 })}.mocksignature`;
}
const session = () => ({
  access_token: jwt(), refresh_token: 'mock', token_type: 'bearer',
  expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  user: { ...USER },
});

// ---- demo business: Maple Street Auto Repair, Decatur GA, owner Maria ------
const DAY = 864e5;
const today = new Date();
const d = off => { const t = new Date(today.getTime() + off * DAY); return t.toISOString().slice(0, 10); };
const mt = off => Date.now() - off * 3600e3; // mtime N hours ago

const profile = {
  name: 'Maple Street Auto Repair',
  location: 'Decatur, GA — Oakhurst, Kirkwood, Avondale Estates',
  sells: 'General auto repair: brakes, oil and fluid service, diagnostics, suspension, A/C and pre-purchase inspections on cars and light trucks.',
  customers: 'Commuters and families within ~5 miles — people who want a straight answer, a fair price and their car back the same day.',
  price: '320', website: 'https://maplestreetauto.example.com', socials: '@maplestreetauto on Facebook and Instagram',
  proof: '4.9★ on Google from 214 reviews; voted "Best Mechanic" in Decaturish 2024 reader poll',
  hoursWeek: '50', payGoal: '75000', rate: '35', replaceRate: '28',
  revenueMonth: '38000', laborMonth: '9600', materialsMonth: '8500', overhead: '6200',
  newMonth: '45', cac: '18', buysPerYear: '3', years: '4', ltv: '',
};
const a = (v, s = 'known') => ({ v, s });
const brain = {
  answers: {
    mix: a('Services'),
    flow: a('Walk-in or call ahead, we diagnose and quote before any work, pay at pickup by card or cash.'),
    where: a(['Storefront'], 'known'),
    reach: a('Owners of 8–15 year old Hondas, Toyotas and Subarus in Oakhurst and Kirkwood who defer maintenance.', 'estimate'),
    need: a('Brake noise, check-engine lights, pre-road-trip inspections, and "is this car worth fixing" questions.'),
    objections: a('"Dealer said it needs more", fear of being oversold, and not knowing what a fair price is.'),
    avoidClaims: a('Never promise a fix time before diagnosis; no "cheapest in town" claims.'),
    rate: a('35'), hoursWeek: a('50'), payGoal: a('75000', 'estimate'), replaceRate: a('28', 'estimate'),
    overhead: a('6200', 'estimate'), revenueMonth: a('38000'), laborMonth: a('9600'), materialsMonth: a('8500', 'estimate'),
    overheadIncluded: a('No'), coverSales: a('About 60 repair orders a month covers it.', 'estimate'),
    campaignCosts: a('Local Facebook/Instagram ads, a postcard drop to Oakhurst, counter QR cards.', 'estimate'),
    campaignSpend: a('600', 'estimate'), profitTarget: a('5000', 'estimate'),
    weekly: a('25'), committed: a('18'), limits: a(['Time', 'Staffing']),
    orders: a('Most jobs same-day; big jobs 2–3 days. 4 bays, 2 techs plus Maria.'),
    upfront: a('1500', 'estimate'), deposits: a('We can take card deposits for parts over $400; suppliers are net-30.'),
    buffer: a('Keep one bay open for comebacks and emergencies.'),
    occasions: a('Pre-holiday road trips, back-to-school, first cold snap (batteries), spring pollen A/C season.'),
    dates: a(`Sprint runs ${d(0)} to ${d(30)}; push the brake special in weeks 1–2, reviews drive weeks 3–4.`),
    weeks: a('4'), priority: a('New customers'),
    goal: a('35 new customers and $11,000 in repair orders in 30 days', 'estimate'),
    promote: a('Brake jobs, diagnostics, pre-purchase inspections. Avoid transmission rebuilds — booked out already.'),
    discount: a('15'), minEarn: a('80', 'estimate'),
    bonuses: a('Free 24-point inspection with any brake job (costs ~20 min), free shuttle within 3 miles.'),
    policies: a('12-month/12,000-mile warranty on parts and labor; free re-check if the same symptom returns.'),
    channels: a('Google Business Profile, word of mouth, Nextdoor, some Facebook. Most new customers call after reading reviews.'),
    newMonth: a('45', 'estimate'), cac: a('18', 'estimate'), buysPerYear: a('3'), years: a('4', 'estimate'), ltv: a('', 'help'),
    budget: a('$600 for the sprint, ~4 hours a week of my time', 'estimate'),
    assets: a('Photos of the shop and bays, the 4.9★ Google reviews, a few customer thank-you texts.'),
    voice: a('Plain, honest, a little wry. No jargon, no scare tactics — we explain, they decide.'),
    camera: a(['Avatar']),
    inbox: a(['Form', 'Phone']), quoteInfo: a('Year/make/model, symptoms, when it started, any warning lights.'),
    tracking: a('Paper book at the counter and a note in the shop system — this sprint is the upgrade.'),
    response: a('Same business day, usually within the hour during the day.'),
    automate: a('Answering "how much is a brake job" and appointment reminders.'),
    tools: a('Google Business Profile, Facebook/Instagram pages, Square for payments.'),
  },
  items: [{
    name: a('Brake pad replacement'), kind: a('Service'), price: a('249'), unit: a('per axle, pads installed'),
    materials: a('85', 'estimate'), hours: a('1.5'), other: a('15', 'estimate'), loss: a('5', 'estimate'), seasonal: a('0'),
  }],
};

const tracker = [
  { id: 't1', name: 'Dana Whitfield', contact: 'dana.w@gmail.com', source: 'Website', stage: 'Lead', value: '', date: d(-1), notes: 'Came through the lead form asking about brake noise. Call today.', experiment: 'e2' },
  { id: 't2', name: 'Marcus Lee', contact: '404-555-0134', source: 'Phone call', stage: 'Contacted', value: '380', date: d(-2), notes: '2014 Camry, front brakes + rotors. Texted the quote.' },
  { id: 't3', name: 'Priya Nair', contact: 'priya.n@outlook.com', source: 'Google Search / Maps', stage: 'Quoted', value: '249', date: d(-3), notes: 'Brake special quote sent; deciding between us and the dealer.', experiment: 'e1' },
  { id: 't4', name: 'Tom Alvarez', contact: '404-555-0192', source: 'Referral / partners', stage: 'Won', value: '612', date: d(-5), notes: 'Referred by Oakhurst Coffee. Brakes + fluid flush, done Tuesday.' },
  { id: 't5', name: 'Grace Okoro', contact: 'grace.o@gmail.com', source: 'Nextdoor', stage: 'Won', value: '249', date: d(-6), notes: 'Saw the Nextdoor post. Brake pads on a 2016 CR-V.' , experiment: 'e3' },
  { id: 't6', name: 'Bill Ferren', contact: '404-555-0177', source: 'Yelp', stage: 'Lost', value: '450', date: d(-8), notes: 'Wanted same-hour timing belt job we could not fit. Follow up next month.' },
];

const experiments = [
  { id: 'e1', name: 'Brake special Facebook/IG push', hypothesis: 'A $249 brake special with a free inspection beats generic "we fix cars" posts for bookings.', channel: 'Facebook', cost: 150, spent: 90, metric: 'booked brake jobs', target: 8, maxCac: 60, rule: 'Kill if fewer than 3 booked jobs by day 14; scale budget to $40/wk if cost per booking stays under $60.', status: 'running', verdict: '', campaignId: null },
  { id: 'e2', name: 'Website lead form + counter QR', hypothesis: 'A "get a straight quote" form link on the site and a QR card at the counter captures walk-ins who leave without booking.', channel: 'Website', cost: 30, spent: 30, metric: 'form submissions', target: 10, maxCac: 25, rule: 'Keep if it produces 2+ real quotes a week; it costs nothing to leave up.', status: 'running', verdict: '' },
  { id: 'e3', name: 'Nextdoor neighbor offer', hypothesis: 'Neighbors trust Nextdoor recommendations; one helpful post + intro offer drives calls from Oakhurst/Kirkwood.', channel: 'Nextdoor', cost: 0, spent: 0, metric: 'calls mentioning Nextdoor', target: 6, maxCac: 40, rule: 'Stop posting if it reads as spammy or draws zero calls in 3 weeks.', status: 'running', verdict: '' },
  { id: 'e4', name: 'Review sprint at pickup', hypothesis: 'Asking every happy pickup for a Google review raises map ranking and calls within the sprint.', channel: 'Google Business Profile', cost: 50, spent: 20, metric: 'new reviews', target: 12, maxCac: null, rule: 'Keep — free. Adjust the ask script if review rate stays under 1 in 4 pickups.', status: 'running', verdict: '' },
];

const posts = [
  { id: 'facebook-1', channel: 'Facebook', phase: 'Week 1 · launch', title: 'The $249 brake special', hook: 'Hearing a squeal every time you slow down on Ponce?', body: 'That sound is your brake pads asking for help. This month at Maple Street Auto Repair, a full brake pad replacement is $249 per axle — parts and labor, with our 12-month/12,000-mile warranty and a free 24-point inspection while it is on the lift. No mystery fees: we quote before we touch a wrench.', cta: 'Call 404-555-0100 or use the form on our site to grab a spot this week.', hashtags: ['DecaturGA', 'AutoRepair', 'BrakeSpecial', 'MapleStreetAuto'] },
  { id: 'facebook-2', channel: 'Facebook', phase: 'Week 2 · proof', title: 'What a fair quote looks like', hook: 'Ever approve a repair and wonder what you actually paid for?', body: 'Every quote we write lists parts, labor hours and shop supplies on separate lines — and we text you photos of what we found before we fix it. Yesterday: a 2014 Camry that another shop quoted $1,100. It needed pads and rotors. $380, same day.', cta: 'Want a second opinion? Bring us the other quote — the look is free.', hashtags: ['HonestMechanic', 'DecaturGA', 'MapleStreetAuto'] },
  { id: 'facebook-3', channel: 'Facebook', phase: 'Week 3 · community', title: 'Meet Maria', hook: 'The hands under your hood this month belong to Maria.', body: 'Maria opened Maple Street Auto Repair nine years ago after a decade turning wrenches for someone else. Her rule has not changed: explain it like you would to your sister, charge what you would charge your sister. That is why 214 neighbors left 4.9 stars.', cta: 'Come say hi — 1234 Maple Street, Decatur. Coffee is on us.', hashtags: ['ShopLocal', 'DecaturGA', 'WomenInTrades'] },
  { id: 'instagram-1', channel: 'Instagram', phase: 'Week 1 · launch', title: 'Brake special reel', hook: 'That squeak is not going to fix itself.', body: 'Brake pads, installed, $249 this month — warranty included, inspection free. A quick word from the shop floor on what we check and why.', cta: 'DM us "BRAKES" or tap the link in bio to book.', hashtags: ['DecaturGA', 'CarTok', 'BrakeJob', 'MapleStreetAuto', 'AtlantaCars'], video: { project: 'brake-special', file: 'heygen-demo.mp4' } },
  { id: 'instagram-2', channel: 'Instagram', phase: 'Week 2 · behind the scenes', title: 'Bay 2, before and after', hook: 'Worn to the metal vs. done right.', body: 'Left: pads that came in grinding. Right: new pads, hardware and a road test. Two hours door to door. This is what "just in time" looks like.', cta: 'Save this for when your car starts singing.', hashtags: ['BeforeAndAfter', 'AutoRepair', 'DecaturGA', 'MapleStreetAuto'] },
  { id: 'instagram-3', channel: 'Instagram', phase: 'Week 4 · trust', title: 'Our warranty, in writing', hook: '12 months. 12,000 miles. In writing on every invoice.', body: 'If a part we installed fails, we replace it free — parts and labor. No fine print, no arguing. That is the whole warranty policy, and it is printed on your receipt.', cta: 'Questions? DM us — Maria answers.', hashtags: ['Warranty', 'HonestMechanic', 'DecaturGA'] },
];

const calendar = [
  { date: d(0), channel: 'Facebook', format: 'Post', title: 'Brake special launch', copy: posts[0].hook + '\n\n' + posts[0].body, cta: posts[0].cta, status: 'posted', experiment: 'e1' },
  { date: d(1), channel: 'Google Business Profile', format: 'Post', title: 'GBP: brake special', copy: 'Brake pad replacement is $249 per axle this month at Maple Street Auto Repair — parts, labor and a 12-month warranty included. Free 24-point inspection with every brake job.', cta: 'Call 404-555-0100 to book.', status: 'posted' },
  { date: d(2), channel: 'Instagram', format: 'Reel', title: 'Brake special reel', copy: posts[3].hook + '\n\n' + posts[3].body, cta: posts[3].cta, status: 'posted', video: { project: 'brake-special', file: 'heygen-demo.mp4' }, experiment: 'e1' },
  { date: d(4), channel: 'Nextdoor', format: 'Post', title: 'Neighbor intro offer', copy: 'Hi neighbors — Maria at Maple Street Auto Repair here. If your brakes have been making noise, we are running $249 pad replacement this month and we always quote before we wrench. Happy to look at another shop\'s estimate for free.', cta: 'Message us here or call 404-555-0100.', status: 'planned', experiment: 'e3' },
  { date: d(6), channel: 'Email / SMS list', format: 'Email', title: 'Launch email to past customers', copy: 'Subject: Squeaky brakes? $249 this month\n\nHi — quick note from Maria at Maple Street Auto. Brake pad replacement is $249 per axle through the end of the month, warranty included. Reply or call and we will get you on the lift.', cta: 'Reply to this email or call 404-555-0100.', status: 'planned' },
  { date: d(7), channel: 'Other', format: 'Other', title: 'Experiment review — week 1', copy: 'Check tracker: leads by source, spend on e1/e2, reviews asked vs. received. Kill anything flat, move budget to what produced calls.', cta: '', status: 'planned' },
  { date: d(8), channel: 'Facebook', format: 'Post', title: 'What a fair quote looks like', copy: posts[1].hook + '\n\n' + posts[1].body, cta: posts[1].cta, status: 'planned', experiment: 'e1' },
  { date: d(10), channel: 'Instagram', format: 'Post', title: 'Bay 2 before/after', copy: posts[4].hook + '\n\n' + posts[4].body, cta: posts[4].cta, status: 'planned' },
  { date: d(12), channel: 'Google Business Profile', format: 'Post', title: 'GBP: free second opinion', copy: 'Got a repair quote that feels high? Bring it to Maple Street Auto Repair — we will tell you what we would do and what it would cost. Free, no appointment needed.', cta: 'Stop by 1234 Maple Street, Decatur.', status: 'planned' },
  { date: d(14), channel: 'Other', format: 'Other', title: 'Experiment review — week 2', copy: 'Compare booked brake jobs vs. the e1 target of 8. If under 3, kill the ad push and move budget to Nextdoor.', cta: '', status: 'planned' },
  { date: d(16), channel: 'Facebook', format: 'Post', title: 'Meet Maria', copy: posts[2].hook + '\n\n' + posts[2].body, cta: posts[2].cta, status: 'planned' },
  { date: d(18), channel: 'Instagram', format: 'Post', title: 'Warranty in writing', copy: posts[5].hook + '\n\n' + posts[5].body, cta: posts[5].cta, status: 'planned' },
  { date: d(21), channel: 'Email / SMS list', format: 'Email', title: 'Last-chance email', copy: 'Subject: Last week for the $249 brake special\n\nThe brake special ends soon. If your pedal pulses or you hear a squeal, now is the week — $249 per axle, warranty included.', cta: 'Call 404-555-0100 today.', status: 'planned' },
  { date: d(28), channel: 'Other', format: 'Other', title: 'Sprint wrap — what worked', copy: 'Final review: new customers, revenue, cost per customer by experiment. Write down what to keep running next month.', cta: '', status: 'planned' },
];

const DOCS = {
offer: `# The Stop-Safe Special — Maple Street Auto Repair core offer

## Who this is for
Owners of 8–15 year old daily drivers in Oakhurst, Kirkwood and Avondale who hear
a squeal or feel a pulse and keep putting it off — worried about cost and about
being oversold. They want a straight price and the car back today.

## Three offer options

### Option A — The Stop-Safe Special (recommended)
- Brake pad replacement: **$249 per axle**, parts and labor
- Free 24-point inspection while the car is on the lift (worth ~20 min)
- 12-month / 12,000-mile warranty on parts and labor — in writing
- Same-day completion when booked before 10am
- Why it wins: answers the two fears (surprise cost, being oversold) with a fixed
  price and a written warranty; the inspection fills the other bays ethically.

### Option B — The Straight Quote
- Free second opinion on any written estimate
- Line-item quote: parts, labor hours, supplies — nothing hidden
- Photos of what we found, texted before any work starts
- Slower-burn offer; great trust builder, weaker urgency.

### Option C — Winter Ready Check
- $49 battery, brakes, tires and fluids check before the first cold snap
- Credited toward any repair over $200
- Seasonal; better as a follow-up campaign than the core offer.

## The pitch
"Brakes making noise? $249, fixed today, guaranteed in writing for a year."

## Call to action
Call 404-555-0100 or the form on the website. One CTA everywhere — the counter
QR card and the lead form both land in the tracker.
`,

research: `# Customer conversations — what Decatur drivers are already saying

## Where they talk
- **r/DecaturGA + r/Atlanta** — weekly "recommendation" threads; self-promo is
  tolerated only inside those threads and when asked directly.
- **Nextdoor (Oakhurst / Kirkwood)** — the single richest source; neighbors ask
  "honest mechanic?" monthly. Business posts allowed with disclosure.
- **Google reviews (ours and competitors')** — 214 reviews at 4.9★. Competitors'
  1–3★ reviews are a goldmine of complaints to answer.
- **Local Facebook groups (Decatur Moms, Avondale Estates)** — recommendations
  requested often; link-dropping by owners gets removed.

## In their words
- "I just want a mechanic who doesn't talk to me like I'm dumb."
- "Dealer quoted $1,100 — is that real?" (recurring; second-opinion hook)
- "Every place says same-day and keeps my car a week."
- Complaints at competitors: surprise fees, no call-backs, "fixed" brakes that
  still squealed — all answered by the warranty and the photo-quote habit.

## Questions that keep coming (each = a post or FAQ)
- "How much should brake pads cost?" → price-anchored post + reel
- "Is a pulsating pedal dangerous?" → short explainer post
- "Worth fixing a 12-year-old Honda?" → honest cost-of-ownership post

## Growth plays (community-legal)
1. Answer rec threads on Nextdoor as Maria, disclosing ownership.
2. Post the "$249 fixed price" in weekly promo threads only.
3. Turn the top 5 questions into Google Business Profile Q&A.
4. Ask every happy pickup for a review (script in automation.md).
5. Never: review incentives that violate Google policy, fake accounts, DMs.
`,

visibility: `# Get found locally — Maple Street Auto Repair

## Website audit (maplestreetauto.example.com)
- Home: H1 is "Welcome" — replace with **"Auto Repair in Decatur, GA | Maple Street Auto Repair"**.
- Phone number is an image — make it tap-to-call text in the header.
- No pricing anywhere — add the $249 brake special line above the fold.
- Services page lists 3 items — expand to the full list below.

## Google Business Profile
- Primary category: Auto repair shop. Secondary: Brake shop, Oil change service.
- Services to add: brake repair, diagnostics, oil change, suspension, A/C service,
  pre-purchase inspection — each with a one-line description.
- Photos: shoot bays, the sign, the team at work — 10 photos this week, 2/month after.
- Seed Q&A: "How much is a brake job?" → "$249 per axle installed, warranty included."
- 4 posts ready: launch special, second opinion, warranty, winter check.

## Search phrases → pages
- "brake repair decatur ga" → home · title: "Brake Repair Decatur GA — $249, Same Day | Maple Street Auto"
- "mechanic near me decatur" → home · description mentions 4.9★ / 214 reviews
- "pre purchase car inspection atlanta" → new services section
- "check engine light decatur" → diagnostics paragraph + CTA

## Listings consistency (NAP)
Same name, address, phone, hours on: Google, Apple Maps, Bing Places, Yelp,
Facebook, Nextdoor. Fix Yelp first — it still shows the old phone number.

## Reviews routine & the 3 numbers
Ask at pickup (script in automation.md). Weekly: GBP calls, direction requests,
website clicks — today’s baseline: 31 calls / 44 directions / 96 clicks last week.

## 30-day checklist
- Today: fix title tag, tap-to-call, add $249 line (30 min)
- This week: GBP services + 10 photos + seed 3 Q&As (2 h)
- This month: 4 GBP posts/week cadence from the content kit; recheck Yelp NAP.
`,

strategy: `# Strategy & messaging — 30-day growth sprint

## Focus (2–3 channels, not 8)
1. **Google Business Profile + reviews** — where ready-to-buy customers already look.
2. **Facebook + Instagram** — the $249 offer, proof posts, one reel.
3. **Nextdoor** — neighbor trust for Oakhurst/Kirkwood.
Ignoring for now: TikTok, paid search, direct mail beyond the one postcard drop.

## Campaign phases
- **Week 1 · launch:** brake special on every channel + launch email.
- **Weeks 2–3 · proof and run:** before/after photos, fair-quote story, review
  sprint at pickup; weekly experiment reviews on the calendar.
- **Week 4 · last chance:** last-call email, warranty post, wrap review.

## Core message
"Brakes making noise? $249, fixed today, guaranteed in writing for a year."
Supporting: line-item quotes with photos before we touch the car; 4.9★ from 214
neighbors; Maria explains, you decide — never upsold.

## Calls to action (one per place)
- Posts/ads: "Call 404-555-0100"
- Website/counter QR: the lead form link
- Email: "Reply or call — this week only"

## How a stranger becomes a customer
Sees post/review → checks our Google rating → calls or submits the lead form →
gets a line-item quote → approves → picks up → asked for a review at the counter.

## The 3 weekly numbers
GBP calls (baseline 31/wk) · booked brake jobs (target 8) · new reviews (target 12).

## Growth experiments
- **e1 · Brake special FB/IG push** — $150 planned; 8 booked jobs; kill under 3 by day 14.
- **e2 · Website lead form + counter QR** — $30; 10 submissions; nearly free to keep.
- **e3 · Nextdoor neighbor offer** — $0; 6 calls; stop if spammy or zero in 3 wks.
- **e4 · Review sprint at pickup** — $50; 12 new reviews; keep regardless.
`,

content: `# Content kit — Maple Street Auto Repair

## Facebook

### Post 1 (Week 1 · launch) — The $249 brake special
**Hook:** Hearing a squeal every time you slow down on Ponce?
**Body:** That sound is your brake pads asking for help. This month at Maple
Street Auto Repair, a full brake pad replacement is $249 per axle — parts and
labor, our 12-month/12,000-mile warranty, and a free 24-point inspection while
it is on the lift. No mystery fees: we quote before we touch a wrench.
**CTA:** Call 404-555-0100 or use the form on our site to grab a spot this week.
#DecaturGA #AutoRepair #BrakeSpecial #MapleStreetAuto

### Post 2 (Week 2 · proof) — What a fair quote looks like
**Hook:** Ever approve a repair and wonder what you actually paid for?
**Body:** Every quote we write lists parts, labor hours and supplies on separate
lines — and we text you photos of what we found before we fix it. Yesterday: a
2014 Camry another shop quoted $1,100. It needed pads and rotors. $380, same day.
**CTA:** Want a second opinion? Bring us the other quote — the look is free.

### Post 3 (Week 3 · community) — Meet Maria
**Hook:** The hands under your hood this month belong to Maria.
**Body:** Maria opened Maple Street Auto Repair nine years ago after a decade
turning wrenches for someone else. Her rule: explain it like you would to your
sister, charge what you would charge your sister. 214 neighbors left 4.9 stars.
**CTA:** Come say hi — 1234 Maple Street, Decatur. Coffee is on us.

## Instagram

### Post 1 (Week 1 · launch) — Brake special reel
**Hook:** That squeak is not going to fix itself.
**Body:** Brake pads, installed, $249 this month — warranty included, inspection
free. A quick word from the shop floor on what we check and why.
**CTA:** DM us "BRAKES" or tap the link in bio to book.
#DecaturGA #CarTok #BrakeJob #MapleStreetAuto #AtlantaCars
*(Avatar video attached — brake-special/heygen-demo.mp4)*

### Post 2 (Week 2 · behind the scenes) — Bay 2, before and after
**Hook:** Worn to the metal vs. done right.
**Body:** Left: pads that came in grinding. Right: new pads, hardware and a road
test. Two hours door to door. This is what "just in time" looks like.
**CTA:** Save this for when your car starts singing.

### Post 3 (Week 4 · trust) — Our warranty, in writing
**Hook:** 12 months. 12,000 miles. In writing on every invoice.
**Body:** If a part we installed fails, we replace it free — parts and labor. No
fine print. That is the whole policy, and it is printed on your receipt.
**CTA:** Questions? DM us — Maria answers.

## Google Business Profile posts (each <1,500 chars)
- Launch: "Brake pads $249/axle installed this month. Warranty included. Call
  404-555-0100."
- Second opinion: "Quote feel high? We will tell you what we would do — free."
- Warranty: "12 months / 12,000 miles, on the invoice."
- Winter: "Battery, brakes, tires, fluids — $49 Winter Ready Check."

## 3-email sequence
1. **Launch** — subject: "Squeaky brakes? $249 this month" — offer + book.
2. **Reminder** — subject: "Still hearing it?" — Camry story + second opinion.
3. **Last chance** — subject: "Last week for $249 brakes" — deadline + call.

## 2 short ad variants
- A: "$249 brake job. Fixed today. Guaranteed a year. Maple Street Auto, Decatur."
- B: "Dealer said $1,100? Get our number first — free second opinion, Decatur."
`,

automation: `# Automate it — Maple Street Auto Repair

Ranked by hours saved vs. effort. Start with #1 this week.

## 1. Lead form → instant auto-reply (saves ~2 h/wk)
Every website lead-form submission already lands in the tracker. Add an
auto-reply email/SMS so nobody waits by the phone:
> "Thanks {name} — Maria at Maple Street Auto here. We got your note and will
> call you back before {today 5pm}. If it is urgent, call 404-555-0100 now."
Setup: 20 minutes in the form tool's notification settings.

## 2. Review ask at pickup (saves ~1 h/wk, biggest ranking lever)
Print the QR card once; the counter script does the rest:
> "If we earned it, a Google review helps the shop more than a tip. Takes 30
> seconds — the QR code on your receipt goes straight there."
Target: ask every pickup; 12 new reviews this sprint.

## 3. Appointment confirmations (saves ~1 h/wk of phone tag)
Same-day-morning text template:
> "Maple Street Auto: your {car} is booked today at {time}. Reply C to confirm."
Square or any booking tool sends these automatically.

## 4. "How much is a brake job" FAQ replies (saves ~30 min/wk)
Saved reply for DMs: "$249 per axle installed, parts + labor, year warranty.
Want us to hold a spot this week?" — paste, personalize the name, send.

## 5. Weekly numbers habit (15 min every Monday)
One recurring Devin task: pull GBP calls, booked brake jobs and new reviews
from the tracker and report which experiment is winning. Ask Devin:
"Give me Monday's numbers and one change for this week."
`,

'action-plan': `# Action plan — after the workshop

## Next 7 days (each item under an hour)
- **Day 1:** Post the brake special on Facebook + GBP; send the launch email;
  put the QR cards at the counter.
- **Day 2:** Do the website "today" fixes (title tag, tap-to-call, $249 line).
- **Day 3:** Nextdoor intro post in Oakhurst/Kirkwood; answer 2 rec threads.
- **Day 4:** Review experiment e1 spend vs. booked jobs — first read, no changes.
- **Day 5:** Shoot 10 shop photos; update GBP services and Q&A.
- **Day 6:** Text every open lead in the tracker a next step.
- **Day 7:** Week-1 experiment review (calendar has it): calls, bookings, reviews.

## Weekly routine (fits ~4 h/wk)
- Mon 30 min: numbers from the tracker — calls, bookings, reviews, spend.
- Wed 60 min: post the week's content-kit pieces on their calendar dates.
- Fri 60 min: reply to reviews and DMs; follow up quoted leads.
- Any 60 min: one automation from automation.md until all five run.

## The 3 numbers and what to change if low
- GBP calls < 25/wk → refresh GBP post + ask more reviews.
- Booked brake jobs < 2/wk → check the $249 price is above the fold everywhere.
- Reviews < 3/wk → the QR card is not in the customer's hand at pickup. Fix that.

## Mid-campaign check-in
${d(15)} — score experiments, kill or scale per each rule, book next month's posts.

## After day 30
Keep the review habit and the Monday numbers. Re-run whichever experiment won at
double budget; retire the losers. New customers get the winter-check offer next.
`,

brain: `# Devin's review — Business Brain, Maple Street Auto Repair

## What is solid
- Real numbers throughout: $38k/month sales, ~60 repair orders, 45 new customers.
- The brake pad job is a perfect lead offer: $249, ~1.5 labor hours, ~$85 parts —
  roughly $70+ left per job after paying labor at $35/h.
- Capacity math checks out: ~25 jobs/week possible, ~18 committed — about 7 free
  slots a week for campaign demand, matching the 8-booking experiment target.

## Watch out for
- CAC at $18 is an estimate — the tracker + experiment rules will correct it fast.
- "Same-day" promises only hold when booked before 10am; keep that condition.
- The $249 special leaves ~$80 gross margin after overhead share — profitable,
  but don't stack a discount deeper than 15% on top.

## Suggested next steps
1. Fill the "Leads and follow-up" section once the tracker has a week of data.
2. Re-run the numbers after 30 days with real CAC and close rates.
3. Keep warranty language exactly as written here — it is already in every post.
`,
};

const DOC_TO_STEP = { offer: 'offer', research: 'research', visibility: 'visibility', strategy: 'strategy', content: 'content', automation: 'automation', 'action-plan': 'action-plan', brain: null };
const docMtime = kind => mt((ALL_STEPS.indexOf(DOC_TO_STEP[kind] ?? kind) + 2) * 5); // staggered, oldest first

const inputs = {
  offer: { sell: 'Brake jobs and pre-purchase inspections', price: '$249 brake pads per axle; inspections $49', window: `next 30 days, ${d(0)} – ${d(30)}` },
  research: { keywords: 'brake repair cost, mechanic near me, is dealer quote fair', who: 'owners of older Hondas/Toyotas/Subarus in Oakhurst & Kirkwood', subs: 'r/DecaturGA, r/Atlanta', competitors: 'Midas on Church St, Decatur Auto Works' },
  visibility: { gbp: 'Yes, but neglected', services: 'brake repair, diagnostics, oil change, suspension, pre-purchase inspection', area: 'Decatur, GA — Oakhurst, Kirkwood, Avondale Estates', competitors: 'Midas on Church St', tracking: ['Google Business Profile insights'] },
  strategy: { goal: '35 new customers and $11,000 in repair orders in 30 days', budget: '$600', channels: ['Google Business Profile', 'Facebook', 'Instagram', 'Nextdoor', 'Email / SMS list', 'Website'] },
  content: { channels: ['Facebook', 'Instagram', 'Google Business Profile', 'Email / SMS list', 'Nextdoor'], voice: 'Plain, honest, a little wry — explain, never scare', words: 'No "cheap", no pressure tactics' },
  calendar: { start: d(0), days: '30 days', pace: '2–3 times a week' },
  automation: { tools: 'Google Business Profile, Square, Facebook/Instagram, Gmail', chores: 'answering "how much is a brake job", appointment reminders, asking for reviews' },
  'action-plan': { hours: '4', launch: d(0), help: 'Just me and two techs — nobody on marketing' },
};

// ---- INTEGRATIONS (copied verbatim from api/index.js so health looks real) --
const INTEGRATIONS = {
  meta_ads: { name: 'Meta Ads (Facebook + Instagram)', url: 'https://mcp.facebook.com/ads', why: 'Lets Devin read your ad performance and draft paused ads and campaigns.' },
  meta_social: { name: 'Meta Social Technologies (developers)', url: 'https://mcp.facebook.com/devtools', why: 'For owners who build their own Meta app — webhooks, app review, API health.' },
  hubspot: { name: 'HubSpot', marketplace: 'HubSpot', why: 'Lets Devin read your contacts, deals and lists to aim offers at real customers.' },
  stripe: { name: 'Stripe', marketplace: 'Stripe', why: 'Lets Devin check your products, prices and recent sales against the offer math.' },
  square: { name: 'Square', marketplace: 'Square', why: 'Lets Devin check your catalog and recent sales against the offer math.' },
  notion: { name: 'Notion', marketplace: 'Notion', why: 'Lets Devin read the notes and plans you already keep in Notion.' },
  airtable: { name: 'Airtable', marketplace: 'Airtable', why: 'Lets Devin read your customer lists and trackers in Airtable.' },
  firecrawl: { name: 'Firecrawl', marketplace: 'Firecrawl', why: 'Lets Devin read competitor websites for positioning research.' },
  google_maps: { name: 'Google Maps', marketplace: 'Google Maps', why: 'Lets Devin look up local competitors, ratings and review themes near you.' },
};
const healthItems = () => [
  { id: 'devin', group: 'required', name: 'Devin API key + Org ID', why: 'Runs the assistant on your own Devin account.', ok: !!stage.devin, shared: false, key: 'DEVIN_API_KEY', key2: 'DEVIN_ORG_ID', link: 'https://app.devin.ai/settings' },
  ...Object.entries(INTEGRATIONS).map(([id, i]) => ({ id, group: 'integrations', name: i.name, why: i.why, url: i.url, marketplace: i.marketplace, toggle: true, ok: false })),
  { id: 'heygen', group: 'optional', name: 'HeyGen', why: 'Makes avatar videos from your scripts and imports them. Connect your HeyGen account to use your plan credits.', ok: !!stage.heygen, oauth: !!stage.heygen, apiKey: false, account: stage.heygen ? { email: 'maria@maplestreetauto.example.com' } : null, key: 'HEYGEN_API_KEY', link: 'https://app.heygen.com/settings?nav=API' },
  { id: 'google_business', group: 'optional', name: 'Google Business Profile', why: 'Studio reads your listing — exact name, address, phone, hours and categories — so every document and your website match Google word for word.', ok: !!stage.google && !stage.google.availableOnly, oauth: !!stage.google && !stage.google.availableOnly, available: !!stage.google, account: stage.google && !stage.google.availableOnly ? stage.google : null, link: 'https://business.google.com/' },
  { id: 'meta_api', group: 'optional', name: 'Meta ad results', why: 'Studio reads spend, clicks and leads from your Meta ad account. Read-only.', ok: false, meta: true, instagram: null },
];

const done = id => stage.done.has(id);
function businessState() {
  const docs = {};
  for (const k of ['brain', 'offer', 'research', 'strategy', 'content', 'visibility', 'automation', 'action-plan']) docs[k] = null;
  for (const [kind, content] of Object.entries(DOCS)) {
    const include = kind === 'brain' ? stage.brain : done(kind);
    if (include) docs[kind] = { content, mtime: docMtime(kind) };
  }
  return {
    sprint: { id: 'growth', name: 'Growth Sprint', started: d(0) },
    profile: done('profile') ? profile : null,
    inputs,
    tracker: done('tracker') ? tracker : null,
    brain: stage.brain ? brain : {},
    experiments: done('strategy') ? experiments : [],
    posts: done('content') ? posts : [],
    adInsights: null, instagramInsights: null,
    calendar: done('calendar') ? calendar : null,
    calendarIssues: 0,
    docs,
    history: done('offer') ? { offer: [{ id: 'hist-offer-1', at: mt(50) }, { id: 'hist-offer-2', at: mt(28) }] } : {},
    mtimes: {
      profile: done('profile') ? mt(70) : null,
      calendar: done('calendar') ? mt(12) : null,
      tracker: done('tracker') ? mt(6) : null,
      brain: stage.brain ? mt(66) : null,
      posts: done('content') ? mt(30) : null,
    },
    site: stage.site,
    agent: 'devin', busy: !!stage.busy,
  };
}
const projects = () => [{ name: 'brake-special', videos: done('video') ? [{ file: 'heygen-demo.mp4', url: '/mock/demo.mp4' }] : [] }];

const CHAT_BUSINESS = [
  { id: 'm1', kind: 'user', text: 'Build my core offer and target customer. Use the grand-slam-offer framework. Skip interview questions the profile already covers.\n\n- What do you want to sell more of in the next 30 days?: Brake jobs and pre-purchase inspections\n- Typical price range: $249 brake pads per axle; inspections $49\n- Campaign window: next 30 days' },
  { id: 'm2', kind: 'agent', text: 'Quick question before I write: do you offer any warranty on brake work today? Reply here and I\'ll keep going.' },
  { id: 'm3', kind: 'user', text: 'Yes — 12 months or 12,000 miles on parts and labor.' },
  { id: 'm4', kind: 'agent', text: 'Done — your core offer is written.\nI built 3 options around your $249 brake job and recommend **The Stop-Safe Special**: fixed price, free inspection, your real warranty.\nNext: Customer conversations, or tell me what to change.' },
];
const CHAT_PROJECT = [
  { id: 'p1', kind: 'user', text: 'Write a HeyGen presenter script for a promo video for project "brake-special", selling the offer.' },
  { id: 'p2', kind: 'agent', text: 'Hearing a squeal every time you slow down on Ponce? This month at Maple Street Auto Repair, brake pad replacement is $249 per axle — parts, labor and a 12-month warranty, all in writing. We quote before we wrench, and most cars are back the same day. Call 404-555-0100 and we\'ll get you on the lift.\n\nPick a warm, plain-spoken avatar and 9:16 for Reels.' },
];
function poll(scope, cursor) {
  if (stage.busy) return { messages: [], busy: true, starting: true };
  const all = !stage.chat ? [] : scope === 'business' ? CHAT_BUSINESS : CHAT_PROJECT;
  const i = cursor ? all.findIndex(m => m.id === cursor) : -1;
  return { messages: i >= 0 ? all.slice(i + 1) : all, busy: false, applied: [] };
}

const AVATAR_COLORS = [['#4a6fa5', 'MR'], ['#7a4a8a', 'DK'], ['#3a7a5a', 'SJ']];
const svgAvatar = ([bg, initials]) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${bg}"/><circle cx="100" cy="78" r="34" fill="#ffffff33"/><rect x="52" y="118" width="96" height="82" rx="40" fill="#ffffff33"/><text x="100" y="186" font-family="sans-serif" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`).toString('base64');
const avatars = () => ({ avatars: stage.heygen ? [
  { id: 'av_maria', name: 'Maria — presenter', avatar_type: 'photo_avatar', preview_image_url: svgAvatar(AVATAR_COLORS[0]) },
  { id: 'av_derek', name: 'Derek — casual', avatar_type: 'studio', preview_image_url: svgAvatar(AVATAR_COLORS[1]) },
  { id: 'av_sam', name: 'Sam — studio', avatar_type: 'studio', preview_image_url: svgAvatar(AVATAR_COLORS[2]) },
] : [] });

const LEAD_TOKEN = 'mockleadt9ken1234abcd';
const LEAD_HOST = 'https://studio.example.com'; // screenshots should show a plausible public URL, not localhost
const leadForm = () => ({
  url: `${LEAD_HOST}/api/lead/${LEAD_TOKEN}`,
  embed: `<form action="${LEAD_HOST}/api/lead/${LEAD_TOKEN}" method="post"><input name="name" placeholder="Your name" required><input name="contact" placeholder="Phone or email" required><textarea name="message" placeholder="How can we help?"></textarea><button>Send</button></form>`,
  experiments: experiments.map(e => ({ id: e.id, name: e.name, url: `${LEAD_HOST}/api/lead/${LEAD_TOKEN}?exp=${e.id}` })),
});

// ---- demo.mp4: try ffmpeg (incl. Playwright's bundled build) ---------------
let mp4Buf = null, mp4Type = 'video/mp4', mp4Tried = false;
function demoVideo() {
  if (mp4Tried) return mp4Buf;
  mp4Tried = true;
  const file = path.join(ROOT, 'dev', 'demo.mp4');
  if (fs.existsSync(file)) { mp4Buf = fs.readFileSync(file); return mp4Buf; }
  const ffcache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const cands = ['ffmpeg'];
  try { for (const d0 of fs.readdirSync(ffcache)) if (d0.startsWith('ffmpeg-')) cands.push(path.join(ffcache, d0, 'ffmpeg-mac'), path.join(ffcache, d0, 'ffmpeg-linux'), path.join(ffcache, d0, 'ffmpeg-win64', 'ffmpeg.exe')); } catch {}
  const args = (enc, out) => ['-y', '-f', 'lavfi', '-i', 'color=c=0x1a4f8a:s=640x360:d=2:r=24', '-f', 'lavfi', '-i', 'sine=frequency=440:d=2', '-shortest', ...enc, out];
  const tmp = path.join(ROOT, 'dev', '.demo-video');
  for (const ff of cands) {
    for (const [enc, ext, type] of [
      [['-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart'], 'mp4', 'video/mp4'],
      [['-pix_fmt', 'yuv420p', '-c:v', 'mpeg4', '-c:a', 'aac', '-movflags', '+faststart'], 'mp4', 'video/mp4'],
      [['-c:v', 'libvpx-vp9', '-b:v', '500k', '-c:a', 'libopus'], 'webm', 'video/webm'],
      [['-c:v', 'libvpx', '-b:v', '500k', '-c:a', 'libvorbis'], 'webm', 'video/webm'],
    ]) {
      try {
        const r = spawnSync(ff, args(enc, tmp), { stdio: 'pipe', timeout: 30000 });
        if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 200) {
          mp4Buf = fs.readFileSync(tmp); mp4Type = type;
          try { fs.renameSync(tmp, path.join(ROOT, 'dev', 'demo' + (ext === 'mp4' ? '.mp4' : '.webm'))); } catch {}
          console.log(`[mock] demo video generated with ${ff} (${ext})`);
          return mp4Buf;
        }
      } catch {}
    }
  }
  // Last resort: a bare ftyp box so the <video> element exists (won't play).
  mp4Buf = Buffer.from('000000186674797069736f6d0000020069736f6d6176316d703431', 'hex');
  console.log('[mock] no ffmpeg found — serving placeholder mp4');
  return mp4Buf;
}

// ---- http plumbing ----------------------------------------------------------
const json = (res, code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-supabase-api-version, x-upsert, prefer, range' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    // ---- stage control ----
    if (url.pathname === '/mock/stage' && req.method === 'GET') {
      const q = url.searchParams;
      if (q.has('done')) stage.done = new Set(q.get('done').split(',').map(s => s.trim()).filter(Boolean));
      for (const k of ['brain', 'devin', 'heygen', 'chat', 'busy']) if (q.has(k)) stage[k] = q.get(k) === '1' ? 1 : 0;
      if (q.has('site')) stage.site = q.get('site') === '1' ? { url: 'https://app.devin.ai/sessions/devin-mock', status: 'working', startedAt: new Date(Date.now() - 42 * 60000).toISOString() } : null;
      if (q.has('google')) {
        const v = q.get('google');
        const locs = [
          { name: 'accounts/1/locations/1', title: 'Maple Street Auto Repair', address: '1234 Maple St SE, Decatur, GA 30030' },
          { name: 'accounts/1/locations/2', title: 'Maple Street Auto — Avondale', address: '22 N Avondale Rd, Avondale Estates, GA 30002' },
        ];
        stage.google = v === 'connected' ? { email: USER.email, locations: [locs[0]], location: locs[0].name, pending: false }
          : v === 'pending' ? { email: USER.email, locations: [], location: null, pending: true }
          : v === 'multi' ? { email: USER.email, locations: locs, location: locs[0].name, pending: false }
          : v === 'available' ? { availableOnly: true }
          : null;
      }
      return json(res, 200, { ok: true, stage: { done: [...stage.done], brain: stage.brain, devin: stage.devin, heygen: stage.heygen, chat: stage.chat, busy: stage.busy } });
    }
    if (url.pathname === '/mock/demo.mp4' && req.method === 'GET') {
      const buf = demoVideo();
      res.writeHead(200, { 'Content-Type': mp4Type, 'Content-Length': buf.length, 'Access-Control-Allow-Origin': '*' });
      return res.end(buf);
    }
    // Lets the "Connect HeyGen" popup complete like the real OAuth callback.
    if (url.pathname === '/mock/heygen-callback') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><p>HeyGen connected. You can close this tab.</p><script>try{window.opener&&window.opener.postMessage({type:"heygen-connected"},"*")}catch(e){};setTimeout(()=>window.close(),800)</script>');
    }

    // ---- Supabase Auth ----
    if (parts[0] === 'auth') {
      if (req.method === 'POST' && url.pathname === '/auth/v1/signup') {
        const b = JSON.parse(await readBody(req) || '{}');
        if (String(b.email || '').includes('new')) // "confirm your email" path: user back, no session
          return json(res, 200, { ...USER, id: 'mock-user-new', email: b.email, email_confirmed_at: null });
        return json(res, 200, session());
      }
      if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
        await readBody(req);
        return json(res, 200, session());
      }
      if (req.method === 'GET' && url.pathname === '/auth/v1/user') return json(res, 200, { ...USER });
      if (req.method === 'POST' && url.pathname === '/auth/v1/logout') { res.writeHead(204, CORS); return res.end(); }
      return json(res, 404, { error: 'mock auth: not found', path: url.pathname });
    }

    // ---- Studio API ----
    if (parts[0] === 'api' && parts[1] === 'lead' && parts[2] === LEAD_TOKEN) {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><title>Maple Street Auto Repair</title><body style="font-family:system-ui;max-width:26em;margin:3em auto"><h1>Get a straight quote</h1><p>Maple Street Auto Repair, Decatur. Tell us what your car is doing and we\'ll call you back the same day.</p><form method="post"><p><input name="name" placeholder="Your name" required style="width:100%;padding:.5em"><p><input name="contact" placeholder="Phone or email" required style="width:100%;padding:.5em"><p><textarea name="message" placeholder="What\'s the car doing?" rows="4" style="width:100%;padding:.5em"></textarea><p><button style="padding:.6em 1.2em">Send</button></form>');
      }
      if (req.method === 'POST') { await readBody(req); res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><p>Thanks — we\'ll be in touch shortly.</p>'); }
    }

    // every remaining /api route is "signed in" in mock-land
    if (req.method === 'GET' && url.pathname === '/api/auth/me') return json(res, 200, { hosted: true, email: USER.email });
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { hosted: true, items: healthItems() });
    if (req.method === 'GET' && url.pathname === '/api/business') return json(res, 200, businessState());
    if (req.method === 'GET' && url.pathname === '/api/businesses') return json(res, 200, { current: 'Maple Street Auto Repair', list: [{ id: 'b1', name: 'Maple Street Auto Repair' }] });
    if (req.method === 'POST' && parts[1] === 'businesses' && ['new', 'switch'].includes(parts[2]))
      return json(res, 200, { current: 'Maple Street Auto Repair', list: [{ id: 'b1', name: 'Maple Street Auto Repair' }] });
    if (req.method === 'GET' && url.pathname === '/api/business/export.md') {
      const b = businessState();
      const out = [`# ${b.sprint.name} — ${b.profile?.name || 'my business'}`, `_Exported ${new Date().toLocaleString()}_`];
      if (b.profile) out.push('## Business profile', ...Object.entries(b.profile).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => `- **${k}:** ${v}`));
      for (const k of Object.keys(DOCS)) if (b.docs[k]) out.push('\n---\n', b.docs[k].content.trim());
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="sprint.md"' });
      return res.end(out.join('\n\n') + '\n');
    }
    if (req.method === 'GET' && parts[1] === 'business' && parts[2] === 'lead-form') return json(res, 200, leadForm());
    if (req.method === 'POST' && parts[1] === 'business' && parts[2] === 'lead-form' && parts[3] === 'rotate') return json(res, 200, leadForm());
    if (req.method === 'GET' && parts[1] === 'business' && parts[2] === 'history' && parts[3])
      return json(res, 200, { kind: 'offer', content: '# Earlier draft — core offer\n\nFirst pass at the offer before the warranty section was added.\n\n- Brake special: $259 per axle\n- Free inspection\n- Call to book\n' });
    if (req.method === 'GET' && url.pathname === '/api/projects') return json(res, 200, { projects: projects(), defaultAgent: 'devin' });
    if (req.method === 'GET' && url.pathname === '/api/heygen/avatars') return json(res, 200, avatars());
    if (req.method === 'GET' && url.pathname === '/api/heygen/videos') return json(res, 200, { videos: [], next_token: null });
    if (req.method === 'GET' && parts[1] === 'heygen' && parts[2] === 'videos' && parts[3]) return json(res, 200, { status: 'completed', failure_message: null });
    if (req.method === 'POST' && url.pathname === '/api/heygen/oauth/start') return json(res, 200, { url: `http://localhost:${PORT}/mock/heygen-callback` });
    if (req.method === 'POST' && url.pathname === '/api/google/oauth/start') {
      if (!stage.google) return json(res, 400, { error: 'Google Business Profile isn’t available yet — Studio is waiting on Google’s approval.' });
      return json(res, 200, { url: `http://localhost:${PORT}/mock/google-callback` });
    }
    if (req.method === 'GET' && url.pathname === '/api/google') return json(res, 200, stage.google && !stage.google.availableOnly ? stage.google : {});
    if (req.method === 'POST' && url.pathname === '/api/google/sync') return json(res, 200, stage.google && !stage.google.availableOnly ? stage.google : {});
    if (req.method === 'POST' && url.pathname === '/api/google/location') {
      const b = JSON.parse(await readBody(req) || '{}');
      const loc = stage.google?.locations?.find(l => l.name === b.name);
      if (!loc) return json(res, 400, { error: 'Unknown listing.' });
      stage.google.location = loc.name;
      return json(res, 200, stage.google);
    }
    if (req.method === 'POST' && url.pathname === '/api/google/oauth/disconnect') { stage.google = { availableOnly: true }; return json(res, 200, { ok: true }); }
    if (url.pathname === '/mock/google-callback') {
      stage.google = { email: USER.email, locations: [{ name: 'accounts/1/locations/1', title: 'Maple Street Auto Repair', address: '1234 Maple St SE, Decatur, GA 30030' }], location: 'accounts/1/locations/1', pending: false };
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><p>Google Business Profile connected. You can close this tab.</p><script>try{window.opener&&window.opener.postMessage({type:"google-connected"},"*")}catch(e){};setTimeout(()=>window.close(),800)</script>');
    }
    if (req.method === 'POST' && parts[1] === 'agent' && parts[3] === 'new') return json(res, 200, { ok: true });
    if (req.method === 'POST' && parts[1] === 'agent' && parts[3] === 'prompt') { await readBody(req); return json(res, 202, { ok: true }); }
    if (req.method === 'GET' && parts[1] === 'agent' && parts[3] === 'poll') return json(res, 200, poll(parts[2], url.searchParams.get('cursor')));
    if (req.method === 'GET' && url.pathname === '/api/site') return json(res, 200, stage.site || {});
    if (req.method === 'POST' && url.pathname === '/api/site/start') {
      await readBody(req);
      if (!stage.site) stage.site = { url: 'https://app.devin.ai/sessions/devin-mock', status: 'working', startedAt: new Date().toISOString() };
      return json(res, 201, { url: stage.site.url });
    }
    if (req.method === 'POST' && parts[1] === 'projects' && parts[3] === 'heygen' && parts[4] === 'generate') { await readBody(req); return json(res, 202, { video_id: 'mockvid1' }); }
    if (req.method === 'POST' && parts[1] === 'projects' && parts[3] === 'heygen') { await readBody(req); return json(res, 201, { file: 'heygen-mockvid1.mp4' }); }
    if (req.method === 'POST' && url.pathname === '/api/projects') { await readBody(req); return json(res, 201, { name: 'brake-special' }); }
    if (['POST', 'PUT'].includes(req.method) && parts[0] === 'api') { await readBody(req); return json(res, 200, { ok: true }); }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: 'mock: ' + e.message });
  }
}).listen(PORT, () => console.log(`[mock] Supabase Auth + Studio API on http://localhost:${PORT}  (stage: GET /mock/stage?done=...&brain=&devin=&heygen=&chat=&busy=)`));
