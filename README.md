# Studio — Growth Sprint

A hosted workshop app: a small business owner works through a guided marketing sprint
in the browser, and Devin writes each step's documents. Everything is saved to their
account.

By the end you'll have:

| Step | What you walk away with |
|---|---|
| Business profile | The basics Devin uses for every step |
| Core offer | A clear offer and target customer |
| Customer conversations | What customers say on Reddit, forums and review sites, in their words, plus community-friendly growth plays |
| Get found locally | Website fixes, a Google Business Profile fix list, search phrases mapped to pages, and the numbers that prove it's working |
| Strategy & messaging | Where to show up, what to say, calls-to-action that convert |
| Content kit | Ready-to-post social captions, emails and ads |
| Promo videos | A HeyGen avatar script written for you, the video pulled into your campaign |
| Campaign calendar | A 30-day calendar you tick off as you post |
| Automate it | The repetitive tasks to hand off, with setup steps |
| Lead tracker | Leads, customers, win rate and revenue in one place |
| Action plan | Your launch checklist and weekly routine |

## Using Studio

Your facilitator gives you a web address.

1. Open the address and **Create account** with your email and a password.
2. Go to **Setup** and paste your **Devin API key** (`cog_…`) and **Organization ID**
   from Devin → Settings → Devin API (create a Personal access token, or a Service user
   with the Member role). This runs the assistant on your own Devin account and usage.
3. Optional: connect your **HeyGen account** (or paste an API key) to make/import avatar
   videos in the Promo videos step.
4. Open **Start here** and follow the steps — each one is written for you by Devin, and
   everything is saved to your account.

How each step works:

1. Fill in the few questions at the top. Blanks are fine.
2. Click **Write it with Devin**. Devin may ask you a question in the chat on the right first.
3. Read the result, then ask for changes in the chat: "shorter", "more playful", "add a gift-card option".

When you're done, **Download my sprint** (bottom of the sidebar) saves everything as one document.
Before Devin rewrites a step, the old version is kept under **Previous versions**.

## Local development

```bash
npm run build && npm run dev:api   # API + built UI on :4321, env from .env
```

## Edit the sprint

Everything participants see and everything Devin is asked to do is in **`ui/web/src/steps.js`**:

- `STEPS`: the order, titles, one-line blurbs, the questions on each step (`inputs`), the
  "How to do this step" box (`guide`: time, why, done-looks-like, tips), what each step
  builds on (`uses`) and the exact prompt sent to Devin (`prompt`).
- `AGENDA`: the full-day schedule on the Start here page.
- `SETUP_ACCOUNT`: the Devin account note on the Setup page.
- `VIDEO_FORMATS`: the aspect-ratio labels in the avatar form.
- `TRACKER_INSIGHTS`: what "Ask Devin what to do next" sends.

Restart `npm run dev:api` after editing. The Start here page text is in `ui/web/src/components/Guide.jsx`.

## For facilitators

- Hosting and deployment: `DEPLOY.md`.
- Architecture and file contracts: `CLAUDE.md`.
