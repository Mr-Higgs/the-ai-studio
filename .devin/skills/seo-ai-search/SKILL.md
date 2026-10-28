---
name: seo-ai-search
description: Everything a small-business website needs to be found by Google Search, Google Maps and AI assistants (ChatGPT, Gemini, Perplexity, Claude, Copilot) — on-page SEO, structured data, answer-ready content blocks (Quick facts, FAQ, service area, pricing, how it works), crawler access and a verification checklist. Applied to every site-build; also usable to upgrade an existing page.
argument-hint: "[path or URL of the page]"
allowed-tools:
  - read
  - write
  - shell
  - browser
  - webfetch
triggers:
  - user
  - model
---

You are making a local business's website **findable and quotable**: by Google (Search and Maps), and by AI assistants that answer "who's a good X near me?" by reading pages and structured data. Every item below is **required on every build** unless marked optional. None of it should look like "SEO" to a visitor — it must be designed into the page as naturally as the rest.

Everything you need is already in the sprint documents in this session. **Use them; don't invent**:

- `visibility.md` → page title, meta description, H1 ("Search phrases → pages", home page row), the Google Business Profile categories, services list, description, "Found by AI assistants" FAQ answers, the "business facts that must read the same everywhere", listings checklist.
- `research.md` → "questions people keep asking" (FAQ), customers' exact words (headings and answers), objections (FAQ answers).
- `offer.md` → the offer, price, guarantee, deadline (Offer schema and the pricing block).
- Business Brain / profile → name, address, phone, hours, service area, what they sell, proof, years in business, owner name.
- Lead form URL → the action in every CTA and the `potentialAction` target.

If a fact is missing (e.g. hours), leave it out of the schema rather than guessing, and list it for the owner in the closing message under "To make it yours".

---

## 1. Answer-ready content blocks (the AI-search layer)

AI assistants quote pages that state facts plainly, early, and in a consistent entity voice. Design each block to fit the brand (ledger rows, stamps, a facts strip, a sidebar) — but the **content shape** is fixed:

1. **Answer capsule** — directly under the H1, one plain-language paragraph (40–70 words) that a machine could lift as the answer to "what is [business] and who is it for": *[Name] is a [category] in [city/area] that [what they do] for [who]. [One proof fact]. [Offer in one clause].* Written from the offer pitch and the profile.
2. **Quick facts** — a labelled list, each item one line, in this order where known: Business name · What we do · Where (full address or service area) · Hours · Phone (click-to-call) · Price range / starting price · Serving since / years in business · Owner · Guarantee · Languages (if any) · Payment methods (if known) · Licence/insurance (only if given). Mark it up as a `<dl>`. These are the "business facts that must read the same everywhere" — spelling and punctuation must match the Google Business Profile exactly.
3. **Services** — one `<h3>` per service (from the visibility services list, most profitable first), each with a 1–2 sentence plain description containing the customer's words for it and, when known, a price or starting price. These headings are the local-intent search phrases.
4. **Service area** — the city plus the neighbourhoods/suburbs from the visibility inputs, as a sentence *and* a list (`areaServed` in schema). For storefronts, the address, parking/transit line, and a link to the Google Maps listing (link, not an embed).
5. **What it costs** — a short, honest table or list from the offer/Brain: the offer price, what's included, the guarantee, any deadline. Transparent pricing is one of the strongest signals for both buyers and AI answers. Never invent prices.
6. **How it works** — 3–5 numbered steps from first contact to done (from the strategy "path from first touch to purchase"), each one sentence. Marked up as `HowTo` when the steps are real.
7. **Proof** — only real reviews/numbers from the sprint, quoted ≤15 words with a plain attribution ("Google review, 2025"). Link to the Google listing for more.
8. **FAQ** — 8–12 questions, phrased exactly as customers ask them (research "questions people keep asking", objections, visibility FAQ). **Answer first**, 40–60 words, no marketing voice, include the business name in 2–3 answers naturally. Native `<details>` or visible text — never hidden behind JavaScript.
9. **About the owner** — 2–4 sentences: name, how long, why; a real photo placeholder if none given. Entities (a named person + a named business + a place) are what AI systems trust.
10. **Last updated** — a visible "Updated [Month YYYY]" line in the footer, kept current on every change.

## 2. On-page essentials

