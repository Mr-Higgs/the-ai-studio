# Studio — agentic video pipeline

Templated workflow. Raw files in, finished MP4 out. Three tools, the agent routes
between them from their skills — this file is the whole "workflow", there is no glue code.

## Tools (each wired in differently)
- **HeyGen** — Claude Code MCP + skills plugin (`mcp__plugin_heygen_heygen__*`). Generates
  presenter / avatar / voiceover clips.
- **video-use** — skill at `.claude/skills/video-use/` (Python/uv). Trims fillers & silence,
  color-grades, burns subtitles, composites the final render. Needs `ELEVENLABS_API_KEY` in `.env`.
- **HyperFrames** — plugin (`hyperframes:*`), npm dep `hyperframes`. HTML/CSS/JS → deterministic MP4
  for title cards, lower-thirds, animated overlays.

## UI — Holiday Growth Sprint workspace
`npm run studio` → http://localhost:4321. Builds the Vite + React app in `ui/web/` into `ui/dist/`,
then serves it from `ui/server.mjs` (Node stdlib). The server drives the agent over ACP: Devin
(`devin acp`) by default, Claude Code via `@agentclientprotocol/claude-agent-acp` (switch in the UI,
or `STUDIO_AGENT=claude`). Hot reload while developing: `node ui/server.mjs` + `npm run dev`
(Vite on :5173 proxies to :4321).

The UI walks a small business owner through the workshop. Each step's inputs and agent prompt
live in `ui/web/src/steps.js`; edit prompts there. Everything is saved in `business/`
(gitignored, one business per clone):
- `profile.json`, `inputs.json` (each step's answers), `tracker.json` — written by the UI only
- `calendar.json` — written by the agent (schema pinned in steps.js), status ticked in the UI;
  the server drops malformed items and reports `calendarIssues`
- `offer.md`, `research.md`, `strategy.md`, `content.md`, `visibility.md`, `automation.md`,
  `action-plan.md` — written by the agent
- `history/<name>-<UTC stamp>.<ext>` — the server snapshots a doc before each rewrite
- `GET /api/business/export.md` — everything in one Markdown file
- Offer step uses the `.devin/skills/grand-slam-offer` skill. Customer conversations
  (`research.md`) is Reddit research via the agent's built-in web search/fetch only — no
  scraping, no Reddit API (closed to self-service; marketing use is commercial).
- Steps work in any order: `uses` in steps.js drives the "Builds on" and "out of date" notices.
- Promo videos are regular `projects/<name>/` jobs (pipeline below); briefs pull the offer from `business/offer.md`.

Setup checks (and the per-OS install commands) are `setupItems()`/`health()` in `ui/server.mjs`;
the Devin account / promo-code text is `SETUP_ACCOUNT` in `ui/web/src/steps.js`. Mac + Windows supported.

Agent state: one session for the business (`business/.session`), one per video project
(`projects/<name>/.session`); `.agent` stores the chosen agent. All gitignored.

## Pipeline
Start a job: `cp -r projects/_template projects/<name>`.

0. **HeyGen (optional)** — if the request needs a presenter/avatar/voiceover, generate it and
   save the clip into `projects/<name>/raw/`. Skip if the user supplied all footage.
   Videos the user made in their own HeyGen account are imported in the UI (Footage → Import
   from HeyGen, `HEYGEN_API_KEY` in `.env`, saved from Setup) and land as `raw/heygen-<id>.mp4`. Use those first.
   Footage → "Make an avatar video" renders a script on one of the user's own avatars and imports
   the result the same way. Keys are saved from the Setup page into `.env`.
1. **video-use** — edit everything in `projects/<name>/raw/`: cut fillers/silence, grade, subtitle.
   Session state → `projects/<name>/project.md`. Edited cut → `projects/<name>/out/`.
2. **HyperFrames** — build title cards / overlays as HTML in `projects/<name>/compositions/`;
   `npx hyperframes preview` then `render`. Output → `projects/<name>/out/`.
3. **Composite** — video-use's render step ffmpeg-assembles edited cut + rendered animations
   into the final MP4 in `projects/<name>/out/`.

## Hard rules
- Renders go to `projects/<name>/out/` only — never the repo root.
- One project = one folder under `projects/`.
- Don't edit anything in `.claude/skills/video-use/` (it's an upstream clone).
