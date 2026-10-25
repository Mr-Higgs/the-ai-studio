import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAdSpend, findInstagramAccounts, metaGet, normalizeAccountId, syncAds, syncInstagram, tryConnectInstagram } from './_lib/meta.js';
import { contextParts, buildContext } from './_lib/prompts.js';
import { metaHealthItem } from './index.js';

test('normalizeAccountId accepts numeric Meta account IDs only', () => {
  assert.equal(normalizeAccountId('123'), 'act_123');
  assert.equal(normalizeAccountId('act_123'), 'act_123');
  assert.equal(normalizeAccountId(' act_12 '), 'act_12');
  assert.equal(normalizeAccountId('abc'), null);
  assert.equal(normalizeAccountId(''), null);
});

test('syncAds follows pages, parses numbers, and counts only lead actions', async () => {
  const calls = [];
  const fetchImpl = async rawUrl => {
    const url = new URL(rawUrl);
    calls.push(url);
    const page = url.searchParams.get('after');
    let body;
    if (url.pathname.endsWith('/campaigns')) {
      body = page
        ? { data: [{ id: '789', name: 'Third', effective_status: 'PAUSED' }] }
        : {
          data: [
            { id: '123', name: 'First', effective_status: 'ACTIVE' },
            { id: '456', name: 'No results', effective_status: 'PAUSED' },
          ],
          paging: { next: `${url.origin}${url.pathname}?after=campaigns&access_token=SECRET` },
        };
    } else if (url.pathname.endsWith('/insights') && url.searchParams.get('breakdowns') === 'publisher_platform') {
      body = page
        ? { data: [{ campaign_id: '123', publisher_platform: 'facebook', spend: '45.40', impressions: '900', clicks: '20', actions: [{ action_type: 'lead', value: '4' }] }] }
        : {
          data: [{ campaign_id: '123', publisher_platform: 'instagram', spend: '80.00', impressions: '1200', clicks: '30', actions: [
            { action_type: 'onsite_conversion.lead_grouped', value: '99' },
            { action_type: 'lead', value: '7' },
          ] }],
          paging: { next: `${url.origin}${url.pathname}?after=platform2&breakdowns=publisher_platform&access_token=SECRET` },
        };
    } else if (url.pathname.endsWith('/insights')) {
      body = page
        ? { data: [{ campaign_id: '789', campaign_name: 'Third', spend: '3.25', impressions: '8', clicks: '1', actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '9' }] }] }
        : {
          data: [{ campaign_id: '123', campaign_name: 'First', spend: '12.50', impressions: '20', clicks: '3', actions: [
            { action_type: 'onsite_conversion.lead_grouped', value: '19' },
            { action_type: 'lead', value: '2' },
          ] }],
          paging: { next: `${url.origin}${url.pathname}?after=insights&access_token=SECRET` },
        };
    } else {
      body = { id: 'act_123', name: 'Studio account', currency: 'USD', account_status: 1 };
    }
    return { ok: true, json: async () => body };
  };
  const result = await syncAds({ token: 'SECRET', accountId: 'act_123' }, fetchImpl);

  assert.deepEqual(result.account, { id: 'act_123', name: 'Studio account', currency: 'USD' });
  assert.deepEqual(result.campaigns, [
    { id: '123', name: 'First', status: 'ACTIVE', spend: 12.5, impressions: 20, clicks: 3, leads: 2, platforms: {
      instagram: { spend: 80, impressions: 1200, clicks: 30, leads: 7 },
      facebook: { spend: 45.4, impressions: 900, clicks: 20, leads: 4 },
    } },
    { id: '789', name: 'Third', status: 'PAUSED', spend: 3.25, impressions: 8, clicks: 1, leads: 0, platforms: {} },
    { id: '456', name: 'No results', status: 'PAUSED', spend: 0, impressions: 0, clicks: 0, leads: 0, platforms: {} },
  ]);
  assert.equal(Number.isNaN(Date.parse(result.syncedAt)), false);
  assert.equal(calls.length, 7);
  assert.ok(calls.every(url => url.searchParams.get('access_token') === 'SECRET'));
  assert.ok(calls.some(url => url.searchParams.get('breakdowns') === 'publisher_platform'));
  assert.equal(calls.find(url => url.pathname.endsWith('/insights') && !url.searchParams.get('breakdowns')).searchParams.get('date_preset'), 'maximum');
  assert.equal(calls.find(url => url.searchParams.get('breakdowns') === 'publisher_platform').searchParams.get('date_preset'), 'maximum');
});

