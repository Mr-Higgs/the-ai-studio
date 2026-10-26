# Workshop questions — Holiday Growth Sprint

Every question field shown in workshop steps 1–11 under the `holiday` sprint, keyed exactly as the app stores answers.

Storage: `profile.*` → `businesses.profile`; `inputs.<step>.*` → `businesses.inputs`. `checks` values are stored as arrays of option strings; `date` as YYYY-MM-DD.

## 1. Business profile (`profile`)

The basics and the numbers Devin uses for every step: what you sell, what your time is worth, what it costs to run, and what a customer is worth.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `profile.name` | Business name | text | e.g. Juniper & Wick Candle Co. |
| `profile.location` | Where you sell | text | e.g. Austin, TX + ships nationwide |
| `profile.sells` | What you sell | textarea | Products or services, in a sentence or two |
| `profile.customers` | Who buys from you today | textarea | e.g. Women 30–55 buying gifts, local offices ordering client gifts |
| `profile.price` | Average sale | text | e.g. $48 |
| `profile.website` | Website | text | https://… |
| `profile.socials` | Social handles | text | e.g. @juniperwick on Instagram and TikTok |
| `profile.proof` | Reviews, awards or numbers you’re proud of | text | e.g. 4.9★ on Etsy, 300+ reviews |
| **Your time and pay** |  |  |  |
| `profile.hoursWeek` | Hours you work in the business each week | text | e.g. 45 — include admin, messages, deliveries |
| `profile.payGoal` | What you want to take home from the business per year ($) | text | e.g. 60000 |
| `profile.rate` | What an hour of your time is worth ($/hour) | text | e.g. 30 |
| `profile.replaceRate` | What you’d pay someone else to do your work ($/hour) | text | e.g. 22 |
| **Running costs in a typical month** |  |  |  |
| `profile.revenueMonth` | Sales ($) | text | e.g. 6000 |
| `profile.laborMonth` | Staff and contractor pay — not your own ($) | text | e.g. 0 if it’s just you |
| `profile.materialsMonth` | Materials, stock and supplies ($) | text | e.g. 1800 |
| `profile.overhead` | Other running costs — rent, software, insurance, utilities, fees ($) | text | e.g. 450 |
| **Customers over time** |  |  |  |
| `profile.newMonth` | New customers in a typical month | text | e.g. 25 |
| `profile.cac` | What it costs to win one new customer — ads, samples, discounts (CAC, $) | text | marketing spend ÷ new customers |
| `profile.buysPerYear` | How many times a customer buys from you per year | text | e.g. 3 |
| `profile.years` | How many years a customer usually stays | text | e.g. 2 |
| `profile.ltv` | What a typical customer spends with you over time (lifetime value, $) | text | leave blank and the app works it out |

## 2. Holiday offer (`offer`)

One offer so clear and valuable that the right customer feels silly saying no — and a sharp picture of who that customer is.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.offer.sell` | What do you want to sell more of this season? | textarea | e.g. Gift boxes of our small-batch candles, and gift cards for last-minute shoppers |
| `inputs.offer.price` | Typical price range | text | e.g. $35–$120 |
| `inputs.offer.window` | Campaign window | text | e.g. Nov 20 – Dec 23 |

## 3. Customer conversations (`research`)

What your customers are already saying — in Reddit threads, Google and Yelp reviews (yours and your competitors’), Nextdoor and local groups — in their words, and where you can genuinely show up.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.research.keywords` | What would people search or ask about? | text | e.g. candle gift ideas, gifts for coworkers under $50, best soy candles |
| `inputs.research.who` | Who are you listening for? | text | e.g. people buying gifts for mom, office managers |
| `inputs.research.subs` | Subreddits you already know (optional) | text | e.g. r/GiftIdeas, r/candles, r/Austin |
| `inputs.research.competitors` | Up to 3 competitors whose reviews are worth reading (optional) | text | e.g. Joe’s Auto, Midas on Main St |

## 4. Get found locally (`visibility`)

Show up when people nearby search Google, Maps and AI assistants for what you do — and know which numbers prove it.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.visibility.gbp` | Google Business Profile | select | Yes, and it’s up to date, Yes, but neglected, No, Not sure |
| `inputs.visibility.services` | Services or products you want to be found for, most profitable first | textarea | e.g. brake repair, collision repair, AC service |
| `inputs.visibility.area` | City and the neighborhoods or suburbs you serve | text | e.g. Decatur, GA — Oakhurst, Kirkwood, Avondale |
| `inputs.visibility.competitors` | Up to 3 competitors (names or websites), optional | text | e.g. Joe’s Auto, Midas on Main St |
| `inputs.visibility.tracking` | What you already track | checks | Google Business Profile insights, Google Analytics, Search Console, Call tracking, None |

## 5. Strategy & messaging (`strategy`)

Where to show up, what to say, and the calls-to-action that turn attention into inquiries and sales.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.strategy.goal` | Holiday goal | text | e.g. 40 orders and $4,000 in sales by Dec 24 |
| `inputs.strategy.budget` | Marketing budget for the season | text | e.g. $0, $200, $1,000 |
| `inputs.strategy.channels` | Where you reach customers today | checks | Google Business Profile, Google Search / Maps, Yelp, Nextdoor, Facebook, Instagram, TikTok, Email / SMS list, Website, Phone call, Walk-in / signage, Referral / partners, Reddit |

## 6. Content kit (`content`)

Ready-to-post captions, emails and ads written in your voice, for the channels in your strategy.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.content.channels` | Write for | checks | Google Business Profile, Google Search / Maps, Yelp, Nextdoor, Facebook, Instagram, TikTok, Email / SMS list, Website, Reddit |
| `inputs.content.voice` | Your brand voice | text | e.g. warm, a little funny, never pushy |
| `inputs.content.words` | Words or claims to avoid | text | optional |

## 7. Promo videos (`video`)

Pick a post from your content kit, turn it into a spoken script, make the video in HeyGen with your avatar, and bring it back into your campaign.

_No inputs — this step is UI-only._

## 8. Campaign calendar (`calendar`)

Every post and email on a date, so the campaign runs itself. Tick things off as they go out.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.calendar.start` | Start date | date |  |
| `inputs.calendar.days` | Length | select | 30 days, 45 days, 60 days |
| `inputs.calendar.pace` | How much can you post? | select | 2–3 times a week, 4–5 times a week, Every day |

## 9. Automate it (`automation`)

Hand repetitive work — replies, follow-ups, reminders, posting — to tools and AI, so you can sell.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.automation.tools` | Tools you already use | text | e.g. Shopify, Square, Gmail, Instagram, Calendly, Mailchimp |
| `inputs.automation.chores` | What eats your time every week? | textarea | e.g. answering the same DMs, chasing quotes, posting every day |

## 10. Lead tracker (`tracker`)

Every inquiry, customer and sale in one place, so you know what’s working and who to follow up with.

_No inputs — this step is UI-only._

## 11. Action plan (`action-plan`)

Your launch checklist and weekly routine for after today — what to do, when, and how to improve it.

| Key | Label | Type | Options / placeholder |
| --- | --- | --- | --- |
| `inputs.action-plan.hours` | Hours per week you can give this | text | e.g. 4 |
| `inputs.action-plan.launch` | Launch date | date |  |
| `inputs.action-plan.help` | Anyone helping you? | text | e.g. my partner on weekends, a part-time assistant |

