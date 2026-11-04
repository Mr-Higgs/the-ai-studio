import test from 'node:test';
import assert from 'node:assert/strict';

import { runAudit, safeFetch, isPrivateHost } from './_lib/audit.js';

const HOME = `<!doctype html><html><head>
<title>Brake repair in Decatur | Maple Street Auto</title>
<link rel="canonical" href="https://maple.example.com/">
<script type="application/ld+json">{"@type":"AutoRepair","name":"Maple Street Auto","telephone":"(404) 555-0100","address":"1234 Maple St SE, Decatur, GA, 30030","openingHours":"Mo-Fr 08:00-18:00"}</script>
</head><body><h1>Honest auto repair in Decatur</h1>
<p>Call <a href="tel:+14045550100">(404) 555-0100</a> · 1234 Maple St SE, Decatur, GA 30030</p>
</body></html>`;

const GBP = {
  phone: '(404) 555-0100',
  address: '1234 Maple St SE, Decatur, GA, 30030',
  website: 'https://maple.example.com',
  primaryCategory: 'Auto repair shop',
  description: 'x'.repeat(300),
  hours: [{ openDay: 'MONDAY' }],
};

const res = (status, body = '', headers = {}) => new Response(body, { status, headers });

// Canned internet: apex serves HOME, www redirects to it, robots/sitemap/llms behave.
const fakeFetch = (overrides = {}) => async url => {
  for (const [match, r] of Object.entries(overrides)) if (url.includes(match)) return typeof r === 'function' ? r(url) : r;
  if (url.startsWith('https://www.maple.example.com')) return res(301, '', { location: 'https://maple.example.com/' });
  if (url === 'https://maple.example.com/robots.txt') return res(404);
  if (url === 'https://maple.example.com/sitemap.xml') return res(200, '<?xml version="1.0"?><urlset><loc>https://maple.example.com/</loc></urlset>');
  if (url === 'https://maple.example.com/llms.txt') return res(200, '# Maple Street Auto');
  if (url.startsWith('https://maple.example.com')) return res(200, HOME, { 'content-type': 'text/html' });
  return res(404);
};

const byId = (audit, id) => audit.checks.find(c => c.id === id);

test('all-pass fixture scores every check', async () => {
  const audit = await runAudit({ siteUrl: 'maple.example.com', gbp: GBP, fetchImpl: fakeFetch() });
  assert.equal(audit.siteUrl, 'https://maple.example.com/');
  assert.equal(audit.score, audit.total);
  assert.ok(audit.total >= 10);
  assert.ok(audit.checks.every(c => c.status === 'pass'));
  assert.ok(Date.parse(audit.checkedAt));
});

test('robots.txt Disallow: / fails', async () => {
  const audit = await runAudit({
    siteUrl: 'maple.example.com', gbp: GBP,
    fetchImpl: fakeFetch({ 'robots.txt': res(200, 'User-agent: *\nDisallow: /\n') }),
  });
  assert.equal(byId(audit, 'robots_allows').status, 'fail');
});

test('robots.txt stacked user-agents block fails, partial disallow passes', async () => {
  const run = body => runAudit({
    siteUrl: 'maple.example.com', gbp: GBP,
    fetchImpl: fakeFetch({ 'robots.txt': res(200, body) }),
  });
  assert.equal(byId(await run('User-agent: Googlebot\nUser-agent: *\nDisallow: /\n'), 'robots_allows').status, 'fail');
  assert.equal(byId(await run('User-agent: *\nDisallow: /admin\n'), 'robots_allows').status, 'pass');
});

test('redirecting variant without canonical tag warns', async () => {
  const audit = await runAudit({
    siteUrl: 'maple.example.com', gbp: GBP,
    fetchImpl: fakeFetch({ 'https://maple.example.com/': u => u === 'https://maple.example.com/' ? res(200, HOME.replace(/<link rel="canonical"[^>]*>\n?/, '')) : res(404) }),
  });
  assert.equal(byId(audit, 'canonical_host').status, 'warn');
});

test('nap_address needs a street number distinct from the zip', async () => {
  const run = address => runAudit({
    siteUrl: 'maple.example.com', gbp: { ...GBP, address },
    fetchImpl: fakeFetch(),
  });
  // No street number in the gbp address: the ZIP appearing on the page alone is a warn, not a pass.
  assert.equal(byId(await run('Opa-locka, FL 30030'), 'nap_address').status, 'warn');
  // Street number + zip both on the page → pass (1234 and 30030 are both in the HOME fixture).
  assert.equal(byId(await run('1234 NW 27th Ave, Opa-locka, FL 30030'), 'nap_address').status, 'pass');
});

test('missing LocalBusiness schema fails', async () => {
  const audit = await runAudit({
    siteUrl: 'maple.example.com', gbp: GBP,
    fetchImpl: fakeFetch({ 'https://maple.example.com/': u => u === 'https://maple.example.com/' ? res(200, HOME.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')) : res(404) }),
  });
  assert.equal(byId(audit, 'schema_local').status, 'fail');
});

test('safeFetch blocks private, local and non-http targets', async () => {
  for (const url of ['http://127.0.0.1/', 'http://10.0.0.1/', 'http://localhost/', 'ftp://x/'])
    await assert.rejects(() => safeFetch(url), /private|http/);
  await assert.rejects(
    () => safeFetch('https://maple.example.com/', { fetchImpl: async () => res(302, '', { location: 'http://192.168.1.1/' }) }),
    /private/,
  );
  assert.ok(isPrivateHost('fe80::1') && isPrivateHost('fd00::1') && isPrivateHost('::1') && isPrivateHost('x.internal') && isPrivateHost('printer.local'));
  assert.ok(!isPrivateHost('maple.example.com') && !isPrivateHost('8.8.8.8'));
});

test('no site URL skips site checks and counts only gbp checks', async () => {
  const audit = await runAudit({ siteUrl: null, gbp: { ...GBP, website: null }, fetchImpl: fakeFetch() });
  const site = audit.checks.filter(c => c.id.startsWith('site_') || ['canonical_host', 'robots_allows', 'sitemap', 'title_h1', 'schema_local', 'nap_phone', 'nap_address', 'llms_txt'].includes(c.id));
  assert.ok(site.every(c => c.status === 'skip'));
  assert.equal(audit.total, audit.checks.filter(c => c.id.startsWith('gbp_')).length);
  assert.equal(audit.siteUrl, null);
});

test('no gbp skips the listing checks', async () => {
  const audit = await runAudit({ siteUrl: 'maple.example.com', gbp: null, fetchImpl: fakeFetch() });
  assert.ok(audit.checks.filter(c => c.id.startsWith('gbp_')).every(c => c.status === 'skip'));
  assert.ok(audit.checks.filter(c => c.status === 'skip').length >= 4);
});
