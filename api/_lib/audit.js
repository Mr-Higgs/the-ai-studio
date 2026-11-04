// Local visibility health check — deterministic fetches against the owner's website plus
// the Google listing Studio already read. No LLM; plain-English results for the owner.
import net from 'node:net';

// localhost names, .local/.internal, and literal IPs in private/loopback/link-local ranges.
export function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const kind = net.isIP(h);
  if (kind === 4) {
    const o = h.split('.').map(Number);
    return o[0] === 0 || o[0] === 10 || o[0] === 127
      || (o[0] === 169 && o[1] === 254)
      || (o[0] === 172 && o[1] >= 16 && o[1] <= 31)
      || (o[0] === 192 && o[1] === 168);
  }
  if (kind === 6) {
    const first = parseInt(h.split('%')[0].split(':')[0] || '0', 16);
    if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
    if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7
    if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10
  }
  return false;
}

// Fetch with SSRF guard: http/https to public hosts only, ≤5 manual redirects re-checked
// each hop, AbortController timeout, body truncated at maxBytes.
export async function safeFetch(url, { fetchImpl = fetch, timeoutMs = 10000, maxBytes = 1_000_000 } = {}) {
  let current = new URL(url);
  for (let hop = 0; hop <= 5; hop++) {
    if (!/^https?:$/.test(current.protocol)) throw new Error('not an http(s) address');
    if (isPrivateHost(current.hostname)) throw new Error('that address is private');
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let r;
    try { r = await fetchImpl(current.toString(), { redirect: 'manual', signal: ac.signal }); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'timed out' : (e.message || 'unreachable')); }
    finally { clearTimeout(timer); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      if (hop === 5) throw new Error('too many redirects');
      current = new URL(r.headers.get('location'), current);
      continue;
    }
    const text = (await r.text()).slice(0, maxBytes);
    return { ok: r.ok, status: r.status, url: current.toString(), text, headers: r.headers };
  }
}

const noSite = { status: 'skip', detail: 'No website yet — add it in your Business profile.', fix: 'Add your website in the Business profile step.' };
const text = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
const digits = s => String(s || '').replace(/\D/g, '');
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const bare = h => h.replace(/^www\./, '');
const normalizeSiteUrl = raw => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch { return null; }
};

const LOCAL_TYPES = new Set(['AutoRepair', 'Dentist', 'Plumber', 'Electrician', 'Restaurant', 'HairSalon', 'Store', 'LegalService', 'MedicalBusiness', 'HomeAndConstructionBusiness', 'ProfessionalService']);
const isLocal = t => LOCAL_TYPES.has(t) || /Business$/.test(t);

const CHECKS = [
  { id: 'site_reachable', title: 'Your website loads' },
  { id: 'canonical_host', title: 'Your site has one official address' },
  { id: 'robots_allows', title: 'Google is allowed to read your site' },
  { id: 'sitemap', title: 'Your site has a page map for Google' },
  { id: 'title_h1', title: 'Your home page has a clear title and headline' },
  { id: 'schema_local', title: 'Your site describes your business to Google' },
  { id: 'nap_phone', title: 'Your phone number is on your site' },
  { id: 'nap_address', title: 'Your address is on your site' },
  { id: 'gbp_website', title: 'Google links your listing to your website' },
  { id: 'gbp_category', title: 'Your Google listing has a category' },
  { id: 'gbp_description', title: 'Your Google listing describes what you do' },
  { id: 'gbp_hours', title: 'Your Google listing shows your hours' },
  { id: 'llms_txt', title: 'AI assistants can read your site' },
];

// Checks a website session can actually fix (everything except the Google-listing ones).
export const SITE_CHECKS = ['site_reachable', 'canonical_host', 'robots_allows', 'sitemap', 'title_h1', 'schema_local', 'nap_phone', 'nap_address', 'llms_txt'];

