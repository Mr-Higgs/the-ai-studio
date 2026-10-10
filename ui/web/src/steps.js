// ============================================================================
//  EDIT THE SPRINT HERE.
//  Everything participants see and everything Devin is asked to do lives in this
//  file: step order, titles, guide text, questions, prompts, the day's agenda and
//  the video presets. Change it, then restart `npm run studio`.
//
//  Step fields:
//    id      url + file key            kind   profile | doc | calendar | video | tracker
//    title   sidebar + page heading    blurb  one line under the heading
//    file    what Devin writes in business/ (doc/calendar steps)
//    uses    step ids this one builds on (drives "Builds on" + "out of date" notices)
//    guide   { time, why, done[], tips[] } — the "How to do this step" box
//    inputs  questions above the button  { id, label, type?, placeholder?, options? }
//            type: text (default) | textarea | select | checks | date
//    prompt  (answers, step) => the message sent to Devin
// ============================================================================

const CONTEXT = `We're in the "Holiday Growth Sprint" workshop, building a holiday sales campaign for my small business. First read business/profile.json and every file that exists in business/ (earlier steps), so your work builds on what's already decided. If business/profile.json doesn't exist, ask me 3 quick questions about the business (what I sell, to whom, where) before anything else. Steps can be done in any order: if an earlier step's file is missing, make sensible assumptions, label them "(assumed)", and keep going.`;

const rules = file => `Write for a busy, non-technical owner: plain words, short sections, concrete examples and real numbers, nothing generic. If something critical is missing, ask me at most 3 short questions in chat and wait for my answers; otherwise go straight to writing. Save the result as Markdown to business/${file} (overwrite it if it exists). Then reply with a 3-line summary of what you made.`;

const answers = (inputs, fields) => fields
  .map(f => {
    const v = inputs[f.id];
    const shown = Array.isArray(v) ? v.join(', ') : v;
    return shown ? `- ${f.label}: ${shown}` : null;
  })
  .filter(Boolean).join('\n') || '- (nothing extra — use the profile)';

