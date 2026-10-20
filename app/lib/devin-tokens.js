import { createHash, randomBytes } from 'node:crypto';

export const STUDIO_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashStudioToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createStudioToken(now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    token_hash: hashStudioToken(token),
    token_expires_at: new Date(now + STUDIO_TOKEN_TTL_MS).toISOString(),
  };
}

export function refreshTokenExpiry(now = Date.now()) {
  return new Date(now + STUDIO_TOKEN_TTL_MS).toISOString();
}

export async function authenticateStudioToken(authorization, findByHash, now = Date.now()) {
  const match = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(authorization || '');
  if (!match) return { status: 401, conversation: null };
  const conversation = await findByHash(hashStudioToken(match[1]));
  if (!conversation) return { status: 401, conversation: null };
  const expiresAt = Date.parse(conversation.token_expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return { status: 401, conversation: null };
  return { status: 200, conversation };
}