test('metaGet maps token and rate-limit errors to safe statuses', async () => {
  const response = body => async () => ({ ok: false, json: async () => body });
  await assert.rejects(metaGet('SECRET', 'act_123', {}, response({ error: { code: 190, message: 'expired' } })), error => {
    assert.equal(error.status, 400);
    assert.equal(error.message, 'Meta rejected the token. Paste a new one in Setup.');
    return true;
  });
  await assert.rejects(metaGet('SECRET', 'act_123/campaigns', {}, response({ error: { code: 17, message: 'slow down' } })), error => {
    assert.equal(error.status, 429);
    assert.equal(error.message, 'Meta is rate-limiting. Wait a minute and try again.');
    return true;
  });
  await assert.rejects(metaGet('SECRET', 'act_123', {}, response({ error: { code: 100, message: 'unknown account' } })), error => {
    assert.equal(error.status, 400);
    assert.match(error.message, /Check the ID/);
    return true;
  });
});

test('metaGet redacts secrets from Meta messages and paging request errors', async () => {
  await assert.rejects(metaGet('SECRET', 'act_123/campaigns', {}, async () => ({
    ok: false,
    json: async () => ({ error: { code: 999, message: 'Meta said access_token=SECRET was invalid' } }),
  })), error => {
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /SECRET/);
    return true;
  });

  let page = 0;
  await assert.rejects(metaGet('SECRET', 'act_123/campaigns', {}, async url => {
    page++;
    if (page === 1) return {
      ok: true,
      json: async () => ({ data: [], paging: { next: 'https://graph.facebook.com/v26.0/act_123/campaigns?access_token=SECRET&after=page2' } }),
    };
    throw new Error(`Failed ${url}`);
  }), error => {
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /SECRET/);
    return true;
  });
});

test('applyAdSpend updates linked experiments and reports no-op results', () => {
  const experiments = [
    { id: 'e1', campaignId: '123', spent: 4 },
    { id: 'e2', campaignId: null, spent: 2 },
  ];
  const campaigns = [{ id: '123', spend: 20 }];
  const changed = applyAdSpend(experiments, campaigns);
  assert.equal(changed.changed, true);
  assert.deepEqual(changed.items, [{ ...experiments[0], spent: 20 }, experiments[1]]);
  assert.equal(applyAdSpend(changed.items, campaigns).changed, false);
});

test('ad context follows experiments and no-ad business context stays unchanged', () => {
  const business = { profile: { name: 'A' }, experiments: [{ id: 'e1', name: 'Test' }] };
  const oldContext = buildContext(business, {});
  assert.equal(oldContext, 'Business profile (JSON): {"name":"A"}\n\nGrowth experiments (JSON): [{"id":"e1","name":"Test"}]');
  assert.doesNotMatch(oldContext, /Meta ad results/);

  const adBusiness = {
    ...business,
    adInsights: {
      syncedAt: '2026-01-02T03:04:05.000Z',
      account: { name: 'Studio account', currency: 'CAD' },
      campaigns: [{ id: '123', name: 'Campaign', spend: 1, impressions: 2, clicks: 3, leads: 4 }],
    },
  };
  const parts = contextParts(adBusiness, {});
  assert.deepEqual(parts.map(part => part.key), ['profile', 'experiments', 'ads']);
  assert.equal(parts[2].text, 'Meta ad results (read-only, pulled by Studio from the owner\'s ad account "Studio account", amounts in CAD, lifetime totals, synced 2026-01-02T03:04:05.000Z): [{"id":"123","name":"Campaign","spend":1,"impressions":2,"clicks":3,"leads":4}]');
});

test('Meta health item reports readiness without exposing stored credentials', () => {
  const item = metaHealthItem({ meta_access_token: 'SECRET', meta_ad_account_id: 'act_123' });
  assert.deepEqual(item, {
    id: 'meta_api',
    group: 'optional',
    name: 'Meta ad results',
    why: 'Studio reads spend, clicks and leads from your Meta ad account. Read-only.',
    ok: true,
    meta: true,
    instagram: null,
  });
  assert.doesNotMatch(JSON.stringify(item), /SECRET|act_123/);
  assert.equal(metaHealthItem({ meta_access_token: 'SECRET', meta_ad_account_id: 'act_123' }, 'studio').instagram, 'studio');
});

test('Instagram discovery skips pages without a connected Instagram account', async () => {
  const fetchImpl = async rawUrl => {
    const url = new URL(rawUrl);
    const body = url.searchParams.has('after')
      ? { data: [{ name: 'Page B', instagram_business_account: { id: '1789', username: 'studio' } }] }
      : { data: [{ name: 'Page A' }], paging: { next: `${url.origin}${url.pathname}?after=next` } };
    return { ok: true, json: async () => body };
  };
  assert.deepEqual(await findInstagramAccounts('SECRET', fetchImpl), [
    { id: '1789', username: 'studio', page: 'Page B' },
  ]);
});

