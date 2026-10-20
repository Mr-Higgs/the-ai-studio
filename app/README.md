# Studio SaaS app

This is the hosted Next.js version of Studio. It is separate from the local Vite/Node app in `ui/`.

## Local development

1. Create a Supabase project, then apply `supabase/migrations/20261019000000_init.sql` followed by `supabase/migrations/20261020000000_devin.sql` in its SQL editor (or with the Supabase CLI).
2. Copy `.env.example` to `.env.local` and set the project URL, anon key, service role key, and site URL.
3. Generate an encryption key with `openssl rand -base64 32` and set it as `APP_ENCRYPTION_KEY`.
4. Install and run:

   ```sh
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon/publishable key used by cookie-bound clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key storage access; never expose it to the browser |
| `APP_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM encryption key |
| `NEXT_PUBLIC_SITE_URL` | Canonical application origin used for auth email redirects |

The Google provider credentials for Supabase CLI configuration are supplied as `SUPABASE_AUTH_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET`.

## Devin sessions

1. Create a Devin personal access token (PAT) under **Devin Settings → Devin API**, then save it in the app's **Settings** page. The PAT is encrypted at rest and is only used by server-side API routes.
2. Copy the organization ID from Devin into **Settings → Devin session settings**.
3. Set the maximum ACUs per session there (default: 5; allowed range: 1–100).
4. Set `NEXT_PUBLIC_SITE_URL` to the app's public HTTPS origin. Devin sessions must be able to reach this public URL to use the session-scoped `/api/agent` endpoints; localhost is not reachable from Devin.

## Production setup

1. Create a production Supabase project and run `20261019000000_init.sql`, then `20261020000000_devin.sql` from `supabase/migrations/`.
2. In Supabase Authentication, enable email/password and Google sign-in. Add the production `/auth/callback` URL to the auth redirect allowlist (and keep the localhost callback for local development).
3. In Vercel, import the repository and set the project root directory to `app`.
4. Add all five application environment variables above in Vercel. Set `NEXT_PUBLIC_SITE_URL` to the public production origin and use a fresh encryption key generated with `openssl rand -base64 32`.
5. Deploy the Vercel project and confirm its `/api/agent` endpoints are publicly reachable from Devin. Add the app's callback URL to the Supabase redirect allowlist.
6. In app Settings, save the Devin PAT from **Devin Settings → Devin API**, the organization ID, and the desired maximum ACUs per session.
