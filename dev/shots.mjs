// ============================================================================
//  GUIDE SCREENSHOTS — runs the real UI against dev/mock.mjs and writes
//  numbered-badge PNGs to ui/web/public/guide/<name>.png
//
//  Prereqs:  npm run dev:mock        (mock API+auth on :4322)
//            vite ui/web --mode mock (vite on :5173, proxies /api → 4322)
//  Run:      npm run shots           (or: node dev/shots.mjs 05 14 to filter)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.UI || 'http://localhost:5173';
const MOCK = process.env.MOCK || 'http://localhost:4322';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'ui/web/public/guide');
fs.mkdirSync(OUT, { recursive: true });

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  ({ chromium } = await import('file:///Users/samershaqour/Desktop/SuperFastAutoRepair/node_modules/playwright/index.mjs'));
}

const setStage = async params => {
  const q = new URLSearchParams(params);
  const r = await fetch(`${MOCK}/mock/stage?${q}`);
  if (!r.ok) throw new Error('stage failed: ' + r.status);
};

// Red numbered circle, anchored in document coords so it survives scroll/layout
// and lands correctly in full-page captures.
const badge = (page, selector, n) => page.locator(selector).first().evaluate((el, num) => {
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'shot-badge';
  d.textContent = num;
  Object.assign(d.style, {
    position: 'absolute', left: r.left + scrollX - 14 + 'px', top: r.top + scrollY - 14 + 'px',
    width: '28px', height: '28px', borderRadius: '50%', background: '#d33', color: '#fff',
    font: 'bold 15px/28px system-ui,sans-serif', textAlign: 'center',
    border: '2px solid #fff', boxShadow: '0 1px 6px rgba(0,0,0,.5)', zIndex: 99999,
  });
  document.body.appendChild(d);
  return true;
}, n).catch(e => { console.warn(`  ! badge ${n} missed ${selector}: ${e.message.split('\n')[0]}`); return false; });
const clearBadges = page => page.evaluate(() => document.querySelectorAll('.shot-badge').forEach(e => e.remove()));
const clipOf = async (page, selector, pad = 20) => {
  const box = await (await page.locator(selector).first().elementHandle())?.boundingBox();
  return box && { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
};
const scrollTo = (page, selector, block = 'center') =>
  page.locator(selector).first().evaluate((el, b) => el.scrollIntoView({ block: b }), block).catch(() => {});
// Clip spanning from the top of one element to the bottom of another.
const clipRange = async (topSel, bottomSel, pad = 24) => {
  const t = await page.locator(topSel).first().boundingBox();
  const bt = await page.locator(bottomSel).last().boundingBox();
  if (!t || !bt) return null;
  const x = Math.max(0, Math.min(t.x, bt.x) - pad), y = Math.max(0, t.y - pad);
  const r = Math.max(t.x + t.width, bt.x + bt.width) + pad;
  return { x, y, width: r - x, height: bt.y + bt.height + pad - y };
};

// .shell is height:100% with .main/.rail/.chat-log as inner scrollers — a fullPage
// capture only paints their visible region. For full-page shots, expand every
// scroller to content height so the whole document paints. Removed afterwards.
const expandPage = on => page.evaluate(v => {
  let s = document.getElementById('shot-expand');
  if (v && !s) {
    s = document.createElement('style');
    s.id = 'shot-expand';
    s.textContent = `html,body,#root{height:auto!important;overflow:visible!important}
      .shell{height:auto!important}
      .main,.rail,.chat-log{overflow:visible!important;height:auto!important;max-height:none!important}
      .side{height:auto!important;min-height:0!important}
      .video{display:block!important}`;
    document.head.appendChild(s);
  }
  if (!v && s) s.remove();
  return !!s;
}, on);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
context.addInitScript(() => { try { localStorage.setItem('theme', 'light'); } catch {} });
const page = await context.newPage();
page.on('pageerror', e => console.warn('  [pageerror]', e.message));

const ONLY = process.argv.slice(2);
const wanted = name => !ONLY.length || ONLY.some(o => name.startsWith(o));
const results = { ok: [], fail: [] };
let signedIn = false;
let lastBadges = null;

async function snap(name, { full = true, clip = null } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(350);
  if (full && !clip) {
    // expansion reflows layout, so re-measure badge positions after it applies
    await expandPage(true);
    if (lastBadges) {
      await clearBadges(page);
      for (const [s, n] of lastBadges) await badge(page, s, n);
    }
  }
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: clip ? true : full, ...(clip ? { clip } : {}) });
  if (full && !clip) await expandPage(false);
  lastBadges = null;
  results.ok.push(name);
  console.log('  ✓', name);
}
// Full reload so health/business/agent-poll refetch under the new stage (hash-only
// changes don't reload the app), then set the route and wait for its content.
async function go(hash, waitSel) {
  await page.goto('about:blank'); // force a real reload — hash-only gotos don't refetch
  await page.goto(BASE + '/#' + hash, { waitUntil: 'domcontentloaded' });
  if (waitSel) await page.waitForSelector(waitSel, { timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);
  await clearBadges(page);
}
const b = specs => { lastBadges = specs; return Promise.all(specs.map(([sel, n]) => badge(page, sel, n))); };

// Wrap each shot: one failure logs and the run continues.
async function shot(name, fn) {
  if (!wanted(name)) return;
  try { await fn(); }
  catch (e) { results.fail.push(name); console.log(`  ✗ ${name}: ${e.message.split('\n')[0]}`); }
}

const STAGE = o => setStage({ brain: 1, devin: 1, heygen: 1, chat: 1, busy: 0, ...o });
const ALL = 'profile,offer,research,visibility,strategy,content,video,calendar,automation,tracker,action-plan';
const THROUGH = (...ids) => ['profile', ...ids].join(',');

// ---------- external-site illustrations (dev/ext/*.html → guide/ext/*.png) ----------
// `node dev/shots.mjs ext` renders only these; names are also matched individually.
if (ONLY.includes('ext')) {
  const EXT = [
    ['devin-settings-api', 'dev/ext/devin-settings-api.html'],
    ['devin-key-dialog', 'dev/ext/devin-key-dialog.html'],
  ];
  fs.mkdirSync(path.join(OUT, 'ext'), { recursive: true });
  for (const [name, file] of EXT) {
    try {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
      const p = await ctx2.newPage();
      await p.goto('file://' + path.resolve(ROOT, file));
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, 'ext', name + '.png') });
      await ctx2.close();
      results.ok.push('ext/' + name);
      console.log('  ✓ ext/' + name);
    } catch (e) {
      results.fail.push('ext/' + name);
      console.log(`  ✗ ext/${name}: ${e.message.split('\n')[0]}`);
    }
  }
}

