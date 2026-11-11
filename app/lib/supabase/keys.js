import 'server-only';
import { createAdminClient } from './admin.js';
import { decrypt } from '../crypto.js';

export async function getUserKey(userId, provider) {
  const { data, error } = await createAdminClient()
    .from('user_api_keys')
    .select('ciphertext')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw error;
  return data ? decrypt(data.ciphertext) : null;
}
