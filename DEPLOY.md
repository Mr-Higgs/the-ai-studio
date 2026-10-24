# Hosting Studio on Railway

## 1. What this is

Instead of installing Studio on every participant's laptop, we run **one** copy on a
small always-on computer rented from Railway (a hosting company). Participants open one
web address, create an account with the invite code you give them, sign in to their own
Devin account on the Setup page, and work in their own private workspace — nothing to
install but a browser.

Why Railway and not Vercel: Vercel only serves pages and short-lived functions; Studio
needs a server that stays on all day and keeps files around, which is what Railway sells.
(If a Vercel project was connected to this repo earlier, disconnect or delete it — it
can't host this app.)

## 2. Set it up (about 15 minutes)

1. Create an account at [railway.com](https://railway.com).
2. **New Project → Deploy from GitHub repo.** Pick `Mr-Higgs/the-ai-studio`, branch
   `main`. Railway finds the `Dockerfile` in the repo and builds it automatically.
3. While that builds: in the project, open **Settings → Volumes → Add Volume** and set
   the mount path to `/data`. A volume is a disk that survives redeploys — this is where
   every participant's files live. No volume, no saved work.
4. Open the **Variables** tab and add:
   | Variable | What to put |
   |---|---|
   | `STUDIO_INVITE_CODE` | The code you'll hand out at the workshop, e.g. `sprint-2026`. Registration only works with it. |
   | `STUDIO_ISOLATE` | `1` — gives each participant their own OS user so they can't see each other's files. |
   | `STUDIO_PUBLIC_URL` | The public web address Railway gives you — see step 5. |
   | `STUDIO_IDLE_MIN` | Optional. Minutes before an idle chat is paused to save memory. Default 30. |
   | `STUDIO_QUOTA_MB` | Optional. Disk limit per participant in MB. Default 2048 (2 GB). |
   | `STUDIO_SANDBOX` | Leave unset — the extra process sandboxing doesn't work on Railway's environment. |
5. **Settings → Networking → Generate Domain** to get the public address (looks like
   `https://studio-xxxx.up.railway.app`). Copy it into `STUDIO_PUBLIC_URL` from step 4 —
   including the `https://`. This locks the app to that address.
6. Hit **Deploy** (or let the redeploy finish), then open the URL. You should see the
   sign-in screen.

## 3. First run

- The **first account created becomes the admin** — that's you. Admins can open
  `/api/admin/users` to see the list of accounts. Create yours before handing out the code.
- Each participant then: **Create account** (email + password + invite code) →
  **Setup** → **Sign in to Devin** → a Devin page opens, they log in with their own
  Devin account and copy the code it shows → paste it back → done. HeyGen and LinkedIn
  keys are optional and each person adds their own.

## 4. Sizing and cost

- Each participant's Devin assistant takes ~100 MB of memory while idle, plus spikes
  while it's working. For ~20 participants, start with **8 GB RAM / 4 vCPU** (set under
  Settings → Resources).
- Railway bills by actual CPU/memory/disk usage, so a quiet week costs much less than
  workshop day. Check Railway's pricing page for the current rates and estimate from the
  numbers above.
- Disk: each participant can store up to 2 GB of videos by default (`STUDIO_QUOTA_MB`),
  so size the volume at roughly `2 GB × participants` plus a little headroom.

## 5. Security, in plain terms

- Everyone shares one machine, but with `STUDIO_ISOLATE=1` each participant gets a
  separate user account on it — nobody can read another person's files or API keys.
- API keys (Devin, HeyGen, LinkedIn) are stored per participant on the volume — never in
  the repo, never visible to other users.
- **Back up the volume** (Railway snapshots) — if it's lost, everyone's work is lost.
- After the workshop, change `STUDIO_INVITE_CODE` or delete the variable to close
  registration; existing accounts keep working.
- HTTPS (the padlock) is handled by Railway automatically.

## 6. Test it locally in Docker first

On any computer with Docker installed:

```bash
docker build -t studio .
docker run --rm -p 4321:4321 -v studio-data:/data \
  -e STUDIO_INVITE_CODE=test -e STUDIO_ISOLATE=1 studio
```

Open http://localhost:4321 and walk through sign-up + Devin sign-in exactly as a
participant would.

## 7. Updating

Push to `main` on GitHub and Railway rebuilds and redeploys automatically. Everything on
the `/data` volume — accounts, workspaces, files — survives the update.