// ---------- signed-out shots ----------
await shot('01-landing', async () => {
  await STAGE({ done: '', brain: 0, chat: 0 });
  await go('', '.landing-hero');
  await b([['.landing-ctas .btn.primary.lg', 1], ['.landing-nav a.btn', 2]]);
  await snap('01-landing', { full: false });
});
await shot('01b-landing-full', async () => { await snap('01b-landing-full'); });

await shot('02-login-create', async () => {
  await go('login', '.login-card');
  await page.click('button[role="tab"]:has-text("Create account")');
  await b([['button[role="tab"]:has-text("Create account")', 1], ['#login-email', 2], ['#login-pass', 3], ['form.login-card > .btn.primary', 4]]);
  await snap('02-login-create', { full: false });
});

await shot('03-login-check-email', async () => {
  await go('login', '.login-card');
  await page.click('button[role="tab"]:has-text("Create account")');
  await page.fill('#login-email', 'newuser@example.com');
  await page.fill('#login-pass', 'password123');
  await page.click('form.login-card > .btn.primary');
  await page.waitForSelector('.msg', { timeout: 15000 });
  await clearBadges(page);
  await b([['.msg', 1]]);
  await snap('03-login-check-email', { full: false });
});

await shot('04-login-signin', async () => {
  await go('login', '.login-card');
  await page.fill('#login-email', 'maria@example.com');
  await page.fill('#login-pass', 'password123');
  await clearBadges(page);
  await b([['#login-email', 1], ['#login-pass', 2], ['form.login-card > .btn.primary', 3]]);
  await snap('04-login-signin', { full: false });
  // Now actually sign in — the session is real from here on.
  await page.click('form.login-card > .btn.primary');
  await page.waitForSelector('.rail', { timeout: 20000 });
  signedIn = true;
});

// Filtered runs skip 04 — sign in through the real UI first when needed.
async function ensureSignedIn() {
  if (signedIn) return;
  await page.goto(BASE + '/#login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', 'maria@example.com');
  await page.fill('#login-pass', 'password123');
  await page.click('form.login-card > .btn.primary');
  await page.waitForSelector('.rail', { timeout: 20000 });
  signedIn = true;
}

