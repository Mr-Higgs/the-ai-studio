// HeyGen OAuth (authorization_code + PKCE, dynamic client registration). Bearer tokens call
// api.heygen.com and bill the user's *plan* credits, unlike X-Api-Key which bills API credits.
import crypto from 'node:crypto';

export const AUTHORIZE_URL = process.env.HEYGEN_OAUTH_AUTHORIZE_URL || 'https://app.heygen.com/oauth/authorize';
export const TOKEN_URL = process.env.HEYGEN_OAUTH_TOKEN_URL || 'https://api2.heygen.com/v1/oauth/token';
export const REGISTER_URL = process.env.HEYGEN_OAUTH_REGISTER_URL || 'https://api2.heygen.com/v1/oauth/register';
export const REVOKE_URL = process.env.HEYGEN_OAUTH_REVOKE_URL || 'https://api2.heygen.com/v1/oauth/revoke';
export const RESOURCE = process.env.HEYGEN_OAUTH_RESOURCE || 'https://api.heygen.com';
export const SCOPE = 'openid';

export const pkce = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
};
export const randomState = () => crypto.randomBytes(32).toString('base64url');

// The public origin this request was served from (same trick as the lead-form URL).
export function publicOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (String(host || '').startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
export const redirectUri = req => `${publicOrigin(req)}/api/heygen/oauth/callback`;

// One registered client per redirect URI; HEYGEN_OAUTH_CLIENT_ID skips registration entirely.
export async function registerClient(redirect_uri) {
  if (process.env.HEYGEN_OAUTH_CLIENT_ID) return process.env.HEYGEN_OAUTH_CLIENT_ID;
  const r = await fetch(REGISTER_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Studio', redirect_uris: [redirect_uri],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.client_id) throw new Error(body.error_description || body.error || `HeyGen client registration failed (${r.status})`);
  return body.client_id;
}

export function buildAuthorizeUrl({ clientId, redirectUri: redirect_uri, state, challenge }) {
  const u = new URL(AUTHORIZE_URL);
  u.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri, scope: SCOPE, state,
    code_challenge: challenge, code_challenge_method: 'S256', resource: RESOURCE,
  });
  return u.toString();
}

const tokenPost = async fields => {
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error_description || body.error || `HeyGen token request failed (${r.status})`);
  return body;
};
export const exchangeCode = ({ clientId, code, verifier, redirectUri: redirect_uri }) =>
  tokenPost({ grant_type: 'authorization_code', code, redirect_uri, client_id: clientId, code_verifier: verifier, resource: RESOURCE });
export const refreshTokens = ({ clientId, refreshToken }) =>
  tokenPost({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, resource: RESOURCE });

// Shape stored (encrypted) in user_settings.heygen_oauth.
export const toStored = (t, client_id, prev = {}) => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token || prev.refresh_token,
  expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
  client_id,
  scope: t.scope || prev.scope,
});

export const revoke = async ({ clientId, token }) => {
  try {
    await fetch(REVOKE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: clientId }),
    });
  } catch { /* best effort */ }
};
