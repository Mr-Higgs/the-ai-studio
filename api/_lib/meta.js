export const GRAPH = 'https://graph.facebook.com/v26.0';

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
const error = (status, message) => Object.assign(new Error(message), { status });
const INSTAGRAM_PERMISSION_MESSAGE = "Your Meta token can't read Instagram yet. Add instagram_basic, instagram_manage_insights and pages_read_engagement to it, and assign your Facebook Page to the system user.";
export const NO_INSTAGRAM_ACCOUNT_MESSAGE = 'No Instagram account found on your connected Facebook Pages.';

const redact = (value, token) => {
  let text = String(value ?? '')
    .replace(/\baccess_token=[^&#\s"'<>]*/gi, 'access_token=[redacted]');
  if (token) text = text.split(token).join('[redacted]');
  return text;
};

const metaError = (body, path, token) => {
  const code = Number(body?.error?.code);
  if (code === 190) return error(400, 'Meta rejected the token. Paste a new one in Setup.');
  if (RATE_LIMIT_CODES.has(code)) return error(429, 'Meta is rate-limiting. Wait a minute and try again.');
  if (code === 10 || code === 200) return error(400, INSTAGRAM_PERMISSION_MESSAGE);
  if (code === 100 && !path.includes('/'))
    return error(400, "Meta couldn't find that ad account. Check the ID (the number after act= in Ads Manager) and that the token can see it.");
  return error(502, redact(body?.error?.message || 'Meta could not complete the request.', token));
};

export function normalizeAccountId(raw) {
  const value = String(raw ?? '').trim();
  const match = value.match(/^(?:act_)?(\d+)$/i);
  return match ? `act_${match[1]}` : null;
}

export async function metaGet(token, path, params = {}, fetchImpl = fetch) {
  const url = new URL(`${GRAPH}/${String(path).replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  url.searchParams.set('access_token', token);

  let next = url.toString();
  let first;
  const data = [];
  for (let page = 0; next && page < 5; page++) {
    let response;
    let body;
    try {
      response = await fetchImpl(next, { method: 'GET' });
      body = await response.json();
    } catch (cause) {
      throw error(502, redact(cause?.message || 'Meta request failed.', token));
    }
    if (body?.error) throw metaError(body, path, token);
    if (!response.ok) throw error(502, redact(body?.message || 'Meta request failed.', token));
    if (first === undefined) first = body;
    if (Array.isArray(body?.data)) data.push(...body.data);
    next = typeof body?.paging?.next === 'string' ? body.paging.next : null;
  }
  if (first && Array.isArray(first.data)) return { ...first, data };
  return first;
}

async function metaGetFirstPage(token, path, params, fetchImpl) {
  const url = new URL(`${GRAPH}/${String(path).replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  url.searchParams.set('access_token', token);
  let response;
  let body;
  try {
    response = await fetchImpl(url.toString(), { method: 'GET' });
    body = await response.json();
  } catch (cause) {
    throw error(502, redact(cause?.message || 'Meta request failed.', token));
  }
  if (body?.error) throw metaError(body, path, token);
  if (!response.ok) throw error(502, redact(body?.message || 'Meta request failed.', token));
  return body;
}

const numeric = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const nullableNumeric = value => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const metricValue = row => nullableNumeric(row?.total_value?.value ?? row?.values?.[0]?.value ?? row?.value);
const instagramMetricMap = data => new Map((data?.data || []).map(row => [row.name, metricValue(row)]));
const truncatedCaption = caption => {
  const chars = Array.from(String(caption || ''));
  return chars.length <= 140 ? chars.join('') : `${chars.slice(0, 139).join('')}…`;
};

export async function findInstagramAccounts(token, fetchImpl = fetch) {
  const data = await metaGet(token, 'me/accounts', {
    fields: 'name,instagram_business_account{id,username}',
    limit: 100,
  }, fetchImpl);
  return (data?.data || []).flatMap(page => {
    const account = page.instagram_business_account;
    return account?.id ? [{
      id: String(account.id),
      username: account.username || '',
      page: page.name || '',
    }] : [];
  });
}

export async function syncInstagram({ token, igId }, fetchImpl = fetch) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 24 * 60 * 60;
  const [profile, insightData, mediaData] = await Promise.all([
    metaGet(token, igId, { fields: 'username,followers_count,media_count' }, fetchImpl),
    metaGet(token, `${igId}/insights`, {
      metric: 'reach,views,accounts_engaged,total_interactions',
      period: 'day',
      metric_type: 'total_value',
      since,
      until,
    }, fetchImpl),
    metaGetFirstPage(token, `${igId}/media`, {
      fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
      limit: 12,
    }, fetchImpl),
  ]);
  const accountMetrics = instagramMetricMap(insightData);
  const posts = await Promise.all((mediaData?.data || []).slice(0, 12).map(async media => {
    let metrics = {};
    try {
      const insights = await metaGet(token, `${media.id}/insights`, {
        metric: 'reach,views,saved,shares,total_interactions',
      }, fetchImpl);
      const values = instagramMetricMap(insights);
      metrics = {
        reach: values.get('reach') ?? null,
        views: values.get('views') ?? null,
        saved: values.get('saved') ?? null,
        shares: values.get('shares') ?? null,
        interactions: values.get('total_interactions') ?? null,
      };
    } catch {
      metrics = { reach: null, views: null, saved: null, shares: null, interactions: null };
    }
    return {
      id: String(media.id),
      caption: truncatedCaption(media.caption),
      type: media.media_product_type || media.media_type || '',
      permalink: media.permalink || '',
      timestamp: media.timestamp || '',
      likes: nullableNumeric(media.like_count),
      comments: nullableNumeric(media.comments_count),
      ...metrics,
    };
  }));
  return {
    syncedAt: new Date().toISOString(),
    account: {
      id: String(igId),
      username: profile.username || '',
      followers: nullableNumeric(profile.followers_count),
      mediaCount: nullableNumeric(profile.media_count),
    },
    last28: {
      reach: accountMetrics.get('reach') ?? null,
      views: accountMetrics.get('views') ?? null,
      accountsEngaged: accountMetrics.get('accounts_engaged') ?? null,
      interactions: accountMetrics.get('total_interactions') ?? null,
    },
    posts,
  };
}

export async function tryConnectInstagram(token, fetchImpl = fetch) {
  try {
    const accounts = await findInstagramAccounts(token, fetchImpl);
    const account = accounts[0];
    if (!account) return { igId: null, insights: null, instagram: { error: NO_INSTAGRAM_ACCOUNT_MESSAGE } };
    try {
      const insights = await syncInstagram({ token, igId: account.id }, fetchImpl);
      return { igId: account.id, insights, instagram: { username: insights.account.username || account.username } };
    } catch (cause) {
      return { igId: account.id, insights: null, instagram: { error: cause?.message || 'Instagram could not be synced.' } };
    }
  } catch (cause) {
    return { igId: null, insights: null, instagram: { error: cause?.message || 'Instagram discovery failed.' } };
  }
}

export async function syncAds({ token, accountId }, fetchImpl = fetch) {
  const insightParams = {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions',
    date_preset: 'maximum',
    limit: 100,
  };
  const [accountData, campaignsData, insightsData, platformInsightsData] = await Promise.all([
    metaGet(token, accountId, { fields: 'name,currency,account_status' }, fetchImpl),
    metaGet(token, `${accountId}/campaigns`, { fields: 'id,name,effective_status', limit: 100 }, fetchImpl),
    metaGet(token, `${accountId}/insights`, insightParams, fetchImpl),
    metaGet(token, `${accountId}/insights`, { ...insightParams, breakdowns: 'publisher_platform' }, fetchImpl),
  ]);
  const insightById = new Map();
  for (const row of insightsData?.data || []) {
    const id = String(row.campaign_id || '');
    if (!id) continue;
    const lead = (row.actions || []).find(action => action.action_type === 'lead');
    const values = {
      spend: numeric(row.spend),
      impressions: numeric(row.impressions),
      clicks: numeric(row.clicks),
      leads: numeric(lead?.value),
    };
    const previous = insightById.get(id);
    if (previous) {
      for (const key of Object.keys(values)) previous[key] += values[key];
    } else {
      insightById.set(id, values);
    }
  }
  const platformsByCampaign = new Map();
  for (const row of platformInsightsData?.data || []) {
    const id = String(row.campaign_id || '');
    const platform = row.publisher_platform;
    if (!id || typeof platform !== 'string' || !platform) continue;
    let platforms = platformsByCampaign.get(id);
    if (!platforms) platformsByCampaign.set(id, platforms = new Map());
    const lead = (row.actions || []).find(action => action.action_type === 'lead');
    const values = {
      spend: numeric(row.spend),
      impressions: numeric(row.impressions),
      clicks: numeric(row.clicks),
      leads: numeric(lead?.value),
    };
    const previous = platforms.get(platform);
    if (previous) {
      for (const key of Object.keys(values)) previous[key] += values[key];
    } else {
      platforms.set(platform, values);
    }
  }
  const campaigns = (campaignsData?.data || []).map(campaign => {
    const id = String(campaign.id);
    const insight = insightById.get(id) || {};
    return {
      id,
      name: campaign.name || '',
      status: campaign.effective_status || '',
      spend: insight.spend || 0,
      impressions: insight.impressions || 0,
      clicks: insight.clicks || 0,
      leads: insight.leads || 0,
      platforms: Object.fromEntries(platformsByCampaign.get(id) || []),
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 50);
  return {
    syncedAt: new Date().toISOString(),
    account: { id: accountId, name: accountData?.name || '', currency: accountData?.currency || '' },
    campaigns,
  };
}

export function applyAdSpend(experiments, campaigns) {
  const spendById = new Map((campaigns || []).map(campaign => [String(campaign.id), campaign.spend]));
  let changed = false;
  const items = (Array.isArray(experiments) ? experiments : []).map(experiment => {
    if (!spendById.has(experiment.campaignId)) return experiment;
    const spent = spendById.get(experiment.campaignId);
    if (experiment.spent === spent) return experiment;
    changed = true;
    return { ...experiment, spent };
  });
  return { items, changed };
}
