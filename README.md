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
| Promo videos | Raw phone footage edited into a polished promo |
| Campaign calendar | A 30–60 day calendar you tick off as you post |
| Get found | Search, Google Maps and AI-assistant visibility fixes |
| Automate it | The repetitive tasks to hand off, with setup steps |
| Lead tracker | Leads, customers, win rate and revenue in one place |
| Action plan | Your launch checklist and weekly routine |

## Before the workshop

Do this at home the day before. It takes about 20 minutes. On a **Mac**, run commands in
**Terminal**. On **Windows**, run them in **PowerShell**, not Command Prompt.

<!-- FACILITATOR: add the Devin sign-up link and how to redeem the promo code here,
     and in SETUP_ACCOUNT in ui/web/src/steps.js (shown on the in-app Setup page). -->
**1. Create your Devin account** and redeem the promo code you were given.

**2. Install Node.js** (version 20 or newer).
- Mac: download the LTS installer from [nodejs.org](https://nodejs.org), or `brew install node`
- Windows: `winget install OpenJS.NodeJS.LTS`
- Check: `node -v`

**3. Install git.**
- Mac: run `git --version`. If git is missing, macOS offers to install it. Click Install.
- Windows: `winget install Git.Git`

**4. Install the Devin CLI.**
- Mac: `curl -fsSL https://cli.devin.ai/install.sh | bash`
- Windows: `irm https://static.devin.ai/cli/setup.ps1 | iex`
- **Close the window and open a new one**, then check: `devin --version`

**5. Sign in** with the account from step 1: `devin auth login`
- Check: `devin auth status` should say **Logged in**.

**6. Get the workshop files.**
```bash
git clone <workshop repo URL>
cd studio
npm install
```

**7. Promo videos only (optional).** Skip this if you won't edit video. Every other step works without it.
- Mac: `brew install ffmpeg uv` (no Homebrew? Install it from [brew.sh](https://brew.sh) first)
- Windows: `winget install Gyan.FFmpeg astral-sh.uv`
- Both: `git clone https://github.com/browser-use/video-use .claude/skills/video-use`
- ElevenLabs key for transcription: `cp .env.example .env` (Windows: `copy .env.example .env`), then paste your key into `.env`.
- Video editing is tested on Mac; on Windows it may need help from the facilitator.

**If something goes wrong**
- *"command not found"* right after installing: open a new Terminal or PowerShell window.
- *Windows: "irm is not recognized"*: you're in Command Prompt or Git Bash. Open PowerShell.
- *On a work laptop with a proxy or firewall*: installs may be blocked. Ask your IT team, or bring a personal laptop.
- The app's **Setup** page (bottom of the sidebar) checks all of this and shows the exact command for your computer.

## Start

```bash
npm run studio
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
- `VIDEO_PRESETS` and `VIDEO_FORMATS`: the promo video briefs.
- `TRACKER_INSIGHTS`: what "Ask Devin what to do next" sends.

Restart `npm run studio` after editing. The Start here page text is in `ui/web/src/components/Guide.jsx`.

## For facilitators

- Hot reload while editing the UI: `node ui/server.mjs` in one terminal and `npm run dev` in another, then open http://localhost:5173.
- Architecture and file contracts: `CLAUDE.md`.
