import 'server-only';
import { authenticateStudioToken } from './devin-tokens.js';
import { createAdminClient } from './supabase/admin.js';

export async function getAgentConversation(request) {
  const admin = createAdminClient();
  const result = await authenticateStudioToken(request.headers.get('authorization'), async tokenHash => {
    const { data, error } = await admin.from('devin_conversations')
      .select('id,owner_id,business_id,devin_session_id,url,title,status,token_expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
  return result.conversation;
}
