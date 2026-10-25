import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAdSpend, metaGet, normalizeAccountId, syncAds } from './_lib/meta.js';
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
    { id: '123', name: 'First', status: 'ACTIVE', spend: 12.5, impressions: 20, clicks: 3, leads: 2 },
    { id: '789', name: 'Third', status: 'PAUSED', spend: 3.25, impressions: 8, clicks: 1, leads: 0 },
    { id: '456', name: 'No results', status: 'PAUSED', spend: 0, impressions: 0, clicks: 0, leads: 0 },
  ]);
  assert.equal(Number.isNaN(Date.parse(result.syncedAt)), false);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(url => url.searchParams.get('access_token') === 'SECRET'));
  assert.equal(calls.find(url => url.pathname.endsWith('/insights')).searchParams.get('date_preset'), 'maximum');
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
  });
  assert.doesNotMatch(JSON.stringify(item), /SECRET|act_123/);
});
