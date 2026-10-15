# Project: heygen-test — Patterned holiday promo

_video-use writes session memory here (takes, diarization, edit decisions)._

## Brief
- **What:** short, punchy promo for the holiday offer. Hook in the first 2 seconds, show the product, end on the offer + call-to-action.
- **Length:** 15–30s. **Format:** vertical 9:16 (Reels / TikTok / Shorts / Stories).
- **Include:** burned-in subtitles (muted viewing); HyperFrames title card + end card with offer and CTA; audio clean-up and levelling; AI presenter = the HeyGen clips already in `raw/` (no new HeyGen generation unless none exist).
- **Business context** (from `business/profile.json`, `business/offer.md`): Patterned (patterned.work, @patternedwork). Offer: **The January Cohort Readiness Pilot** — 15 candidates, **$4,500**, half now / half after the first verified placement. CTA: **Book a 20-minute Pilot Fit Call — 5 January pilot slots, closes Dec 19.** Voice: plain, direct, outcomes-first. Compliance: never say "guaranteed placement/funding".
- **Output:** `projects/heygen-test/out/`.

## Source
- `raw/heygen-202df6775ae24788a126516b5c3a4a6f.mp4` — 62.7s, 1080×1920 @25fps, AAC stereo. Presenter (HeyGen avatar, headphones, warehouse backdrop) pitching Patterned's automated 30/60/90/180-day follow-up. HeyGen already cut in its own graphics: full-screen "PATTERNED" card (0–5s), "Manual Follow-Up" side card (6–11s), full-screen "FUNDING AT RISK" (12–17s), "Project Milestones" side card (18–29s), full-screen "Real Barriers" (30–38s), chart side card (38–46s), partner logos (48–53s), "Automate Follow-up" banner (54–62s). Audio is clean but quiet: −30 LUFS integrated, peak −10 dB.
- `raw/heygen-70e9b6ee3dba4b4887e91ec364c4eb97.mp4` — 7.5s, 720×1280. HeyGen's default "Hi, I'm your new AI avatar" demo clip. **Not usable** (wrong content, lower resolution).
- Transcripts cached in `raw/edit/transcripts/`, packed view `raw/edit/takes_packed.md`.

### Pre-scan notes
- 47.40–55.10: ends on a false start ("…on the same platform. First, there were…") — avoid.
- No spoken mention of the holiday offer, price or CTA — those must be carried on-screen (end card).

## Decisions

### Session 1 — 2026-10-12

**Strategy.** 25.5s vertical promo from the single 62.7s presenter take. Three beats —
HOOK (stat about 6-month outcomes), PROBLEM→PRODUCT (follow-up data falls off the desk →
Patterned does it), PRODUCT (agent runs intake + 30/60/90/180-day calls) — then a HyperFrames
end card carries the offer/CTA (offer is never spoken). A kinetic-type title card overlays the
hook so the opening 6s read as designed, not stock. Navy background sampled from HeyGen's own
full-screen card (avg #0E1427 at t=4.5) so card→footage cuts are seamless. Burned 2-word
UPPERCASE subtitles (render.py default style, MarginV=90); cues under the title card deleted —
the card itself carries the hook text. Loudnorm two-pass −14 LUFS / −1 dBTP kept on.

**EDL** (`raw/edit/edl.json`, grade `none`):

| # | Source in–out | Output in–out | Beat |
|---|---|---|---|
| 1 | 0.00–6.12 | 0.00–6.12 | HOOK |
| 2 | 12.77–18.44 | 6.12–11.79 | PROBLEM→PRODUCT |
| 3 | 19.47–28.44 | 11.79–20.76 | PRODUCT |

All six boundaries verified on word gaps in the Scribe transcript (≥50ms pad each side);
no nudges required. Cut length 20.76s (rendered 20.80s — last frame padded to GOP).

**Overlay:** `out/title-card.mp4` at output 0.0–6.12 (one overlay; subtitles applied after it).

**Cards** (HyperFrames, `compositions/`, 1080×1920 @25fps, GSAP power3/expo reveals):
- `title-card` 6.12s — wordmark + hook text revealed in 6 phrase groups synced to word
  timestamps (reveal = word start −0.15s); "six months" and line 2 amber #F5A623; line 1
  dims to 55%/0.94× when "Almost" is spoken (4.72s in transcript — plan said ~3.85s, timed
  to actual word). No end fade.
- `end-card` 5.0s — wordmark + amber rule, "The January Cohort Readiness Pilot", sub
  (15 candidates line), amber CTA pill "Book a 20-min Pilot Fit Call", slots/urgency line,
  handle. No price shown; "guarantee(d)" nowhere. Sub line set to 40px/960px box after a
  first-pass render showed edge clipping at 44px full-width.

**Composite:** `cut.mp4` × `end-card.mp4` — xfade fade 0.3s @ offset 20.5; anullsrc silent
stereo for card + acrossfade 0.3 so "hired." isn't clipped. libx264 crf 18 preset slow,
yuv420p, +faststart, AAC 192k 48k stereo.

**Verification.** `out/patterned-holiday-promo.mp4` — h264 1080×1920, 25fps, 25.52s,
AAC 48k stereo. ebur128: **I = −14.2 LUFS, TP = −1.0 dBTP**, LRA 3.5. Timeline views +
stills in `raw/edit/verify/` (tl_t0-6, tl_cut1, tl_cut2, tl_cut3, tl_t20-25, final_*):
boundaries land in silence, no pops, no subs under title card, end card fully readable.

**Environment notes (deviations):**
- System ffmpeg (/usr/local, 8.1.1) has **no libass/drawtext** — `subtitles` filter
  missing. Downloaded evermeet ffmpeg 9.0.2 (has libass) to `/tmp/ffbin/` and rendered
  with `PATH=/tmp/ffbin:$PATH`. Not persistent — future renders need it again.
- `render.py` hardcodes `-r 24` on extraction; patched to 25 at runtime via
  `raw/edit/run_render.py` (monkeypatch, no edits to the skill). 
- `render.py` looks up transcripts as `transcripts/<source-key>.json`; copied the source
  transcript to `transcripts/A.json`.
- HyperFrames renderer aliases "Helvetica Neue"/Helvetica/Arial → Inter (info-level);
  fonts render deterministically via its bundled faces.