export const STEPS = [
  {
    id: 'profile', kind: 'profile', title: 'Business profile',
    blurb: 'The basics Devin uses for every step. Two minutes now saves you repeating yourself all day.',
    guide: {
      time: '15 min',
      why: 'Every step reads this first. A specific profile is the difference between generic advice and a plan that sounds like your business.',
      done: ['Business name and what you sell, in plain words', 'Who actually buys today — be specific', 'Average sale and any proof (reviews, numbers)'],
      tips: ['Write like you’d explain it to a new employee, not a marketing brochure.', 'Real numbers beat adjectives: “4.9★ from 310 reviews” beats “highly rated”.'],
    },
    inputs: [
      { id: 'name', label: 'Business name', placeholder: 'e.g. Juniper & Wick Candle Co.' },
      { id: 'location', label: 'Where you sell', placeholder: 'e.g. Austin, TX + ships nationwide' },
      { id: 'sells', label: 'What you sell', type: 'textarea', placeholder: 'Products or services, in a sentence or two' },
      { id: 'customers', label: 'Who buys from you today', type: 'textarea', placeholder: 'e.g. Women 30–55 buying gifts, local offices ordering client gifts' },
      { id: 'price', label: 'Average sale', placeholder: 'e.g. $48' },
      { id: 'website', label: 'Website', placeholder: 'https://…' },
      { id: 'socials', label: 'Social handles', placeholder: 'e.g. @juniperwick on Instagram and TikTok' },
      { id: 'proof', label: 'Reviews, awards or numbers you’re proud of', placeholder: 'e.g. 4.9★ on Etsy, 300+ reviews' },
    ],
  },
  {
    id: 'offer', kind: 'doc', title: 'Holiday offer', file: 'offer.md', uses: ['profile'],
    blurb: 'One offer so clear and valuable that the right customer feels silly saying no — and a sharp picture of who that customer is.',
    guide: {
      time: '60 min',
      why: 'Everything after this — posts, emails, videos — sells this offer. A weak offer can’t be rescued by good marketing.',
      done: ['One named offer with a clear price', 'Bonuses and a guarantee that remove the risk of buying', 'A real deadline or limit tied to holiday dates', 'One-sentence pitch you could say out loud'],
      tips: ['Answer Devin’s interview questions honestly — “I don’t know” is a fine answer.', 'Ask: “Which of the 3 offers would you pick for my capacity, and why?”', 'Ask: “Make the guarantee something I can actually afford.”'],
    },
    inputs: [
      { id: 'sell', label: 'What do you want to sell more of this season?', type: 'textarea', placeholder: 'e.g. Gift boxes of our small-batch candles, and gift cards for last-minute shoppers' },
      { id: 'price', label: 'Typical price range', placeholder: 'e.g. $35–$120' },
      { id: 'window', label: 'Campaign window', placeholder: 'e.g. Nov 20 – Dec 23' },
    ],
    prompt: (i, s) => `${CONTEXT}

Build my holiday offer and target customer. Use the grand-slam-offer skill (.devin/skills/grand-slam-offer). Skip any interview questions the profile and the answers below already cover, and keep the interview to at most 2 short rounds.

${answers(i, s.inputs)}

The document must include: (1) the target customer — who they are, what they want for the holidays, what stops them buying; (2) 3 holiday offer options built with the skill's framework (bonuses, guarantee, real urgency/scarcity tied to holiday dates, a name); (3) your recommended offer and why; (4) the one-sentence pitch and main call-to-action.

${rules('offer.md')}`,
  },
  {
    id: 'research', kind: 'doc', title: 'Customer conversations', file: 'research.md', uses: ['profile', 'offer'],
    blurb: 'What your customers are already saying on Reddit and forums — their words, their questions, and where you can genuinely show up.',
    guide: {
      time: '30 min',
      why: 'The best-converting copy uses your customers’ own words. And the places they ask for recommendations are where a helpful answer turns into a sale.',
      done: ['3–6 communities where your customers talk, with their self-promotion rules', 'Pains and wants in customers’ exact words, with links', 'Questions people keep asking — each one a post or FAQ idea', 'A short list of community-friendly growth plays, and what not to do'],
      tips: ['Ask: “Which 3 threads would be worth replying to this week, and what would a genuinely helpful reply say?”', 'Ask: “Turn the top 5 questions into Instagram post ideas.”', 'Never post links in communities that ban self-promotion — it gets you banned and hurts the brand.'],
    },
    inputs: [
      { id: 'keywords', label: 'What would people search or ask about?', placeholder: 'e.g. candle gift ideas, gifts for coworkers under $50, best soy candles' },
      { id: 'who', label: 'Who are you listening for?', placeholder: 'e.g. people buying gifts for mom, office managers' },
      { id: 'subs', label: 'Subreddits you already know (optional)', placeholder: 'e.g. r/GiftIdeas, r/candles, r/Austin' },
      { id: 'region', label: 'City or region (for local communities)', placeholder: 'e.g. Austin, TX' },
    ],
    prompt: (i, s) => `${CONTEXT}

Research what my potential customers are saying online, mainly on Reddit, to inform my holiday campaign.

${answers(i, s.inputs)}

How to research — follow these rules exactly: use ONLY your built-in web search and web fetch tools. Search (e.g. site:reddit.com plus the keywords, gift and holiday angles, local subreddits for my region), then open at most 15 of the most relevant threads from the last 2 years with web fetch. Do NOT use the shell for this: no curl, wget, python or other scripts, no custom user agents, no reddit.com .json or API endpoints, no logging in. Never post, comment, vote or message. If a fetch is blocked, don't work around it — use the search-result snippets and other public forums or review sites instead, and say which sources you used. This should take a few minutes, not longer.

The document must include: (1) where these customers talk — each community with a link, what it's about, and its rules on self-promotion; (2) top pains and wants in customers' exact words (short quotes under 15 words, each with the thread link); (3) questions people keep asking, each turned into a post, email or FAQ idea; (4) objections and hesitations to answer in my copy; (5) 5 growth plays that respect community rules (e.g. genuinely helpful answers, local weekly promo threads, giveaways or AMAs where mods allow, collaborations); (6) what not to do (spam, fake reviews, vote manipulation, sockpuppets).

${rules('research.md')}`,
  },
  {
    id: 'strategy', kind: 'doc', title: 'Strategy & messaging', file: 'strategy.md', uses: ['offer', 'research'],
    blurb: 'Where to show up, what to say, and the calls-to-action that turn attention into inquiries and sales.',
    guide: {
      time: '45 min',
      why: 'Small businesses win by doing 2–3 channels well, not 8 badly. This decides where your limited time goes.',
      done: ['2–3 focus channels, and what you’re ignoring', 'Campaign phases with real dates', 'One core message and clear calls-to-action', 'The 3 numbers you’ll check weekly'],
      tips: ['Be honest about time: “I can spend 3 hours a week” changes the plan.', 'Ask: “What’s the simplest version of this I could run alone?”'],
    },
    inputs: [
      { id: 'goal', label: 'Holiday goal', placeholder: 'e.g. 40 orders and $4,000 in sales by Dec 24' },
      { id: 'budget', label: 'Marketing budget for the season', placeholder: 'e.g. $0, $200, $1,000' },
      { id: 'channels', label: 'Where you reach customers today', type: 'checks', options: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Reddit', 'Email list', 'Google Business Profile', 'Website', 'In person / word of mouth'] },
    ],
    prompt: (i, s) => `${CONTEXT}

Create my holiday sales and marketing strategy, built around the offer in business/offer.md and the customer language, questions and communities in business/research.md.

${answers(i, s.inputs)}

Include: the 2–3 channels to focus on (and what to ignore) given my time and budget; the campaign phases with dates (warm-up, launch, push, last-chance); the core message and 3 supporting messages, using customers' own words where possible; 5 calls-to-action rewritten for clarity, each matched to where it's used; how a stranger becomes a customer (the path from first touch to purchase); and how I'll know it's working (the 3 numbers to watch weekly).

${rules('strategy.md')}`,
  },
  {
    id: 'content', kind: 'doc', title: 'Content kit', file: 'content.md', uses: ['offer', 'research', 'strategy'],
    blurb: 'Ready-to-post captions, emails and ads written in your voice, for the channels in your strategy.',
    guide: {
      time: '45 min',
      why: 'Writing posts daily during the busiest season is how campaigns die. Write them all now, post them later.',
      done: ['3–5 posts per channel, each with a hook and call-to-action', 'A 3-email sequence: launch, reminder, last chance', '2 short ad versions'],
      tips: ['Ask: “Rewrite post 2 so it sounds more like me — here’s a caption I wrote last year: …”', 'Ask: “Make the hooks shorter; people scroll fast.”', 'Copy straight from the page into your phone’s notes app.'],
    },
    inputs: [
      { id: 'channels', label: 'Write for', type: 'checks', options: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Reddit', 'Email', 'Google Business Profile', 'Website banner', 'Text message'] },
      { id: 'voice', label: 'Your brand voice', placeholder: 'e.g. warm, a little funny, never pushy' },
      { id: 'words', label: 'Words or claims to avoid', placeholder: 'optional' },
    ],
    prompt: (i, s) => `${CONTEXT}

Write my ready-to-use holiday promotional content, following business/strategy.md, selling the offer in business/offer.md, and answering the questions and objections in business/research.md in customers' own words.

${answers(i, s.inputs)}

For each channel: 3–5 posts (hook, body, call-to-action, hashtags where relevant), each labelled with the campaign phase it belongs to. For Reddit, write genuinely helpful answer templates for common questions, not ads, and note which communities allow any mention of a business. Also include a 3-email sequence (subject lines + body) for launch, reminder and last chance, and 2 short ad variants. Everything must be copy-paste ready — no placeholders except [link].

${rules('content.md')}`,
  },
  {
    id: 'video', kind: 'video', title: 'Promo videos', uses: ['offer'],
    blurb: 'Drop in raw phone or screen footage. Devin cuts it into a polished holiday promo, sized for the channel.',
    guide: {
      time: '60 min',
      why: 'Short video is the highest-reach format on every platform right now, and phone footage is enough.',
      done: ['At least one finished video in the right shape for where you’ll post it', 'Opens with a hook in the first 2 seconds', 'Ends on your offer and call-to-action'],
      tips: ['Film 2–3 minutes more than you need — Devin cuts the fumbles.', 'Read Devin’s plan before saying “go”; ask for changes in plain words.', 'Works before the Offer step too — Devin just keeps on-screen text generic.', 'Made an avatar video in HeyGen? Use “Import from HeyGen” under Footage to pull it straight in.'],
    },
  },
  {
    id: 'calendar', kind: 'calendar', title: 'Campaign calendar', file: 'calendar.json', uses: ['strategy', 'content'],
    blurb: 'Every post and email on a date, so the campaign runs itself. Tick things off as they go out.',
    guide: {
      time: '30 min',
      why: 'A calendar turns a plan into a habit. You’ll open this every morning of the campaign.',
      done: ['Every piece on a date, lined up with Black Friday, Small Business Saturday, Cyber Monday and shipping cut-offs', 'A pace you can actually keep'],
      tips: ['Pick the posting pace you can keep on your worst week, not your best.', 'Ask: “Move everything after Dec 15 one day earlier.”'],
    },
    inputs: [
      { id: 'start', label: 'Start date', type: 'date' },
      { id: 'days', label: 'Length', type: 'select', options: ['30 days', '45 days', '60 days'] },
      { id: 'pace', label: 'How much can you post?', type: 'select', options: ['2–3 times a week', '4–5 times a week', 'Every day'] },
    ],
    prompt: (i, s) => `${CONTEXT}

Build my holiday content calendar from business/strategy.md and business/content.md (reuse that copy; write new copy only where gaps exist).

${answers(i, s.inputs)}

Save it as JSON (not Markdown) to business/calendar.json: an array sorted by date, where each item is exactly
{"date": "YYYY-MM-DD", "channel": "Instagram", "format": "Reel | Post | Story | Email | Ad | Other", "title": "short label", "copy": "the full ready-to-post text", "cta": "the call-to-action", "status": "planned"}.
Line the dates up with the campaign phases and real holiday dates (Black Friday, Small Business Saturday, Cyber Monday, shipping cut-offs, Dec 24). After saving, check the file parses as valid JSON. If something critical is missing, ask me at most 3 short questions first. Then reply with a 3-line summary.`,
  },
  {
    id: 'visibility', kind: 'doc', title: 'Get found', file: 'visibility.md', uses: ['profile', 'research'],
    blurb: 'Show up when people search Google, Maps, and AI assistants like ChatGPT for what you sell.',
    guide: {
      time: '25 min',
      why: 'Holiday shoppers search “gifts near me” and ask AI assistants for ideas. If your listings are thin or inconsistent, you don’t get mentioned.',
      done: ['A fixed-up Google Business Profile, with holiday posts ready', 'The search phrases to target and where they go', 'FAQ answers AI assistants can quote', 'A prioritized checklist with time estimates'],
      tips: ['Do the 15-minute items today, before you leave.', 'Ask: “Write my Google Business Profile description in under 750 characters.”'],
    },
    inputs: [
      { id: 'site', label: 'Website', placeholder: 'https://… (or "none")' },
      { id: 'gbp', label: 'Google Business Profile', type: 'select', options: ['Yes, and it’s up to date', 'Yes, but neglected', 'No', 'Not sure'] },
      { id: 'searches', label: 'What would a customer type to find you?', placeholder: 'e.g. handmade candles Austin, unique gifts near me' },
    ],
    prompt: (i, s) => `${CONTEXT}

Create my online visibility plan for the holiday season. If I gave a website, fetch it and review it. Use the questions customers ask in business/research.md for the FAQ.

${answers(i, s.inputs)}

Cover: Google Business Profile fixes and 4 holiday posts for it; the 10 search phrases to target and where each belongs on my site; quick on-page fixes (titles, descriptions, holiday landing section — write the actual text); getting found by AI assistants (clear FAQ answers, consistent business facts across listings, review requests — write the FAQ and a review-request message); and a prioritized checklist with time estimates.

${rules('visibility.md')}`,
  },
  {
    id: 'automation', kind: 'doc', title: 'Automate it', file: 'automation.md', uses: ['profile', 'strategy'],
    blurb: 'Hand repetitive work — replies, follow-ups, reminders, posting — to tools and AI, so you can sell.',
    guide: {
      time: '20 min',
      why: 'In December your time is the bottleneck. Every hour automated is an hour back for orders and customers.',
      done: ['5 automations ranked by hours saved', 'Setup steps using tools you already have', 'The auto-reply and follow-up text, written'],
      tips: ['Start with one automation this week, not five.', 'Ask: “Walk me through setting up #1 in Instagram step by step.”'],
    },
    inputs: [
      { id: 'tools', label: 'Tools you already use', placeholder: 'e.g. Shopify, Square, Gmail, Instagram, Calendly, Mailchimp' },
      { id: 'chores', label: 'What eats your time every week?', type: 'textarea', placeholder: 'e.g. answering the same DMs, chasing quotes, posting every day' },
    ],
    prompt: (i, s) => `${CONTEXT}

Find the best automation opportunities for my business this holiday season.

${answers(i, s.inputs)}

Give me the 5 highest-value automations ranked by hours saved vs. effort to set up. For each: what it does, which of my existing tools can do it (prefer free tiers and what I already pay for), step-by-step setup, and any ready-to-use text it needs (auto-replies, follow-up emails, FAQ answers, booking confirmations — write them). Include one AI-assisted workflow I can run myself each week using Devin.

${rules('automation.md')}`,
  },
  {
    id: 'tracker', kind: 'tracker', title: 'Lead tracker', file: 'tracker.json',
    blurb: 'Every inquiry, customer and sale in one place, so you know what’s working and who to follow up with.',
    guide: {
      time: '15 min',
      why: 'Most small businesses lose sales by forgetting to follow up, not by lacking leads.',
      done: ['Every open conversation logged, with its source', 'A next step in the notes for each open lead'],
      tips: ['Log DMs and calls the same day — it takes 20 seconds.', 'Once a week, click “Ask Devin what to do next”.'],
    },
  },
  {
    id: 'action-plan', kind: 'doc', title: 'Action plan', file: 'action-plan.md', uses: ['strategy', 'calendar', 'tracker'],
    blurb: 'Your launch checklist and weekly routine for after today — what to do, when, and how to improve it.',
    guide: {
      time: '30 min',
      why: 'The workshop ends today; the campaign doesn’t. This is what you’ll actually follow next week.',
      done: ['A 7-day launch checklist, each item under an hour', 'A weekly routine that fits your real hours', 'A mid-campaign check-in date'],
      tips: ['Put the check-in date in your calendar before you close the laptop.', 'Click “Download my sprint” at the bottom of the sidebar to take everything home.'],
    },
    inputs: [
      { id: 'hours', label: 'Hours per week you can give this', placeholder: 'e.g. 4' },
      { id: 'launch', label: 'Launch date', type: 'date' },
      { id: 'help', label: 'Anyone helping you?', placeholder: 'e.g. my partner on weekends, a part-time assistant' },
    ],
    prompt: (i, s) => `${CONTEXT}

Pull everything in business/ into my action plan for after the workshop.

${answers(i, s.inputs)}

Include: a launch checklist for the next 7 days (each item under 1 hour, in order); a weekly routine that fits my hours (create, post, follow up, review numbers — using business/calendar.json and business/tracker.json); the 3 numbers to review every week and what to change if each is low; a mid-campaign check-in on a specific date; and what to do in the first week of January to keep new customers coming back.

${rules('action-plan.md')}`,
  },
];

export const PROFILE_STEP = STEPS[0];

// Shown at the top of Setup. FACILITATOR: replace with your sign-up link and how to redeem
// the promo code you hand out. `link` is optional; leave it '' to hide the button.
export const SETUP_ACCOUNT = {
  text: 'Create your Devin account before the workshop and redeem the promo code you were given. Then install the Devin CLI below and sign in with that account.',
  link: '',
  linkLabel: 'Create your Devin account',
};

// The full-day run of the sprint, shown on the Start here page. `step` links to a step.
export const AGENDA = [
  { time: '30 min', what: 'Setup and business profile', step: 'profile' },
  { time: '60 min', what: 'Holiday offer', step: 'offer' },
  { time: '15 min', what: 'Break' },
  { time: '30 min', what: 'Customer conversations', step: 'research' },
  { time: '45 min', what: 'Strategy & messaging', step: 'strategy' },
  { time: '45 min', what: 'Lunch' },
  { time: '45 min', what: 'Content kit', step: 'content' },
  { time: '60 min', what: 'Promo videos', step: 'video' },
  { time: '15 min', what: 'Break' },
  { time: '30 min', what: 'Campaign calendar', step: 'calendar' },
  { time: '45 min', what: 'Get found + Automate it', step: 'visibility' },
  { time: '15 min', what: 'Lead tracker', step: 'tracker' },
  { time: '30 min', what: 'Action plan, then share one win with the room', step: 'action-plan' },
];

export const TRACKER_INSIGHTS = `${CONTEXT}

Read business/tracker.json (my leads and sales) and business/strategy.md. Tell me in chat (don't write a file): what's converting and what isn't, by source and stage; which leads to follow up with today and a suggested message for each; and one change to make this week. Keep it short.`;

// Video presets: sensible starting briefs for a small business holiday promo.
export const VIDEO_PRESETS = [
  { id: 'offer', label: 'Holiday offer', what: 'A short, punchy promo for our holiday offer. Hook in the first 2 seconds, show the product, end on the offer and call-to-action.', length: '15–30s', format: 'vertical' },
  { id: 'spotlight', label: 'Product spotlight', what: 'Show one product up close: what it is, who it’s for, why it makes a great gift. End with where to buy.', length: '20–40s', format: 'vertical' },
  { id: 'testimonial', label: 'Customer story', what: 'A happy customer in their own words. Keep their best lines, cut everything else, add their name on screen.', length: '30–60s', format: 'square' },
  { id: 'bts', label: 'Behind the scenes', what: 'How we make or prepare things for the holidays. Warm, human, quick cuts. End with the offer.', length: '30–45s', format: 'vertical' },
];
export const VIDEO_FORMATS = {
  vertical: 'Vertical 9:16 (Reels, TikTok, Shorts, Stories)',
  square: 'Square 1:1 (feed posts)',
  wide: 'Wide 16:9 (YouTube, website, email)',
};
