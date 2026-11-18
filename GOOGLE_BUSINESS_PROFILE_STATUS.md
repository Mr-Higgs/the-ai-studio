# Google Business Profile connection — status, what was done, next steps

_Last updated 2026-11-18. Covers the "Connect Google Business Profile" button in Setup and
the "Can people find you?" health check on the Get found locally step._

## TL;DR

The connection itself works: an owner clicks Connect, signs in with Google, and Studio
stores their token. What does **not** work yet is reading the listing (name, address,
phone, hours, categories). Google gates the Business Profile APIs behind a **manual,
per-project access approval**, and ours is still pending. Until it is granted, every
listing call returns a quota/permission error, which Studio shows as:

> Connected. Google hasn't finished approving Studio's access to read listings yet — we'll
> pick up your listing automatically once it has.

This is not a bug in Studio. No code change will unblock it; only Google's approval does.

## Rolled back behind a flag (2026-11-18)

The whole feature — the Google Business Profile connection and the "Can people find you?"
health check — is now gated behind env var `STUDIO_VISIBILITY_AUDIT`. It is **off by
default** and only enabled when the value is exactly `on` (case-insensitive). While off,
the Setup row shows "Coming soon", the audit endpoint and site fix buttons 404, and the
Google listing is left out of Devin's context — behavior matches the pre-feature app.
To re-enable once Google approves API access: set `STUDIO_VISIBILITY_AUDIT=on` in Vercel
and redeploy (or in `.env` for local dev).

## Why it is not working right now

| Symptom | Cause | Where it's handled |
|---|---|---|
| Setup shows "Connected as …" but "waiting on Google's approval" | `My Business Account Management` / `Business Information` APIs return 403/429 (`quota`, `accessNotConfigured`, `PERMISSION_DENIED`) because project **796231445241** has **0 QPM** quota — i.e. not yet allowlisted | `api/_lib/google-oauth.js` → `gbpGet` maps these to `code: 'pending_approval'`; `api/index.js` → `syncGoogleLocations` stores `pending_approval: true` |
| Health check shows the 4 listing checks (`gbp_website`, `gbp_category`, `gbp_description`, `gbp_hours`) and the phone/address match as **skipped** | They need the listing, which we can't read yet | `api/_lib/audit.js` skips when `gbp` is null |
| Health check panel shows an error / no score at all | Supabase migration `0012_visibility_audit.sql` not applied → saving the audit fails | `POST /api/visibility/audit` returns 400 with the DB error |
| Button greyed out, "Coming soon" | `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` missing on that deployment | `google.configured()` in `api/_lib/google-oauth.js` |
| Sign-in refused for a given Google account | Consent screen is in **Testing** mode; only listed Test users can sign in (max 100) | Google Cloud → Google Auth Platform → Audience |

## What was done (2026-11-03)

### Code (commits `1d984ab`, `dd39649` on `main`)
- **Health check engine** `api/_lib/audit.js` — 13 deterministic checks (site loads, one
  official address + canonical, robots allows Google, sitemap, title/H1, LocalBusiness
  schema, phone + address match the listing, llms.txt, and 4 listing-completeness checks).
  SSRF-guarded fetches (public hosts only, 10 s timeout, 1 MB cap, ≤5 redirects).
  Tests: `api/audit.test.js`.
- **Storage/API** — `businesses.visibility_audit` + `visibility_audit_updated_at`
  (`supabase/migrations/0012_visibility_audit.sql`); `POST /api/visibility/audit`;
  the Setup page triggers a run after Google connects or a listing is picked.
- **UI** — `VisibilityPanel.jsx` on the Get found locally step (problems first, plain
  fixes, "Check again"); score line under the Google row in Setup.
- **Fix it buttons** — website problems go to the owner's existing website Devin session
  via `POST /api/site/fix` (message rebuilt server-side from stored audit ids); listing
  description/category go to the step chat; website link/hours open business.google.com.
- **Devin context** — the audit is inlined as authoritative (`prompts.js` `audit` part);
  the visibility prompt starts from it instead of re-fetching.
- **OAuth scope** now also requests Search Console (`auth/webmasters`) so the next phase
  (verify site, submit sitemap, index status) needs no reconnect.

### Google Cloud (project "Studio", number 796231445241, owned by samershaqour08@gmail.com)
- Enabled: My Business Account Management API, My Business Business Information API,
  Google Search Console API, Site Verification API.
- Consent screen configured (External, Testing), scopes `openid email business.manage webmasters`.
- OAuth client "Studio Web" with redirect URIs
  `https://beone.ratelimitlabs.com/api/google/oauth/callback` and
  `http://localhost:4321/api/google/oauth/callback`.
