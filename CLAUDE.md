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
- **Supabase**: auth.users + tables `user_settings` (encrypted keys), `businesses`
  (one `is_active` per user, holds sprint/profile/inputs/tracker/calendar/brain JSON),
  `docs` (per-kind markdown), `doc_history`, `agent_sessions` (Devin session per scope),
  `projects`; private storage bucket `videos` under `<uid>/<project>/`. RLS on everything.
- **Devin**: v3 `POST /v3/organizations/{org}/sessions` with `structured_output_schema` —
  the agent returns `{"files": {"offer.md": "…", "calendar.json": [...]}}` which the server
  applies to docs/calendar on poll (`applied_hash` dedups; changed docs are snapshotted to
  doc_history first). Poll = `GET /api/agent/<scope>/poll?cursor=<event_id>`; UI polls
  every 4 s while busy. `sendMessage` continues a live session; a new session is created
  (with the full business context inlined) only when the old one is expired/finished/etc.
- Local dev: `npm run dev:api` (dev/server.mjs: .env → env, /api → handler, static ui/dist).

## The agent contract (api/_lib/prompts.js)
Devin cloud sessions have no filesystem. `buildContext` inlines the business profile, step
answers, tracker, every existing doc (12k-char cap each) and the calendar into the first
prompt; `OUTPUT_CONTRACT` tells it to write results back through `files` in the structured
output and never say "saved to business/…". Per-step prompt text lives in
`ui/web/src/steps.js` (`STEPS`, `SPRINTS`, `PHASES`, `AGENDA`); the offer step inlines
`.devin/skills/grand-slam-offer/SKILL.md` (bundled via vercel.json `includeFiles`).

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

## Env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
(service role), `STUDIO_SECRET_KEY` (64 hex, key encryption), optional `DEVIN_API_KEY` + `DEVIN_ORG_ID`
(shared fallback), `DEVIN_MAX_ACU`, `PORT` (dev only).

## Hard rules
- Never log or return user API keys; they only travel user → /api/setup/env → ciphertext.
- All queries filter `user_id` on top of RLS.
- No LinkedIn autopilot or local video editing in this version (HeyGen API only).