test('Instagram sync uses a 28-day window, limits media to one page, and tolerates post insight errors', async () => {
  const calls = [];
  const media = [
    { id: 'p1', caption: 'x'.repeat(200), media_type: 'IMAGE', permalink: 'https://instagram.test/p/1', timestamp: '2026-01-02T00:00:00Z', like_count: '4', comments_count: '2' },
    { id: 'p2', caption: 'short', media_product_type: 'REELS', permalink: 'https://instagram.test/reel/2', timestamp: '2026-01-01T00:00:00Z', like_count: '1', comments_count: '0' },
  ];
  const fetchImpl = async rawUrl => {
    const url = new URL(rawUrl);
    calls.push(url);
    let body;
    if (url.pathname.endsWith('/1789/media')) {
      assert.equal(url.searchParams.get('limit'), '12');
      body = { data: media, paging: { next: `${url.origin}${url.pathname}?after=second` } };
    } else if (url.pathname.endsWith('/1789/insights')) {
      body = { data: ['reach', 'views', 'accounts_engaged', 'total_interactions'].map((name, index) => ({ name, total_value: { value: index + 10 } })) };
    } else if (url.pathname.endsWith('/p2/insights')) {
      body = { error: { code: 10, message: 'not supported for this media type' } };
      return { ok: false, json: async () => body };
    } else if (url.pathname.endsWith('/p1/insights')) {
      body = { data: ['reach', 'views', 'saved', 'shares', 'total_interactions'].map((name, index) => ({ name, total_value: { value: index + 1 } })) };
    } else {
      body = { username: 'studio', followers_count: '150', media_count: '20' };
    }
    return { ok: true, json: async () => body };
  };
  const result = await syncInstagram({ token: 'SECRET', igId: '1789' }, fetchImpl);
  const accountCall = calls.find(url => url.pathname.endsWith('/1789/insights'));
  const since = Number(accountCall.searchParams.get('since'));
  const until = Number(accountCall.searchParams.get('until'));
  assert.equal(until - since, 28 * 24 * 60 * 60);
  assert.equal(accountCall.searchParams.get('metric'), 'reach,views,accounts_engaged,total_interactions');
  assert.equal(accountCall.searchParams.get('period'), 'day');
  assert.equal(accountCall.searchParams.get('metric_type'), 'total_value');
  assert.deepEqual(result.account, { id: '1789', username: 'studio', followers: 150, mediaCount: 20 });
  assert.deepEqual(result.last28, { reach: 10, views: 11, accountsEngaged: 12, interactions: 13 });
  assert.equal(result.posts[0].caption.length, 140);
  assert.equal(result.posts[0].caption.endsWith('…'), true);
  assert.equal(result.posts[0].interactions, 5);
  assert.deepEqual(
    [result.posts[1].reach, result.posts[1].views, result.posts[1].saved, result.posts[1].shares, result.posts[1].interactions],
    [null, null, null, null, null],
  );
  assert.equal(calls.filter(url => url.pathname.endsWith('/1789/media')).length, 1);
  assert.equal(calls.some(url => url.searchParams.get('after') === 'second'), false);
});

test('Instagram permission errors map to the Setup guidance and discovery failure is non-fatal', async () => {
  const permissionMessage = "Your Meta token can't read Instagram yet. Add instagram_basic, instagram_manage_insights and pages_read_engagement to it, and assign your Facebook Page to the system user.";
  for (const code of [10, 200]) {
    await assert.rejects(metaGet('SECRET', '1789/insights', {}, async () => ({
      ok: false,
      json: async () => ({ error: { code, message: 'permission denied' } }),
    })), error => {
      assert.equal(error.status, 400);
      assert.equal(error.message, permissionMessage);
      return true;
    });
  }
  await assert.rejects(metaGet('SECRET', 'act_123/insights', {}, async () => ({
    ok: false,
    json: async () => ({ error: { code: 200, message: 'requires ads_read' } }),
  })), error => {
    assert.equal(error.status, 502);
    assert.match(error.message, /ads_read/);
    return true;
  });
  const connected = await tryConnectInstagram('SECRET', async () => { throw new Error('offline'); });
  assert.equal(connected.igId, null);
  assert.equal(connected.insights, null);
  assert.match(connected.instagram.error, /offline/);
});

test('Instagram context follows ads and is omitted when absent', () => {
  const business = {
    profile: { name: 'A' },
    experiments: [{ id: 'e1', name: 'Test' }],
    adInsights: { account: { name: 'Studio', currency: 'USD' }, syncedAt: 'now', campaigns: [{ id: 'c1' }] },
    instagramInsights: { account: { username: 'studio' }, last28: { reach: 1 }, posts: [], syncedAt: 'then' },
    calendar: [{ date: '2026-01-01' }],
  };
  const parts = contextParts(business, { offer: { content: 'Offer' } });
  assert.deepEqual(parts.map(part => part.key), ['profile', 'experiments', 'ads', 'instagram', 'doc:offer', 'calendar']);
  assert.equal(parts[3].text, 'Instagram organic results (read-only, pulled by Studio from @studio, last 28 days, synced then): {"account":{"username":"studio"},"last28":{"reach":1},"posts":[]}');
  assert.deepEqual(contextParts({ ...business, instagramInsights: null }, { offer: { content: 'Offer' } }).map(part => part.key), ['profile', 'experiments', 'ads', 'doc:offer', 'calendar']);
});
