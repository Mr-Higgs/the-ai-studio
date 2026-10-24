# Studio — agentic campaign workshop

Templated workflow. Answers in, finished campaign out. Two tools, the agent routes
between them from their skills — this file is the whole "workflow", there is no glue code.

## Tools (each wired in differently)
- **HeyGen** — Studio calls the API directly (`HEYGEN_API_KEY` in `.env`). Makes avatar
  presenter videos; finished MP4s are imported into `projects/<name>/raw/heygen-<id>.mp4`.
- **LinkedIn** — project MCP in `.devin/mcp_config.json`: `linkedin` (`mcp/linkedin.mjs`, stdlib stdio server,
  `LINKEDIN_ACCESS_TOKEN` in `.env`) posts as the user, only text they approved; `microsoft-learn` searches LinkedIn API docs.

## UI — Growth Sprint workspace (Holiday Growth Sprint / Growth Hack Sprint)
`npm run studio` → http://localhost:4321. Builds the Vite + React app in `ui/web/` into `ui/dist/`,
then serves it from `ui/server.mjs` (Node stdlib). The server drives the agent over ACP: Devin
(`devin acp`) by default, Claude Code via `@agentclientprotocol/claude-agent-acp` (switch in the UI,
or `STUDIO_AGENT=claude`). Hot reload while developing: `node ui/server.mjs` + `npm run dev`
(Vite on :5173 proxies to :4321).

The UI walks a small business owner through the workshop. Two sprints share the same steps and files; only
the wording differs (`SPRINTS` in steps.js, picked per business in `business/sprint.json`, missing = holiday). Each step's inputs and agent prompt
live in `ui/web/src/steps.js`; edit prompts there. Everything is saved in `business/`
(gitignored). That's the *active* business. Other profiles are parked in `businesses/<id>/`, and the rail's
Business picker (`/api/businesses/new|switch`) moves files between them, so every `business/...` path
stays valid. Each business carries its own chat (`.session`, `.sessions.json`). Video projects in `projects/` are
shared across businesses. Files in `business/`:
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
- Promo videos: Studio writes the script, the video is made in HeyGen (avatar + script +
  aspect in the UI), the MP4 is imported to `projects/<name>/raw/` and attached to
  calendar items via the optional `"video"` field.

Setup checks (and the per-OS install commands) are `setupItems()`/`health()` in `ui/server.mjs`;
the Devin account / promo-code text is `SETUP_ACCOUNT` in `ui/web/src/steps.js`. Mac + Windows supported.
Setup also lists Devin MCP servers (`devin mcp list`) and plugins (CLI plugin cache) via
`GET /api/integrations`; the add-more how-to copy is `SETUP_INTEGRATIONS` in steps.js.

Agent state: one session for the business (`business/.session`), one per video project
(`projects/<name>/.session`); `.agent` stores the chosen agent. All gitignored.

## Hosted mode
`STUDIO_HOSTED=1` turns single-user Studio into a multi-tenant app: email+password
accounts (scrypt, invite code required), cookie sessions, and a per-user workspace at
`DATA_DIR/users/<uid>` — agent `cwd`, `business/`, `projects/`, `.env` and `home/` (the
devin process HOME) all live there; `CLAUDE.md`, `mcp/` and `.devin/{config,mcp_config,skills}`
are symlinked back to the repo. Devin sign-in goes through `/api/setup/devin/login` →
`/code`: the server relays `devin auth login --force-manual-token-flow` inside a `script`
pty (needs `\r` to submit; plain pipes fail) and stores credentials in the user's `home/`.
Env vars: `STUDIO_HOSTED`, `DATA_DIR`, `STUDIO_PUBLIC_URL` (enables the Host check +
Secure cookies), `STUDIO_INVITE_CODE` (unset = registration closed), `STUDIO_ISOLATE`
(=1 + root → per-user `studio-<uid>` OS users, chowned writes, uid/gid spawns),
`STUDIO_SANDBOX` (=1 → `devin --sandbox acp`), `STUDIO_IDLE_MIN`, `STUDIO_QUOTA_MB`, `PORT`.

## Pipeline (per video project)
Start a job: `cp -r projects/_template projects/<name>` (the UI's New video does this).

1. **Script** — the agent writes a HeyGen presenter script from `business/offer.md`
   ("Write the script" button); the user pastes it into the avatar form.
2. **HeyGen** — "Make an avatar video" renders it (`POST /api/projects/<name>/heygen/generate`,
   polled until completed, then auto-imported). Videos the user made in their own HeyGen
   account are imported via "Import from HeyGen". Either way the MP4 lands in
   `projects/<name>/raw/heygen-<id>.mp4` — that IS the deliverable.
3. **Place it** — the agent attaches the video to calendar items with the optional
   `"video": "projects/<name>/raw/<file>.mp4"` field in `business/calendar.json`;
   the UI renders it as a "▶ video" link.

## Hard rules
- Project files go under `projects/<name>/` only — never the repo root.
- One project = one folder under `projects/`.
