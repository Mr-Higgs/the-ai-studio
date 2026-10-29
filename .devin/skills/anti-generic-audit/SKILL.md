---
name: anti-generic-audit
description: A pass/fail checklist Devin runs on a website it just built, before showing it, to catch the "every AI site looks the same" tells and force a one-of-a-kind result. Used by site-build; also usable on any existing page.
argument-hint: "[path or URL of the page to audit]"
allowed-tools:
  - read
  - browser
  - shell
triggers:
  - user
  - model
---

You are auditing a website for **sameness** — the look that every AI-generated small-business site has. Be harsh. The question behind every item is: *would a human designer have been paid for this, and could this page belong to any other business in the same trade?*

Open the page at desktop and phone widths, then go through every item. Each is **PASS** or **FAIL**. Any FAIL means: fix it, then run the whole list again. Do not show the site to the owner until everything passes. Do not tell the owner about this checklist in technical terms — if you mention it at all, say "I checked it over to make sure it doesn't look like a template."

## A. Could this be anyone?

1. **Swap test** — replace the business name with a competitor's. If nothing else on the page would look wrong, FAIL.
2. **Metaphor present** — at least two visible decisions (colour, texture, type, shape, the signature idea) clearly come from the business's trade or materials. If you can't name them in one sentence each, FAIL.
3. **Their words** — the headline is the offer pitch, and at least one real customer phrase or proof item from the sprint appears above the fold. FAIL if the copy is new generic marketing.

## B. The template tells (any one is a FAIL)

4. Hero = centered headline + subline + two buttons over a gradient or blurred blob.
5. A row of **three equal cards** with an icon each — anywhere on the page.
6. Uniform rounded cards with the same soft drop shadow used as the container for everything.
7. Purple→blue (or pink→orange) gradient; glassmorphism blur panels.
8. Display font is Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Space Grotesk, DM Sans, Arial or Helvetica.
9. Every section is the same width, same padding, same background, in a steady rhythm.
10. Everything "fades up on scroll"; or more than one kind of animation.
11. Emoji used as icons; stock-looking generic imagery; lorem ipsum or `[placeholder]` text left in.
12. A testimonials carousel, a logo strip, or a "Trusted by" row with invented content.
13. Pure `#ffffff` background with pure `#000000` text.

## C. Evidence of a designer's hand (all must PASS)

14. **Type scale** — one genuinely oversized display size (≈8–14vw on desktop) with tightened tracking, and at least one typographic move (huge numeral beside small text, drop cap, sideways label, outlined or hanging text).
15. **Shape language** — 2–3 section shapes chosen (offsets, one-sided corners, torn/wavy edges, circles/pills, diagonals, overlap, ruled lines, stamps) and **repeated** consistently. Variety without repetition reads as random, not designed.
16. **Width rhythm** — the page alternates full-bleed and inset sections at least twice; at least one asymmetric layout.
17. **One texture** applied with CSS/SVG (grain, paper, halftone, hatching, rules) — present, subtle, and consistent with the metaphor.
18. **Signature idea** — exactly one memorable visual or interaction tied to the business. Zero or more than one is a FAIL.
19. **Palette** — one dominant colour, one accent, warm/cool paper-and-ink neutrals; every colour justified by the brief.

## D. It still has to work (all must PASS)

20. The 5-second need is met above the fold on a phone: storefront → hours, address, phone; at-customer service → service area + phone/quote; online → offer + action.
21. Primary button goes to the lead form URL (with `?src=Website`) or click-to-call if there's no form; a sticky call bar on mobile for local businesses.
22. Name, address, phone and hours match the Google Business Profile text from the sprint exactly; `LocalBusiness` JSON-LD present and correct.
23. Page title, meta description and H1 come from the visibility plan; one `<h1>`, headings in order, alt text on every image, 4.5:1 contrast, visible focus states.
24. Nothing moves for `prefers-reduced-motion` users; the page is readable with fonts blocked.
25. Loads fast: fonts preloaded or `font-display: swap`, images sized and lazy, no third-party scripts beyond fonts and the lead form.
26. No real claims, reviews, numbers or awards that aren't in the sprint documents.

## Report format (for your own notes, not the owner)

```
AUDIT — <business> — pass <n>/26
FAIL 5: three equal service cards under the hero → rebuilt as a ledger list with ruled lines.
FAIL 8: Poppins display → switched to Instrument Serif, tracking -0.03em.
…
Re-run: pass 26/26.
```

When everything passes, continue with what you were doing (for site-build: take the screenshots and show the owner).