// ---------- signed-in shots ----------
await ensureSignedIn();
await shot('05-setup-needed', async () => {
  await STAGE({ done: ALL, devin: 0, heygen: 0 });
  await go('setup', '.setup-group');
  await expandPage(true); // expand before measuring the clip + badges
  await b([['.setup-account a.btn', 1], ['#devin-key', 2], ['#devin-org', 3], ['.key-form .btn.primary', 4]]);
  await snap('05-setup-needed', { clip: await clipRange('.step-head h1', '.setup-group:has(h2:has-text("Optional extras"))') });
});

await shot('06-setup-ready', async () => {
  await STAGE({ done: ALL });
  await go('setup', '.setup-group');
  await expandPage(true);
  // "Start with your profile" sits in .actions below Integrations — hide that
  // section for this shot so the clip stays short but still keeps badge 2.
  await page.addStyleTag({ content: '.setup-group:has(h2:has-text("Integrations")){display:none}' });
  await b([['.step-head p', 1], ['a.btn.primary[href="#profile"]', 2]]);
  await snap('06-setup-ready', { clip: await clipRange('.step-head h1', '.actions') });
});

await shot('07-setup-heygen', async () => {
  await STAGE({ done: ALL, heygen: 0 });
  await go('setup', '.setup-group');
  await expandPage(true);
  await b([['button:has-text("Connect HeyGen")', 1]]);
  await snap('07-setup-heygen', { clip: await clipRange('.step-head h1', '.setup-group:has(h2:has-text("Optional extras"))') });
});

await shot('08-start-here', async () => {
  await STAGE({ done: '', brain: 0, chat: 0 });
  await go('', '.guide');
  await b([['.rail a.start-here', 1], ['a.btn.primary[href="#brain"]', 2], ['h2:has-text("How every step works")', 3]]);
  await snap('08-start-here');
});

await shot('09-anatomy', async () => {
  await STAGE({ done: '', brain: 1, chat: 0 });
  await go('offer', '.inputs');
  await scrollTo(page, '.inputs .actions .btn.primary'); // form + button both on screen
  await page.evaluate(() => document.querySelector('.main')?.scrollBy(0, -150)); // reveal the step-guide summary too
  await b([['.rail nav', 1], ['.inputs', 2], ['.inputs .actions .btn.primary', 3], ['.composer textarea', 4], ['.step-guide summary', 5]]);
  await snap('09-anatomy', { full: false });
});

await shot('10-brain', async () => {
  await STAGE({ done: '', brain: 0, chat: 0 }); // brand new user: profile stays blank
  await go('brain', '.brain-sections');
  await page.waitForTimeout(800); // BrainGraph lazy-load
  await b([['.brain-section summary', 1], ['.tag-pick', 2], ['.brain-section summary .chip', 3]]);
  await snap('10-brain');
});

await shot('11-brain-actions', async () => {
  await STAGE({ done: ALL, brain: 1 });
  await go('brain', '.brain-sections');
  await page.locator('.actions.sticky').scrollIntoViewIfNeeded();
  const n3 = (await page.$('button:has-text("Work out")')) ? [['button:has-text("Work out")', 3]] : [];
  await b([['.actions.sticky .btn:first-child', 1], ['.actions.sticky .btn.primary', 2], ...n3]);
  await snap('11-brain-actions', { clip: await clipOf(page, '.actions.sticky', 60) });
});

await shot('12-profile', async () => {
  await STAGE({ done: '', brain: 0, chat: 0 });
  await go('profile', '.inputs.profile');
  await expandPage(true);
  await b([['.unsure', 1], ['.inputs.profile .actions .btn.primary', 2]]);
  await snap('12-profile', { clip: await clipRange('.step-head h1', '.inputs.profile .actions') });
});

await shot('13-offer-empty', async () => {
  await STAGE({ done: '', brain: 1, chat: 0 });
  await go('offer', '.inputs');
  await expandPage(true);
  await b([['#f-sell', 1], ['#f-price', 2], ['#f-window', 3], ['.inputs .actions .btn.primary', 4]]);
  await snap('13-offer-empty', { clip: await clipRange('.step-head h1', '.inputs .actions') });
});

await shot('14-chat-question', async () => {
  await STAGE({ done: '', brain: 1, chat: 1 });
  await go('offer', '.msg.agent');
  await b([['.msg.agent', 1], ['.composer textarea', 2], ['.composer .btn.primary', 3]]);
  await snap('14-chat-question', { clip: await clipOf(page, 'aside.side') });
});

await shot('15-offer-done', async () => {
  await STAGE({ done: 'profile,offer' });
  await go('offer', 'article.doc');
  await b([['.doc-bar .btn.ghost', 1], ['.history summary', 2], ['.next .btn', 3], ['.inputs-fold summary', 4]]);
  await snap('15-offer-done');
});

