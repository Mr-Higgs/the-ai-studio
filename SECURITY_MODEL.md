# Threat model: Mr-Higgs/the-ai-studio (Studio)

_Built from the code at `main` (6022878) plus Jerry's answers on 2026-10-28. No infrastructure repo exists: Vercel and Supabase are configured in their dashboards, with `vercel.json` and `supabase/migrations/` as the only config in code._

## System overview and trust boundaries
Studio is a multi-tenant SaaS (https://the-ai-studio.vercel.app). Small business owners sign up and work through marketing sprints. Devin (cloud v3 API, running on **the user's own** Devin org and key, or on the operator's optional shared `DEVIN_API_KEY`/`DEVIN_ORG_ID` fallback in `devinCreds`) writes each step's documents.

- **Browser → API**: the React SPA (`ui/web/src`) signs in with Supabase Auth (magic link, Google, email + password) and calls `/api/*` with a Supabase access token as `Authorization: Bearer`. The SPA does not query Supabase tables directly.
- **API → Supabase**: one Vercel function, `api/index.js`, uses the **service-role** client (`api/_lib/supabase.js` `admin()`), which bypasses RLS. Tenant isolation therefore depends on every query filtering on `user_id = uid` (hard rule in `CLAUDE.md`). RLS policies (`own …` in `0001_init.sql`) are defense in depth, used only when a client holds the anon key.
- **API → third parties**: Devin v3 (`api/_lib/devin.js`), HeyGen (`heygen-oauth.js` plus the `heygen()` passthrough), Meta Marketing/Instagram Graph (`meta.js`), and Google Business Profile (`google-oauth.js`). Each call is made with the **user's** decrypted credential.
- **Devin session → Studio**: the agent's structured output (`files{…}`) is applied server-side to docs, calendar, experiments, posts and profile/brain answers (`applyOutput`, `applyStructuredOutput` in `prompts.js`, `mergeDevinAnswers`). Devin's output is untrusted input: it can be steered by prompt injection.
- **Untrusted content → Devin context**: lead-form submissions (tracker), competitor sites read via MCPs, Meta/Instagram/GBP data and docs are all inlined into Devin prompts (`contextParts`, `buildContext`).

## Major components
| Component | Covers |
|---|---|
| **web-client** | `ui/web/src/**` (SPA, Supabase auth client, `api.js`, markdown/HTML rendering, OAuth popup `postMessage` listeners) |
| **api-router** | `api/index.js` routing and authz, `api/_lib/business.js` (business state, switch/new, export, history) |
| **auth-and-secrets** | `api/_lib/supabase.js` (`userFromReq`), `api/_lib/secrets.js` (AES-256-GCM under `STUDIO_SECRET_KEY`), `/api/setup/env`, `/api/setup/meta`, `user_settings` key columns |
| **integrations-oauth** | `api/_lib/heygen-oauth.js`, `api/_lib/google-oauth.js`, `api/_lib/meta.js`, `api/_lib/devin.js`, the OAuth start/callback/disconnect routes and the HeyGen video import into storage |
| **public-lead-form** | `api/_lib/leads.js`, `GET/POST /api/lead/<token>`, lead-token rotation |
| **devin-agent** | `api/_lib/prompts.js` (context, output contract, structured output apply), `/api/agent/*`, `/api/site/*`, `/api/setup/integration/*/devin`, `.devin/skills/**` |
| **database** | `supabase/migrations/**` (tables, RLS, `videos` storage bucket and policy) |
| **dev-tooling** | `dev/**` (local server, mock, screenshots), `vercel.json`, `.env.example` |

## Entry points and who can reach them
- **Anonymous internet**
  - `GET/POST /api/lead/<token>`: 24-hex token, `Access-Control-Allow-Origin: *`, writes into the owner's `businesses.tracker` through the service role. 8 KB body cap, honeypot, 500-row cap, and no rate limit.
  - `GET /api/heygen/oauth/callback` and `GET /api/google/oauth/callback`: these scan **all** `user_settings` pending rows and match `state` with `timingSafeEqual` (15 min TTL). They render HTML with `escHtml` and `postMessage(…, '*')` to the opener.
  - `GET /api/health` without a Bearer token returns a stub.
  - Supabase Auth endpoints (sign-up/sign-in) are rate-limited by Supabase, not by Studio.
  - The static SPA plus `/guide`.
- **Any signed-in user** (sign-up is open): every other `/api/*` route, authenticated by `userFromReq` (`admin().auth.getUser(token)`). This includes:
  - setup of keys and tokens
  - business CRUD (`PUT /api/business/<file>.json`, switch/new)
  - doc history by id
  - projects and the video storage list with signed URLs
  - the HeyGen passthrough (list, generate, import)
  - Google location select/sync
  - the Devin agent prompt/poll/new and site start
- **Devin (per user)**: indirectly, through its structured output that Studio applies on poll.

## Assets and data sensitivity
Per Jerry, these are all **equally critical**:
1. **Users' stored credentials**: Devin API key and Org ID, HeyGen API key and OAuth tokens, Meta system-user token and ad account, Google OAuth refresh/access tokens. All are encrypted in `user_settings` and must never be logged or returned (hard rule). `STUDIO_SECRET_KEY` and `SUPABASE_SERVICE_KEY` are the master secrets. The optional shared `DEVIN_API_KEY`/`DEVIN_ORG_ID` is a fallback that spends the operator's ACUs.
2. **Business data**: docs, doc_history, Brain (financials), profile, tracker (lead PII: names, phone/email, messages), calendar, posts, ad and Instagram insights, GBP listing data, and private videos in the `videos` bucket.
3. **Spend on users' accounts**: Devin ACUs (session creation; `DEVIN_MAX_ACU` cap), HeyGen plan/API credits (video generation), and the Meta ad account (the read-only token; prompts say ads are created paused only).

## Attacker profiles
Per Jerry, **all matter equally**:
- **Another signed-in Studio user** (free sign-up) trying to read or modify another tenant's data or credentials, or spend their credits (IDOR, missing `user_id` filter, OAuth state confusion, storage path traversal).
- **Anonymous internet attacker**: lead-form abuse (spam, tracker flooding, stored XSS into the owner's Tracker, CSV/formula injection), OAuth callback abuse (state guessing, login CSRF / account-linking an attacker's HeyGen/Google account to a victim), reflected/stored XSS on HTML pages, open redirect, and Host-header manipulation of `redirect_uri` and the lead-form URL.
- **Malicious content steering Devin** (prompt injection via leads, competitor websites, posts or GBP data). Goals include exfiltrating context, writing malicious content into docs/calendar/posts that the SPA then renders (XSS), overwriting owner answers, or driving Devin MCP actions such as Meta Ads or Stripe on the owner's Devin org.

## Existing controls
- Bearer-token auth on every non-public route. Service-role queries add `.eq('user_id', uid)`. RLS `own …` policies exist on every table, and the storage policy is keyed on `<uid>/` as the first folder.
- AES-256-GCM with a random IV and auth tag (`secrets.js`). The Setup row shows only account labels, never tokens.
- Input validation:
  - `SLUG`/`validProject` for project names
  - `HEYGEN_ID` regex
  - `LEAD_TOKEN` regex
  - `BIZ_FIELDS` whitelist for `PUT /api/business/*`
  - `SNAP_ALLOWED`
  - a step length cap
  - a 5000-char script cap
  - a 200 MB video cap
  - `clean*` sanitizers for calendar, experiments, posts and brain
- OAuth: PKCE S256 (HeyGen), random state, a 15-minute pending TTL, constant-time state compare, and `PUBLIC_ORIGIN` pinning of `redirect_uri` on non-localhost hosts (HeyGen and Google share `publicOrigin`). Disconnect also revokes the token.
- `escHtml` / `esc` on the server-rendered HTML pages (lead form, OAuth pages). `</` is escaped inside the inline JSON payload.
- Devin: `structured_output_required`, `applied_hash` dedup, a doc_history snapshot before overwrite, `mergeDevinAnswers` filling only blank or help-tagged answers, and prompt-level rules for MCPs (paused ads, read-only).
- Devin 429 backoff (`devin.js`) and idle polling at 60 s.

## Out of scope / accepted risk
Jerry: **nothing is out of scope; report everything**, including `dev/` tooling and the bundled skills.

## Open questions
- Is `PUBLIC_ORIGIN` set in production? Both OAuth flows (Google reuses HeyGen's `publicOrigin`) derive `redirect_uri` from `x-forwarded-host` when it is unset.
- Is Supabase "Confirm email" on? Open sign-up makes "another signed-in user" a zero-cost attacker either way.
- Is the shared `DEVIN_API_KEY` fallback set in production? If so, any new user spends the operator's ACUs until they add their own key.

## Finding tags
Each finding carries a CWE id, an OWASP Top 10 (2021) category, and the affected integration (Devin / HeyGen / Meta / Google / Supabase / none).
