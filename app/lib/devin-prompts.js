import { GRAND_SLAM_OFFER_SKILL } from './grand-slam-offer.js';

const OFFER_SKILL_MARKER = '<!-- studio:include-grand-slam-offer -->';

export function devinPreamble(site = process.env.NEXT_PUBLIC_SITE_URL) {
  return `You're working for The AI Studio, a hosted web app. This business's data lives in the app, not in files or repos. Use the app's API at ${site}/api/agent with the header \`Authorization: Bearer $STUDIO_TOKEN\` (STUDIO_TOKEN is a session secret; never print, echo or log it):
- GET /context returns JSON {sprint, profile, inputs, docs, calendar}. docs maps each saved file (offer.md, research.md, ...) to its Markdown.
- PUT /docs/<file> with the Markdown as the body (Content-Type: text/markdown) saves a step document. It overwrites the current version; the app keeps the old one in history.
- PUT /calendar with a JSON array body (Content-Type: application/json) saves the campaign calendar.
Wherever the instructions say to read a file in business/, read it from /context. Wherever they say to save to business/<file>, PUT it to the API instead. Don't create files, repos or pull requests, and don't ask me to download anything. Keep chat replies short and plain.`;
}

export function buildDevinPrompt(text, site) {
  const expanded = String(text).replaceAll(OFFER_SKILL_MARKER, GRAND_SLAM_OFFER_SKILL);
  return `${devinPreamble(site)}\n\n${expanded}`;
}