await shot('16-research', async () => {
  await STAGE({ done: THROUGH('offer', 'research') });
  await go('research', 'article.doc');
  await b([['.prose h1', 1]]);
  await snap('16-research');
});

await shot('17-visibility', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility') });
  await go('visibility', 'article.doc');
  await b([['.prose h1', 1]]);
  await snap('17-visibility');
});

await shot('18-strategy', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy') });
  await go('strategy', '.experiment-card');
  await b([['.experiment-card', 1], ['.experiments-head .btn', 2]]);
  await snap('18-strategy');
});

await shot('19-content', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content') });
  await go('content', 'article.doc');
  await b([['.doc-bar .btn.ghost', 1]]);
  await snap('19-content');
});

await shot('20-video-kit', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content') });
  await go('video', '.heygen-card');
  await b([['.heygen-card', 1], ['#new-video', 2], ['.panel .actions .btn.primary', 3]]);
  await snap('20-video-kit');
});

await shot('21-video-make', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content') });
  await go('video', '.heygen-card');
  await page.locator('section.panel:has-text("From your content kit") .heygen-card').first().click();
  await page.waitForSelector('form.heygen .heygen-card', { timeout: 15000 });
  await clearBadges(page);
  await b([['form.heygen .heygen-card', 1], ['#hg-script', 2], ['#hg-shape', 3], ['form.heygen .actions .btn.primary', 4], ['form.heygen .btn.ghost:has-text("Polish")', 5]]);
  await snap('21-video-make');
});

await shot('22-video-done', async () => {
  await STAGE({ done: ALL });
  await go('video', 'figure.render video');
  await b([['figure.render video', 1], ['figure.render a[download]', 2]]);
  await snap('22-video-done');
});

await shot('23-calendar', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content', 'calendar') });
  await go('calendar', '.cal-main');
  await page.locator('.cal-main').first().click();
  await page.waitForSelector('.cal-body');
  await clearBadges(page);
  await b([['.cal-check', 1], ['.cal-body p', 2], ['.cal-body .btn.ghost', 3], ['.inputs-fold summary', 4]]);
  await snap('23-calendar');
});

await shot('24-automation', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content', 'calendar', 'automation') });
  await go('automation', 'article.doc');
  await b([['.prose h1', 1]]);
  await snap('24-automation');
});

await shot('25-tracker', async () => {
  await STAGE({ done: THROUGH('offer', 'research', 'visibility', 'strategy', 'content', 'calendar', 'automation', 'tracker') });
  await go('tracker', '.lead-form');
  await b([['.lead-form-link input', 1], ['.lead-form-link .btn.ghost', 2], ['.tracker-bar .btn.primary', 3], ['.tracker-bar .btn:not(.primary)', 4], ['table.tracker tbody tr select[aria-label="Stage"]', 5]]);
  await snap('25-tracker');
});

await shot('26-action-plan', async () => {
  await STAGE({ done: ALL });
  await go('action-plan', 'article.doc');
  await b([['.prose h1', 1], ['.rail-foot a[download]', 2]]);
  await snap('26-action-plan');
});

await shot('27-rail-foot', async () => {
  await STAGE({ done: ALL });
  await go('guide', '.guide');
  await expandPage(true); // .rail inner-scrolls — expand before measuring or rail-foot paints blank
  await b([['.rail-foot a[download]', 1], ['.rail-foot a.setup-link[href="#setup"]', 2], ['.rail-foot .btn.ghost', 3]]);
  await snap('27-rail-foot', { clip: await clipOf(page, '.rail-foot') });
});

await shot('28-progress', async () => {
  await STAGE({ done: ALL });
  await go('guide', '.guide');
  await b([['.progress', 1], ['.steps a.done', 2], ['.countdown', 3]]);
  await snap('28-progress', { clip: await clipOf(page, '.rail') });
});

await shot('29-busy', async () => {
  await STAGE({ done: ALL, busy: 1 });
  await go('research', '.side-status');
  await page.locator('.inputs-fold summary').click(); // reveal disabled button + "is busy" hint
  await page.waitForSelector('.inputs .actions .btn.primary[disabled]');
  await scrollTo(page, '.inputs .actions');
  await clearBadges(page);
  await b([['.side-status', 1], ['.inputs .actions', 2]]);
  await snap('29-busy', { full: false });
});

await browser.close();
console.log(`\nDone — ${results.ok.length} ok, ${results.fail.length} failed${results.fail.length ? ': ' + results.fail.join(', ') : ''} → ${OUT}`);
