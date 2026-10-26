# Deploying Studio

## 1. What this is

Studio is a hosted workshop app: **Vercel** serves the web app and our small API, **Supabase**
stores the accounts and every participant's files, and each participant's assistant runs in
**Devin's cloud** using their own Devin API key. Participants need only a browser — nothing
to install.

## 2. Supabase (once)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine) and note the
   **Project URL**, the **anon public key**, and the **service_role key** (Settings → API).
   The reference deployment uses project `owoaljgzwrecwcnkmxle`, already migrated.
2. Run the migration files in `supabase/migrations/` in order, through
   `0006_field_timestamps_lead_form.sql` (`supabase link --project-ref <ref>` then `supabase db push`, or
   paste each file into the SQL editor).
3. In **Authentication → Providers → Email**: keep "Allow new users to sign up" ON (sign-up
   happens through Supabase Auth directly). Turn OFF "Confirm email" if you want participants
   signed in immediately; leave it on and they get a confirmation link first. Under
   **Authentication → URL Configuration**, set the Site URL to your Vercel address.
   **Rate limits:** with "Confirm email" on, Supabase's built-in mailer sends only ~2 emails
   per hour per project, so sign-ups fail with HTTP 429 after the first couple. Either turn
   "Confirm email" off, or add custom SMTP (**Authentication → Emails → SMTP Settings**, e.g.
   Resend) and then raise the email limit under **Authentication → Rate Limits**. For a live
   workshop on shared Wi-Fi, also raise "sign-ups and sign-ins" there, since that limit is per IP.

## 3. Vercel

1. Import the GitHub repo. Framework preset: **Other** (Vercel reads `vercel.json`:
   `npm run build` builds the UI into `ui/dist`, `api/index.js` is the API).
2. Add Environment Variables:
   | Variable | What to put |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_KEY` | service_role key — keep it secret; the API uses it to read/write users' rows |
   | `STUDIO_SECRET_KEY` | 64 hex chars; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — it encrypts users' API keys at rest |
   | `DEVIN_API_KEY`, `DEVIN_ORG_ID` | Optional shared fallback credentials |
   | `DEVIN_MAX_ACU` | Optional per-session ACU cap |
3. Deploy, then open the URL — you should see the sign-in screen.

## 4. Participant flow

Create account (email + password) → **Setup** → paste **Devin API key**
(`cog_…`) and **Organization ID** from Devin → Settings → Devin API → done. HeyGen optional:
connect your HeyGen account (or paste an API key) for imports/avatar videos. The first account created is just a normal user —
there's no admin UI in this version.

## 5. Costs and notes

- Devin usage (ACUs) is billed to **each participant's own Devin account**, not yours.
- Vercel Pro or higher is recommended for the `maxDuration: 60` function limit.
- Supabase free tier covers a workshop cohort easily.
- Not in this version: LinkedIn autopilot and local video editing. HeyGen imports are
  capped at 200 MB per video.

## 6. Local development

```bash
npm run build && npm run dev:api   # API + built UI on :4321, env from .env
# or, for UI hot reload:
npm run dev:api & npm run dev      # vite on :5173 proxying /api → :4321
```

`.env` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_KEY`, plus `STUDIO_SECRET_KEY` for saved API keys to work.

## 7. Updating

Push to `main`; Vercel redeploys. Data in Supabase is untouched by deploys.
