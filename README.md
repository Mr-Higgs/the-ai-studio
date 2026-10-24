# Holiday Growth Sprint

Build an AI-powered holiday sales campaign for your own business, with Devin as your
campaign partner. You fill in what you know, Devin writes the rest, and everything you
make stays on your computer in the `business/` folder.

By the end you'll have:

| Step | What you walk away with |
|---|---|
| Business profile | The basics Devin uses for every step |
| Holiday offer | A clear holiday offer and target customer |
| Customer conversations | What customers say on Reddit and forums, in their words, plus community-friendly growth plays |
| Strategy & messaging | Where to show up, what to say, calls-to-action that convert |
| Content kit | Ready-to-post social captions, emails and ads |
| Promo videos | A HeyGen avatar script written for you, the video pulled into your campaign |
| Campaign calendar | A 30–60 day calendar you tick off as you post |
| Get found | Search, Google Maps and AI-assistant visibility fixes |
| Automate it | The repetitive tasks to hand off, with setup steps |
| Lead tracker | Leads, customers, win rate and revenue in one place |
| Action plan | Your launch checklist and weekly routine |

## Using Studio

Studio is hosted — your facilitator gives you a web address and an invite code.

1. Open the address and **Create account** with your email, a password and the invite code.
2. Go to **Setup** and paste your **Devin API key** (`cog_…`) and **Organization ID**
   from Devin → Settings → Devin API (create a Personal access token, or a Service user
   with the Member role). This runs the assistant on your own Devin account and usage.
3. Optional: paste your **HeyGen API key** to make/import avatar videos in the Promo
   videos step.
4. Open **Start here** and follow the steps — each one is written for you by Devin, and
   everything is saved to your account.

## Start

```bash
npm run dev:api   # or see DEPLOY.md for the hosted deployment
```

Open http://localhost:4321. **Start here** explains the day and its agenda, then sends you to your first step. Steps work in any order: start with a promo video if that's what you've got. Each step says what it builds on, and flags when an earlier step has changed. If something isn't installed,
**Setup** in the sidebar shows exactly what's missing and the command to fix it.

How each step works:

1. Fill in the few questions at the top. Blanks are fine.
2. Click **Write it with Devin**. Devin may ask you a question in the chat on the right first.
3. Read the result, then ask for changes in the chat: "shorter", "more playful", "add a gift-card option".
4. When Devin needs to run something on your computer, a card asks for your OK. **Allow** runs it once.

To use Claude Code instead of Devin, change **Assistant** at the bottom of the sidebar.

When you're done, **Download my sprint** (bottom of the sidebar) saves everything as one document.
Before Devin rewrites a step, the old version is kept under **Previous versions**.

## Edit the sprint

Everything participants see and everything Devin is asked to do is in **`ui/web/src/steps.js`**:

- `STEPS`: the order, titles, one-line blurbs, the questions on each step (`inputs`), the
  "How to do this step" box (`guide`: time, why, done-looks-like, tips), what each step
  builds on (`uses`) and the exact prompt sent to Devin (`prompt`).
- `AGENDA`: the full-day schedule on the Start here page.
- `SETUP_ACCOUNT` and `SETUP_INTEGRATIONS`: the Devin account note and the "add more tools"
  how-to cards on the Setup page.
- `VIDEO_FORMATS`: the aspect-ratio labels in the avatar form.
- `TRACKER_INSIGHTS`: what "Ask Devin what to do next" sends.

Restart `npm run dev:api` after editing. The Start here page text is in `ui/web/src/components/Guide.jsx`.

## Hosted version

Studio also runs as a multi-user hosted app (`STUDIO_HOSTED=1`): per-user accounts,
workspaces and Devin sign-in, so participants only need a browser and their own Devin
and HeyGen accounts. See `DEPLOY.md` for how to run it.

## For facilitators

- Hosting and local development: `DEPLOY.md`.
- Architecture and file contracts: `CLAUDE.md`.
