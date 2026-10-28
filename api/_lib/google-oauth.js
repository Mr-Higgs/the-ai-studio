// Google OAuth 2.0 web-server flow for Google Business Profile. Studio-owned client
// (env vars, no dynamic registration, no PKCE) with offline access so the listing can
// be re-read later. Tokens only ever live encrypted in user_settings.google_oauth.
import { publicOrigin, randomState } from './heygen-oauth.js';
export { randomState };

export const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
export const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
export const configured = () => !!(CLIENT_ID && CLIENT_SECRET);

export const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const SCOPE = 'openid email https://www.googleapis.com/auth/business.manage';

export const redirectUri = req => `${publicOrigin(req)}/api/google/oauth/callback`;

export function buildAuthorizeUrl({ redirectUri: redirect_uri, state }) {
  const u = new URL(AUTHORIZE_URL);
  u.search = new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID, redirect_uri, scope: SCOPE, state,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
  });
  return u.toString();
}

const tokenPost = async fields => {
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...fields }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error_description || body.error || `Google token request failed (${r.status})`);
  return body;
};
export const exchangeCode = ({ code, redirectUri: redirect_uri }) =>
  tokenPost({ grant_type: 'authorization_code', code, redirect_uri });
export const refreshTokens = ({ refreshToken }) =>
  tokenPost({ grant_type: 'refresh_token', refresh_token: refreshToken });

// Shape stored (encrypted) in user_settings.google_oauth.
export const toStored = (t, prev = {}) => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token || prev.refresh_token,
  expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
  scope: t.scope || prev.scope,
  account: prev.account,
  locations: prev.locations,
  location: prev.location,
});

export const revoke = async token => {
  try {
    await fetch(REVOKE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch { /* best effort */ }
};

// GBP APIs need Google's per-project approval; until then every call returns quota /
// accessNotConfigured / PERMISSION_DENIED errors. Those become code 'pending_approval'
// so the UI can say "still waiting" instead of "broken".
const gbpGet = async (base, path, token) => {
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = JSON.stringify(body?.error || body);
    if (r.status === 429 || (r.status === 403 && /quota|accessNotConfigured|PERMISSION_DENIED/i.test(reason)))
      throw Object.assign(new Error('Google hasn’t approved Studio’s Business Profile access yet.'), { status: 403, code: 'pending_approval' });
    throw Object.assign(new Error(`Google Business Profile error ${r.status}: ${body.error?.message || r.statusText}`), { status: r.status === 401 ? 401 : 502 });
  }
  return body;
};

export const listAccounts = token =>
  gbpGet('https://mybusinessaccountmanagement.googleapis.com/v1', '/accounts', token)
    .then(b => b.accounts || []);

export const listLocations = (token, accountName) =>
  gbpGet('https://mybusinessbusinessinformation.googleapis.com/v1',
    `/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata,serviceArea,profile&pageSize=100`, token)
    .then(b => b.locations || []);

// The plain object stored in google_oauth.locations and inlined into Devin context.
export function locationSummary(loc) {
  const a = loc?.storefrontAddress;
  return {
    name: loc?.name || null,
    title: loc?.title || null,
    address: a ? [Array.isArray(a.addressLines) ? a.addressLines.join(' ') : '', a.locality, a.administrativeArea, a.postalCode].filter(Boolean).join(', ') || null : null,
    phone: loc?.phoneNumbers?.primaryPhone || null,
    website: loc?.websiteUri || null,
    hours: loc?.regularHours?.periods || [],
    primaryCategory: loc?.categories?.primaryCategory?.displayName || null,
    additionalCategories: (loc?.categories?.additionalCategories || []).map(c => c.displayName),
    description: loc?.profile?.description || null,
    serviceArea: loc?.serviceArea?.places?.placeInfos?.map(p => p.placeName) || [],
    mapsUri: loc?.metadata?.mapsUri || null,
    newReviewUri: loc?.metadata?.newReviewUri || null,
  };
}

export const userInfo = token =>
  fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => (r.ok ? r.json() : {}))
    .then(b => ({ email: b.email || null }))
    .catch(() => ({ email: null }));
