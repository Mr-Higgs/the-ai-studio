# Studio — agentic campaign workshop

Templated workflow. A hosted web app that walks a small business owner through a marketing
sprint; Devin (cloud API) writes each step's documents. This file is the architecture map.

## Stack
- **UI**: Vite + React in `ui/web/` → built to `ui/dist`, deployed on Vercel.
- **API**: one Vercel Node function, `api/index.js` — a stdlib-style router dispatching on
  `req.url` parts. Helpers in `api/_lib/`: `supabase.js` (service-role client + Bearer
  `userFromReq`), `secrets.js` (AES-256-GCM `enc`/`dec` for user API keys under
  `STUDIO_SECRET_KEY`), `business.js` (business state + cleanCalendar + export), `devin.js`
  (v3 org-sessions client), `prompts.js` (context builder + output contract + schema).
- **Supabase**: auth.users + tables `user_settings` (encrypted keys; `heygen_oauth` and
  `google_oauth` hold encrypted OAuth tokens and are preferred over `heygen_api_key`), `businesses`
  (one `is_active` per user, holds sprint/profile/inputs/tracker/calendar/brain JSON,
  `lead_token` for the public lead form, and per-field `profile/calendar/tracker_updated_at`
  timestamps that drive the "changed" notices instead of the shared `updated_at`),
  `docs` (per-kind markdown), `doc_history`, `agent_sessions` (Devin session per scope),
  `projects`; private storage bucket `videos` under `<uid>/<project>/`. RLS on everything.
- **Devin**: v3 `POST /v3/organizations/{org}/sessions` with `structured_output_schema` —
  the agent returns `{"files": {"offer.md": "…", "calendar.json": [...]}}` which the server
  applies to docs/calendar on poll (`applied_hash` dedups; changed docs are snapshotted to
  doc_history first). Poll = `GET /api/agent/<scope>/poll?cursor=<event_id>`; UI polls
  every 4 s while busy, every 60 s when idle, not in hidden tabs, and backs off on Devin 429s
  (`api/_lib/devin.js` retries short 429s itself, else returns 429 + `retryAfter`). `sendMessage` continues a live session; a new session is created
  (with the full business context inlined) only when the old one is expired/finished/etc.
- **Lead form**: public `GET/POST /api/lead/<token>` (api/_lib/leads.js) appends to
  `businesses.tracker`; `?exp=<id>&src=<channel>` tag the row; URL is inlined into Devin
  context as the CTA link.
- Local dev: `npm run dev` (vite :5173; also spawns dev/server.mjs :4321 with `--watch`, skip via
  `STUDIO_NO_API=1`). `npm run dev:api` alone runs the API + static ui/dist (.env → env, /api → handler).

## The agent contract (api/_lib/prompts.js)
Devin cloud sessions have no filesystem. `buildContext` inlines the business profile, step
answers, tracker, every existing doc (40k-char cap each) and the calendar into the first
prompt; `OUTPUT_CONTRACT` tells it to write results back through `files` in the structured
output and never say "saved to business/…". Per-step prompt text lives in
`ui/web/src/steps.js` (`STEPS`, `SPRINTS`, `PHASES`, `AGENDA`; step order: profile, offer,
research, visibility, strategy, content, video, calendar, automation, tracker, action-plan;
default sprint is growth); the offer step inlines
`.devin/skills/grand-slam-offer/SKILL.md` (bundled via vercel.json `includeFiles`).
The content step also returns `posts.json` (a per-post structured copy saved to
`businesses.posts`); the video step prefills HeyGen scripts from Facebook/Instagram posts
(`ui/web/src/posts.js`, with a markdown fallback parser for older kits), and a finished
video is linked back via `post.video` / `calendarItem.video` = `{project, file}`.
The **Your website** step (`kind: 'site'`, `SiteStep.jsx`) is different: `POST /api/site/start` creates a plain interactive Devin session (no structured output) in the user's org with the context + `.devin/skills/site-build` + `anti-generic-audit` inlined (`siteSkill`), stores its `url` in `agent_sessions` (scope `site`, `devin_url`), and the UI opens it in a new tab; the owner works with Devin there, not in Studio's chat.

## Business Brain (`ui/web/src/brain.js`, `#brain`)
Questions (8 sections, each answer tagged known/estimate/help), the offer math (`brainMath`) and
how Devin reads it (`brainContext`, inlined by `buildContext`). Pure JS, shared by UI and API.
The Business profile step's fields (`PROFILE_FIELDS`: basics, time and pay, monthly costs,
customers over time) live there too; Brain questions with `profile: <id>` edit the same profile value.
Saved as `businesses.brain` with its own `brain_updated_at`; steps that list `'brain'` in `uses`
show "changed" when it moves. Guided number help returns confirmed values through `answers.json`,
which `mergeDevinAnswers` applies only to blank or help-tagged answers. The graph (`BrainGraph.jsx`, react-force-graph-2d) is lazy-loaded.
Meta MCP servers are added in the user's Devin org; `user_settings.integrations` only toggles the
prompt notes (`INTEGRATIONS` in api/index.js).
- **HeyGen auth** (`api/_lib/heygen-oauth.js`): OAuth via api2.heygen.com — dynamic client
  registration, PKCE S256, `scope=openid profile email` and no `resource` (HeyGen rejects
  `https://api.heygen.com`; its CLI omits it), callback at the unauthenticated
  `GET /api/heygen/oauth/callback` (the pending row's `state` identifies the user) — bills the
  user's *plan* credits. An API key bills separate *API* credits; `heygenAuth()` picks OAuth
  first and refreshes the token on demand, falling back to `X-Api-Key`.
- **Google Business Profile** (`api/_lib/google-oauth.js`): standard Google OAuth (web client,
  offline access, scope business.manage); the chosen location's summary is inlined into Devin
  context as the authoritative NAP (`gbp` part). GBP APIs need Google's per-project approval —
  until then calls return quota errors, stored as `pending_approval`.

## Env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
(service role), `STUDIO_SECRET_KEY` (64 hex, key encryption), `DEVIN_MAX_ACU`
(no shared Devin key: each user saves their own key + Org ID, used only as a pair), `PORT` (dev only), optional `HEYGEN_OAUTH_CLIENT_ID` +
`HEYGEN_OAUTH_RESOURCE` (HeyGen OAuth overrides), optional `PUBLIC_ORIGIN` — canonical https
origin used for the HeyGen OAuth callback on non-localhost hosts, optional `GOOGLE_OAUTH_CLIENT_ID` +
`GOOGLE_OAUTH_CLIENT_SECRET` (Google Business Profile connection; the Setup row shows
"coming soon" until both are set).

## Hard rules
- Never log or return user API keys or OAuth tokens; they only travel user → /api/setup/env → ciphertext (or the OAuth token endpoint → ciphertext).
- All queries filter `user_id` on top of RLS.
- No LinkedIn autopilot or local video editing in this version (HeyGen API only).