export async function runAudit({ siteUrl, gbp, profile, fetchImpl = fetch } = {}) {
  const site = normalizeSiteUrl(siteUrl || profile?.website || gbp?.website);
  const go = (id, detail) => ({ id, title: CHECKS.find(c => c.id === id).title, ...detail });
  const checks = [];
  const push = (id, detail) => checks.push(go(id, detail));

  // Shared fetches, each done once and reused across checks.
  let home = null, homeErr = null, robots = null, sitemapXml = null;
  if (site) {
    try { home = await safeFetch(site, { fetchImpl }); } catch (e) { homeErr = e; }
    const base = home ? home.url : site;
    try { robots = await safeFetch(new URL('/robots.txt', base).toString(), { fetchImpl }); } catch { robots = null; }
  }

  const wrap = async (id, fn) => {
    if (!site) return push(id, noSite);
    try { push(id, await fn()); }
    catch (e) { push(id, { status: 'fail', detail: `Couldn't reach ${site}: ${e.message}`, fix: 'Check that your website is online, then run this check again.' }); }
  };

  await wrap('site_reachable', async () => {
    if (homeErr) throw homeErr;
    if (home.status !== 200) return { status: 'fail', detail: `Your website answered with an error (${home.status}) instead of a page.`, fix: 'Ask whoever hosts your website why the home page doesn’t load.' };
    return { status: 'pass', detail: 'Your home page loads fine.', fix: '' };
  });

  await wrap('canonical_host', async () => {
    if (homeErr) throw homeErr;
    const host = hostOf(home.url);
    const variant = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const variantUrl = `${new URL(home.url).protocol}//${variant}/`;
    let other = null;
    try { other = await safeFetch(variantUrl, { fetchImpl }); } catch { other = null; }
    const canon = home.text.match(/<link[^>]+rel=["']?canonical["']?[^>]*href=["']([^"']+)["']/i)
      || home.text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']?canonical["']?/i);
    const canonHost = canon ? bare(hostOf(canon[1])) : null;
    const samePlace = !other || (other.status >= 300 && other.status < 400) || bare(hostOf(other.url)) === bare(host);
    const canonOk = canonHost && canonHost === bare(host);
    if (samePlace && canonOk) return { status: 'pass', detail: 'Your site answers at one official address and marks it clearly for Google.', fix: '' };
    if (samePlace && !canonOk) return { status: 'warn', detail: 'Your site works at one address, but it doesn’t mark one official address for Google (a “canonical” tag).', fix: 'Ask your website tool or developer to add a canonical link tag to the home page — it tells Google which address is the official one.' };
    return { status: 'fail', detail: 'Your site answers at two different addresses, which splits how Google sees you.', fix: 'Make the www and non-www versions of your site redirect to one address, and add a canonical tag pointing at it.' };
  });

  let robotsSitemap = null;
  await wrap('robots_allows', async () => {
    if (robots && robots.status === 404) return { status: 'pass', detail: 'Nothing blocks Google from reading your site.', fix: '' };
    if (!robots) return { status: 'pass', detail: 'Nothing blocks Google from reading your site.', fix: '' };
    if (robots.status !== 200) return { status: 'warn', detail: `Your robots.txt answered ${robots.status}, so this couldn’t be fully checked.`, fix: 'Ask your website tool or developer to check the robots.txt file.' };
    let group = null, blocked = false;
    for (const line of robots.text.split(/\r?\n/)) {
      const m = line.match(/^\s*(user-agent|disallow|sitemap)\s*:\s*(.*?)\s*$/i);
      if (!m) continue;
      const [, key, val] = m;
      if (key.toLowerCase() === 'user-agent') { group = val.toLowerCase(); continue; }
      if (key.toLowerCase() === 'sitemap') { robotsSitemap ||= val; continue; }
      if (val === '/' && (group === '*' || (group || '').includes('googlebot'))) blocked = true;
    }
    if (blocked) return { status: 'fail', detail: 'Your robots.txt file tells Google not to read your whole site.', fix: 'Remove the “Disallow: /” line from robots.txt so Google can read your pages.' };
    return { status: 'pass', detail: 'Your robots.txt lets Google read your site.', fix: '' };
  });

  await wrap('sitemap', async () => {
    const base = home ? home.url : site;
    const target = robotsSitemap || new URL('/sitemap.xml', base).toString();
    try { sitemapXml = await safeFetch(target, { fetchImpl }); } catch (e) {
      return { status: 'fail', detail: `Couldn't reach your page map at ${target}: ${e.message}`, fix: 'Ask your website tool to publish a sitemap at /sitemap.xml.' };
    }
    if (sitemapXml.status === 200 && /<loc>/i.test(sitemapXml.text))
      return { status: 'pass', detail: 'Your page map (sitemap) lists pages for Google to read.', fix: '' };
    return { status: 'fail', detail: 'Your site has no working page map (sitemap), so Google may miss pages.', fix: 'Turn on the sitemap in your website tool — most publish it at /sitemap.xml automatically.' };
  });

  await wrap('title_h1', async () => {
    if (homeErr) throw homeErr;
    const t = home.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = t ? t[1].trim() : '';
    const h1s = (home.text.match(/<h1[\s>]/gi) || []).length;
    if (!title || h1s === 0) return { status: 'fail', detail: `Your home page is missing ${!title ? 'a title' : 'a main headline (H1)'} — the first thing searchers and Google read.`, fix: 'Give your home page a title like “Brake repair in Decatur | Maple Street Auto” and one headline saying what you do and where.' };
    if (title.length < 15 || title.length > 70 || h1s > 1) {
      const why = h1s > 1 ? 'Your home page has more than one main headline (H1), which muddles what it’s about.' : `Your home page title is ${title.length < 15 ? 'too short' : 'too long'} (${title.length} characters — aim for 15–70).`;
      return { status: 'warn', detail: why, fix: h1s > 1 ? 'Keep one H1 headline and make the others H2 or smaller.' : 'Rewrite the title to name your service and town in 15–70 characters.' };
    }
    return { status: 'pass', detail: 'Your title and headline are clear and the right length.', fix: '' };
  });

  await wrap('schema_local', async () => {
    if (homeErr) throw homeErr;
    const nodes = [];
    for (const m of home.text.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const parsed = JSON.parse(m[1]);
        for (const n of Array.isArray(parsed) ? parsed : [parsed]) {
          nodes.push(n);
          if (Array.isArray(n?.['@graph'])) nodes.push(...n['@graph']);
        }
      } catch { /* tolerate bad json-ld */ }
    }
    const local = nodes.find(n => [].concat(n?.['@type'] || []).some(isLocal));
    if (!local) return { status: 'fail', detail: 'Your site doesn’t label itself as a local business in a way Google can read (LocalBusiness “structured data”).', fix: 'Add a LocalBusiness structured-data block to your home page with your name, phone, address and opening hours — your website tool or Devin can write it.' };
    const missing = ['telephone', 'address'].filter(f => !local[f]);
    if (!local.openingHours && !local.openingHoursSpecification) missing.push('opening hours');
    if (missing.length) return { status: 'warn', detail: `Your site labels itself as a local business but leaves out ${missing.join(' and ')}.`, fix: 'Add the missing details to the LocalBusiness block on your home page.' };
    return { status: 'pass', detail: 'Your site labels your name, phone, address and hours for Google.', fix: '' };
  });

  if (!gbp?.phone) push('nap_phone', { status: 'skip', detail: 'No phone number on your Google listing to compare against.', fix: '' });
  else await wrap('nap_phone', async () => {
    if (homeErr) throw homeErr;
    const want = digits(gbp.phone).slice(-10);
    const has = digits(text(home.text)).includes(want);
    const tel = /href=["']tel:/i.test(home.text);
    if (has && tel) return { status: 'pass', detail: 'Your phone number is on your site and tappable on phones.', fix: '' };
    if (has) return { status: 'warn', detail: 'Your phone number is on your site but isn’t a tap-to-call link.', fix: 'Make the phone number a “tel:” link so visitors on phones can tap to call.' };
    return { status: 'fail', detail: 'The phone number on your Google listing doesn’t appear on your home page.', fix: 'Put the same phone number on your home page, formatted exactly as on Google.' };
  });

  if (!gbp?.address) push('nap_address', { status: 'skip', detail: 'No address on your Google listing to compare against.', fix: '' });
  else await wrap('nap_address', async () => {
    if (homeErr) throw homeErr;
    const page = text(home.text);
    let num = (gbp.address.match(/^(\d+[A-Za-z]?)\b/) || [])[1];
    const zip = (gbp.address.match(/\b(\d{5})(-\d{4})?\b/) || [])[1];
    if (num && num === zip) num = null;
    const hits = [num && page.includes(num), zip && page.includes(zip)].filter(Boolean).length;
    if (hits === 2) return { status: 'pass', detail: 'Your street address on the site matches your Google listing.', fix: '' };
    if (hits === 1) return { status: 'warn', detail: 'Only part of your address appears on your home page.', fix: 'Write your full street address, city and ZIP on the page, matching your Google listing word for word.' };
    return { status: 'fail', detail: 'Your Google listing’s address doesn’t appear on your home page.', fix: 'Add your full address to your home page (the footer or contact section is fine), matching your Google listing.' };
  });

  // ---- Google Business Profile ----
  const gskip = why => ({ status: 'skip', detail: why, fix: 'Connect Google Business Profile in Setup so Studio can check it.' });
  if (!gbp) {
    push('gbp_website', gskip('No Google listing connected.'));
    push('gbp_category', gskip('No Google listing connected.'));
    push('gbp_description', gskip('No Google listing connected.'));
    push('gbp_hours', gskip('No Google listing connected.'));
  } else {
    if (!gbp.website) push('gbp_website', { status: 'fail', detail: 'Google doesn’t know about your website — your listing has no website link.', fix: 'Add your website address to your Google Business Profile.' });
    else if (site && bare(hostOf(gbp.website)) !== bare(hostOf(site))) push('gbp_website', { status: 'warn', detail: `Your Google listing links to ${hostOf(gbp.website)}, not ${hostOf(site)}.`, fix: 'Point your Google Business Profile website field at the same address as your real site.' });
    else push('gbp_website', { status: 'pass', detail: 'Your Google listing links to your website.', fix: '' });
    push('gbp_category', gbp.primaryCategory
      ? { status: 'pass', detail: `Your listing’s category is “${gbp.primaryCategory}”.`, fix: '' }
      : { status: 'fail', detail: 'Your Google listing has no category, so Google doesn’t know what you do.', fix: 'Set a primary category in your Google Business Profile.' });
    const desc = (gbp.description || '').length;
    push('gbp_description', desc >= 250
      ? { status: 'pass', detail: 'Your listing description is long enough to tell Google what you do.', fix: '' }
      : desc > 0
        ? { status: 'warn', detail: `Your listing description is only ${desc} characters — thin for Google and customers.`, fix: 'Expand your Google Business Profile description to at least 250 characters: what you do, where, and what you’re known for.' }
        : { status: 'fail', detail: 'Your Google listing has no description.', fix: 'Write a description in your Google Business Profile: what you do, where, and what you’re known for.' });
    push('gbp_hours', gbp.hours?.length
      ? { status: 'pass', detail: 'Your listing shows opening hours.', fix: '' }
      : { status: 'warn', detail: 'Your Google listing shows no opening hours.', fix: 'Add your hours in your Google Business Profile — customers call less when they can’t tell you’re open.' });
  }

  if (!site) push('llms_txt', noSite);
  else {
    try {
      const base = home ? home.url : site;
      const r = await safeFetch(new URL('/llms.txt', base).toString(), { fetchImpl });
      push('llms_txt', r.status === 200
        ? { status: 'pass', detail: 'Your site has an llms.txt file that helps AI assistants describe you.', fix: '' }
        : { status: 'warn', detail: 'No llms.txt file — a small file that helps AI assistants describe your business correctly.', fix: 'Add an llms.txt file at your site root summarizing who you are, where you are and what you do.' });
    } catch (e) {
      push('llms_txt', { status: 'warn', detail: `Couldn't check llms.txt: ${e.message}`, fix: 'Add an llms.txt file at your site root summarizing who you are, where you are and what you do.' });
    }
  }

  const total = checks.filter(c => c.status !== 'skip').length;
  return { score: checks.filter(c => c.status === 'pass').length, total, checkedAt: new Date().toISOString(), siteUrl: site, checks };
}