- Env vars set on Vercel; live sign-in confirmed ("Connected as samershaqour08@gmail.com").
- **Business Profile API access request submitted** — support case **8-6000000042321**,
  quoted review time 7–10 business days, filed as a manager of Super Fast Auto Repair.

### Verified
- Real audit against `https://www.superfastautorepair.com`: 12/13 pass in ~1.2 s (the one
  fail was a deliberately fake phone number).
- `npm test` 96/96, `npm run build` clean, mock UI walkthrough of panel + Fix it.

## Next steps

### 1. Check whether Google has approved (do this first — it may already be done)
Cloud Console → **APIs & Services → Enabled APIs & services → My Business Business
Information API → Quotas & System Limits**.
- `0` requests/minute → still pending.
- `300` requests/minute → approved. In Studio: Setup → Google row → **Check again**. The
  listing loads and the health check fills in all 13 checks. Nothing to deploy.

Also check samershaqour08@gmail.com (incl. spam) for mail about case 8-6000000042321 —
Google sometimes asks follow-up questions and the case stalls until answered.

### 2. If still pending after 10 business days
- Reply on the existing case (do **not** open a second one — Google says duplicates delay
  review). Restate: project number, that the applicant is a manager on Super Fast Auto
  Repair (verified > 60 days, website live), read-only use, single-location owners.
- Make sure the applicant account is still listed as owner/manager on the Super Fast
  listing and that the listing's website field points at `https://www.superfastautorepair.com`.
- Make sure `https://beone.ratelimitlabs.com` has a reachable privacy policy page; the
  reviewers visit the company website given in the form.

### 3. Confirm the Supabase migration ran
Run in the SQL editor (idempotent):
```sql
alter table businesses add column if not exists visibility_audit jsonb;
alter table businesses add column if not exists visibility_audit_updated_at timestamptz;
```
Then Get found locally → **Run check**. The 9 website checks work today, without Google's
approval, as long as the Business profile has a website.

### 4. Don't let the connection depend on one person
- IAM & Admin → IAM → grant `jerry@patterned.work` (or a shared admin account) **Owner** on
  the project.
- Longer term: IAM & Admin → Settings → **Migrate** the project into the `patterned.work`
  organization. Client ID/secret stay the same; nothing changes in Vercel.
- Rotate the OAuth client secret (Google Auth Platform → Clients → Studio Web → Add secret,
  update Vercel, delete the old one) — the original was pasted into a chat.

### 5. Before onboarding beyond test users
- Google Auth Platform → Audience → **Publish app**, then submit for **verification**
  (sensitive scopes `business.manage`, `webmasters`). Needs: public privacy policy, homepage
  on the same domain, a short screen recording of the consent flow. Until then only the
  Test users list (max 100 emails) can connect.

### 6. Build while waiting (does not need the approval)
The Search Console scope is already granted on every new connection, so **Layer 2** can
ship now:
- Site Verification API: fetch META token → owner's website Devin session adds the tag →
  `webResource.insert`.
- Search Console: `sites.add` + `sitemaps.submit`; IndexNow ping for Bing.
- New checks: "Google knows about your site" (property verified), "Sitemap submitted",
  "Pages indexed: N of M" (URL Inspection, 2,000/day).
This is the exact afternoon of clicks from the Super Fast run, automated.

### Fallbacks if Google rejects the application
- **Re-apply from a different qualifying listing/account** (e.g. a `patterned.work`
  account that manages a verified profile > 60 days old), same project number.
- **Owner-entered facts fallback**: let the owner paste their Business Profile name,
  address, phone, hours and category into the Business profile step; the health check's
  NAP and listing checks read from there when `gbp` is null. Loses "authoritative from
  Google" but keeps the feature useful. (Not built; ~half a day.)
- **Places API (Place Details)** as a read-only source for the public parts of the listing
  (name, address, phone, hours, website, rating). Requires billing on the project;
  pay-per-call after the monthly free credit.

## Reference
- Code map: `CLAUDE.md` (Google Business Profile section), `api/_lib/google-oauth.js`,
  `api/_lib/audit.js`, `api/index.js` (`googleAuth`, `syncGoogleLocations`,
  `runVisibilityAudit`, `/api/site/fix`), `ui/web/src/components/VisibilityPanel.jsx`,
  `ui/web/src/components/Setup.jsx` (`GoogleRow`).
- Google docs: developers.google.com/my-business/content/prereqs (access request, quota check).
