import 'server-only';
import { createDevinApi } from './devin-api.js';
import { getUserKey } from './supabase/keys.js';

export async function getDevinClient(userId, orgId) {
  const apiKey = await getUserKey(userId, 'devin');
  if (!apiKey || !orgId) {
    throw Object.assign(new Error('Add your Devin token and Org ID in Settings'), { status: 400 });
  }
  return createDevinApi({ apiKey, orgId });
}