- `<html lang="en">` (or the business's language), `<meta charset>`, `<meta name="viewport">`.
- `<title>`: the visibility doc's home-page title tag (≤60 chars), pattern *[Primary service] in [City] | [Business name]*.
- `<meta name="description">`: the visibility doc's meta description (≤155 chars), includes a service, the area and one proof or offer.
- Exactly one `<h1>` (the visibility doc's H1); logical `<h2>`/`<h3>` order, no skipped levels; every section heading is a phrase someone would search or ask.
- `<link rel="canonical" href="https://<owner>.github.io/<repo>/">` — absolute, with trailing slash, matching the Pages URL exactly (update it if the URL changes).
- `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">`.
- Open Graph + Twitter card: `og:title`, `og:description`, `og:url`, `og:type=website`, `og:image` (1200×630, generated from the brand — the offer headline on the brand texture), `og:locale`, `twitter:card=summary_large_image`.
- Favicon set: `favicon.svg` (brand mark or initial), `apple-touch-icon.png` 180×180, `site.webmanifest` with name/short_name/theme colour.
- Phone as `<a href="tel:+1…">` with the number formatted exactly as on Google; address inside `<address>`; email as `mailto:` only if given.
- Every image: descriptive filename (`brake-repair-decatur.jpg`, not `IMG_0021.jpg`), `alt` that describes the picture (not keywords), explicit `width`/`height`, `loading="lazy"` below the fold.
- Internal anchors: a short in-page nav (Services · Prices · Area · FAQ · Contact) whose link text matches the section headings.
- Semantic landmarks: `<header> <nav> <main> <section aria-labelledby> <footer>`.
- No text in images for anything a visitor needs to read; no content injected only by JavaScript.

## 3. Structured data (JSON-LD, one `<script type="application/ld+json">` with an `@graph`)

Fill only with facts present in the sprint; omit a property rather than guess. Use `@id`s so the nodes link.

1. **LocalBusiness — pick the most specific subtype** from the GBP primary category: e.g. `AutoRepair`, `Bakery`, `BeautySalon`, `HairSalon`, `NailSalon`, `DaySpa`, `Dentist`, `Plumber`, `Electrician`, `HVACBusiness`, `RoofingContractor`, `HousePainter`, `GeneralContractor`, `Locksmith`, `MovingCompany`, `Florist`, `PetStore`, `VeterinaryCare`, `Restaurant`/`CafeOrCoffeeShop`, `ClothingStore`, `JewelryStore`, `FinancialService`, `AccountingService`, `LegalService`, `RealEstateAgent`, `ChildCare`, `TattooParlor`, `HealthAndBeautyBusiness`, `HomeAndConstructionBusiness`, `ProfessionalService`; fall back to `LocalBusiness`. Properties: `@id` (`<url>#business`), `name`, `url`, `telephone` (E.164), `email` (if given), `image`, `logo`, `description` (the answer capsule), `address` (`PostalAddress`, exact GBP text), `geo` (only if coordinates are known), `openingHoursSpecification` (one entry per day-pattern), `priceRange` (e.g. "$$" or "$80–$400"), `areaServed` (array of `City`/`Place` names), `sameAs` (the social and listing URLs from the profile: Google Maps listing, Facebook, Instagram, Yelp…), `foundingDate`/`founder` (if given), `paymentAccepted` (if given), `hasOfferCatalog` → `OfferCatalog` of `Offer`s, one per service, each with `itemOffered: Service` (`name`, `description`, `areaServed`) and `price`/`priceCurrency` when known. **Do not add `aggregateRating`/`review`** unless the page itself shows real first-party reviews collected by the business — never copy Google's rating into schema.
2. **Offer (the campaign offer)** — `Offer` with `name`, `description`, `price`, `priceCurrency`, `availability`, `validThrough` (the offer deadline), `url` (lead form URL), `offeredBy: {"@id": "<url>#business"}`, plus `warranty` as text when there's a guarantee.
3. **WebSite** + **WebPage** — `WebSite` (`name`, `url`, `publisher: {@id business}`), `WebPage` (`@id` `<url>#webpage`, `url`, `name`, `description`, `isPartOf`, `about: {@id business}`, `dateModified` = today, `inLanguage`, `primaryImageOfPage`).
4. **FAQPage** — every FAQ question/answer from section 1.8, text identical to what's visible on the page.
5. **HowTo** — the "How it works" steps (name = step heading, text = the sentence), only if the steps are real.
6. **Person** — the owner (`name`, `jobTitle`, `worksFor: {@id business}`) when a name is given.
7. **potentialAction** on the business or page — `ReserveAction`/`ContactAction`-style with `target` = the lead form URL, when present.

Validate with the Schema.org validator (https://validator.schema.org/) and Google's Rich Results Test (https://search.google.com/test/rich-results) in the browser before publishing; zero errors, and fix warnings that are fixable with known facts.

## 4. Crawler access and discovery files

Create at the repo root (they must be reachable at `<url>robots.txt`, `<url>sitemap.xml`, `<url>llms.txt`):

- **`robots.txt`** — allow everything and name the AI crawlers explicitly so there is no ambiguity:
  ```
  User-agent: *
  Allow: /

  User-agent: Googlebot
  User-agent: Googlebot-Image
  User-agent: Bingbot
  User-agent: DuckDuckBot
  User-agent: Applebot
  User-agent: GPTBot
  User-agent: OAI-SearchBot
  User-agent: ChatGPT-User
  User-agent: ClaudeBot
  User-agent: Claude-SearchBot
  User-agent: anthropic-ai
  User-agent: PerplexityBot
  User-agent: Perplexity-User
  User-agent: Google-Extended
  User-agent: Meta-ExternalAgent
  User-agent: Amazonbot
  User-agent: CCBot
  Allow: /

  Sitemap: https://<owner>.github.io/<repo>/sitemap.xml
  ```
- **`sitemap.xml`** — the single URL with `lastmod` = today (update on every change).
- **`llms.txt`** — Markdown: `# [Business name]`, a one-line summary, then the Quick facts as bullets, the services with one line each, the offer, the FAQ Q→A in full, hours and contact, and `Updated: YYYY-MM-DD`. Plain text that an assistant can read in one fetch; same facts as the page.
- **`.nojekyll`** (empty) so GitHub Pages serves files as-is.
- **`404.html`** — a one-line page in the brand pointing back home with the phone number.
- Optional: `humans.txt` with the owner's name and the "built with Studio" line.

## 5. Local search signals

- Name, address, phone, hours **character-for-character identical** to the Google Business Profile; same format in the Quick facts, footer, `<address>`, and JSON-LD.
- A prominent "Find us on Google" / "Get directions" link to the Google Maps listing when the URL is known; otherwise a link to a Maps search for the exact business name + city.
- "Leave a review" link to the Google review URL when known (visibility doc's review routine) — the request script says where it lives.
- The GBP primary category's words appear in the H1 or answer capsule; the secondary categories appear as service headings.
- Social and listing links in the footer (`sameAs`) use the exact profile URLs.
- Service-area businesses state the area in the first screen; storefronts state the address in the first screen.

## 6. Performance and accessibility (ranking prerequisites)

- Mobile Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100. Run it in the browser (Chrome DevTools) or `npx lighthouse <url> --preset=desktop/mobile` before publishing; fix and re-run.
- Fonts self-hosted or preconnected, `font-display: swap`, subset where possible; images in WebP/AVIF with a JPEG fallback only if needed; total page weight under 1 MB on first load; no layout shift (explicit sizes); no third-party scripts beyond fonts and the lead form.
- Colour contrast ≥ 4.5:1, visible focus, skip link, labels on every form control, `prefers-reduced-motion` honoured.

## 7. Getting indexed (zero technical asks of the owner)

You cannot verify Search Console without the owner's Google login, so do not ask. Instead:

1. Make sure the site is linked from places Google already crawls: in the closing message give the owner **one** plain instruction — "In your Google Business Profile, add this link under Website: [url]" — and say that's the one thing that gets Google to find it fast. (If Studio ever has a Google Business Profile connection, the app will offer to do this for them.)
2. Submit the sitemap via the public ping-free route: just ensure `robots.txt` references it; Bing and others pick it up from there. Optionally use IndexNow for Bing if a key file is trivial to add.
3. Mention that it usually takes a few days to a couple of weeks to show up in search, and that it will appear in AI assistants as they re-crawl.

## 8. Checklist — run before you show the site (all must PASS)

```
SEO/AI — <business> — pass <n>/30
```

1. Title ≤60 chars from visibility.md; pattern service + city + name.
2. Meta description ≤155 from visibility.md.
3. One H1 from visibility.md; headings in order; every H2/H3 is a searchable phrase.
4. Answer capsule under the H1, 40–70 words, names business, category, place, audience.
5. Quick facts `<dl>` present; NAP identical to GBP text everywhere.
6. Services as headings with descriptions (and prices when known).
7. Service area as sentence + list; storefront address in first screen.
8. What-it-costs block with the offer, guarantee, deadline — no invented prices.
9. How-it-works steps (3–5).
10. Proof only from the sprint, attributed.
11. FAQ 8–12, answer-first, visible without JS, questions in customers' words.
12. About-the-owner block; "Updated Month YYYY" in footer.
13. Canonical absolute and matches the live URL.
14. Robots meta allows indexing with full snippets.
15. OG/Twitter tags with a real 1200×630 image.
16. Favicon set + webmanifest.
17. `tel:` link, `<address>`, exact phone format.
18. All images: descriptive filename, alt, width/height, lazy below the fold.
19. In-page nav text matches headings; semantic landmarks present.
20. JSON-LD `@graph`: LocalBusiness subtype, Offer, WebSite, WebPage, FAQPage (+ HowTo/Person when real); no guessed facts; no self-copied `aggregateRating`.
21. Schema validator: 0 errors. Rich Results Test: eligible items detected, 0 errors.
22. `robots.txt` with AI crawlers allowed + Sitemap line.
23. `sitemap.xml` with today's lastmod.
24. `llms.txt` with the same facts as the page.
25. `.nojekyll`, `404.html` present.
26. Google Maps "Get directions"/"Find us" link; review link when known.
27. GBP primary-category words in H1 or capsule; secondary categories as service headings.
28. Footer `sameAs` links exact.
29. Lighthouse mobile: Perf ≥90, A11y ≥95, BP ≥95, SEO 100.
30. Page weight <1 MB, no third-party scripts beyond fonts and lead form.

Any FAIL: fix, re-run. Then continue with the site-build flow (screenshots, publish). In the closing message to the owner, say only: "It's set up so Google and AI assistants like ChatGPT can find and understand you — your facts, hours, prices and the questions people ask are all written in plainly." Then the one-line Google Business Profile instruction.
