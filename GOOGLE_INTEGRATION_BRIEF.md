# Google Business Profile in Studio — where we are and what we need to decide

_Prepared 2026-11-18 for Jerry. Five-minute read. Technical detail lives in
`GOOGLE_BUSINESS_PROFILE_STATUS.md`; this is the decision brief._

## What we built (Nov 3)

A "Can people find you?" health check for every Studio customer:

- The owner connects their Google Business Profile in Setup.
- Studio runs 13 checks against their live website and their Google listing — is Google
  allowed to read the site, is there a sitemap, does the phone/address match Google, is
  the listing linked to the site, does it have a category/hours/description, etc.
- Each problem has a **Fix it** button: website problems go straight to the Devin session
  that built their site; listing problems get Devin to write the paste-ready text.
- Devin's "Get found locally" plan is written from these real findings instead of guesses.

Origin: Super Fast Auto Repair's site sat invisible to Google for weeks (robots.txt said
"don't index", no sitemap, no Search Console). Fixing it took an afternoon of clicks we
don't want any owner to have to do. This automates that afternoon.

Status: code is on `main`, tested, and deployed — but **switched off** behind a feature
flag (`STUDIO_VISIBILITY_AUDIT`) because of the blocker below. Customers currently see the
old "Coming soon" row. Flipping it on is one env var in Vercel, no code change.

## The blocker

Reading a customer's listing uses Google's **Business Profile APIs**, which Google only
unlocks per Cloud project after a **manual application**. Until approved, every listing
call is rejected. Sign-in works; the data doesn't arrive.

We applied Nov 3 and were **rejected Nov 4**: the website on the form
(`beone.ratelimitlabs.com`) didn't exactly match the website on the Business Profile we
cited (Super Fast's). A form error on our side, not a judgment on Studio — but it cost two
weeks because the rejection email was missed.

## The key fact

Google's requirement is that the **applicant manages one verified Business Profile that is
60+ days old**, and the form's website must match that profile's website exactly.

**That listing is evidence, not scope.** Approval lands on the Cloud project. After that,
*every* customer connects with their own Google account and Studio reads *their* listing.
The business named on the form is never involved again. This is how every agency and
listings tool using this API operates.

## Options

| | What | Time to live | Cost | Trade-off |
|---|---|---|---|---|
| **A** | Re-apply using a client's listing (e.g. Super Fast, which already lists us as manager) with its exact website on the form | ~7–10 business days | Free | A client's name on a form only Google's reviewer sees |
| **B** | Create a Business Profile for our own company, apply when it's 60 days verified | ~2 months | Free | Clean ownership; nothing ships for 60 days |
| **C** | Use the **Places API** instead (public listing data, no application) | This week | Free at our scale (1,000 lookups/month free, then ~2¢) | Read-only; no listing description; can't post/reply for the owner |

Places gives us everything the health check and website need — name, address, phone,
hours, category, rating, reviews, photos, Maps/review links — plus things the official API
can't: competitor data (nearby listings' ratings, review counts, hours) and the ability to
score *any* business, including prospects. What it can't do is write to the listing.

## Recommendation

**Do A (or C) now, and B in parallel.**

1. **This week:** re-apply with the exact listing website (A). It's a three-minute form;
   the only thing that changes from last time is one field. Approval unlocks the full
   OAuth connection we already built, including future write features (review replies,
   posts, hours updates).
2. **Today:** create and verify a Google Business Profile for the company (B). Starts the
   60-day clock so we're never dependent on a client listing again.
3. **If we'd rather not use a client on the form at all:** build C instead — Places-based
   connection ships read-only in about a week, and the OAuth path stays behind its flag
   until B qualifies.

## Decisions needed

1. **Which listing goes on the application** — Super Fast (fastest) or wait for ours?
2. **Project ownership** — the Google Cloud project is currently on Samer's personal
   Gmail. Add a company account as Owner now; migrate into the `patterned.work`
   organization when convenient. No customer impact either way.
3. **Build Places (C) now?** Yes if we want the health check live for customers before
   the API approval; otherwise it waits on A/B.

## Also on the list (not blocking)

- Run migration `supabase/migrations/0012_visibility_audit.sql` (two nullable columns).
- Before opening beyond test users: publish the Google consent screen and submit it for
  verification (needs a public privacy policy and a short demo video). Independent of the
  API approval; required for anyone outside a 100-email test list to sign in.
- Rotate the OAuth client secret (it was pasted in a chat).
- Case ID of the rejected application: 8-6000000042321. Don't reopen it; file a new one.
