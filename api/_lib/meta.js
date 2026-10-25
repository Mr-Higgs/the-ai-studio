export const GRAPH = 'https://graph.facebook.com/v26.0';

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
const error = (status, message) => Object.assign(new Error(message), { status });

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

const numeric = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export async function syncAds({ token, accountId }, fetchImpl = fetch) {
  const [accountData, campaignsData, insightsData] = await Promise.all([
    metaGet(token, accountId, { fields: 'name,currency,account_status' }, fetchImpl),
    metaGet(token, `${accountId}/campaigns`, { fields: 'id,name,effective_status', limit: 100 }, fetchImpl),
    metaGet(token, `${accountId}/insights`, {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions',
      date_preset: 'maximum',
      limit: 100,
    }, fetchImpl),
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
  const campaigns = (campaignsData?.data || []).map(campaign => {
    const insight = insightById.get(String(campaign.id)) || {};
    return {
      id: String(campaign.id),
      name: campaign.name || '',
      status: campaign.effective_status || '',
      spend: insight.spend || 0,
      impressions: insight.impressions || 0,
      clicks: insight.clicks || 0,
      leads: insight.leads || 0,
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
