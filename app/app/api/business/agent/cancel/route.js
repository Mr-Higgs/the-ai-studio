import { NextResponse } from 'next/server';
import { ensureActiveBusiness } from '../../../../../lib/business.js';
import { refreshTokenExpiry } from '../../../../../lib/devin-tokens.js';
import { getDevinClient } from '../../../../../lib/devin.js';
import { publicConversation } from '../../../../../lib/devin-api.js';
import { guardWrite, jsonError, readJson } from '../../../../../lib/http.js';
import { createClient } from '../../../../../lib/supabase/server.js';

export async function POST(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  if (typeof body?.conversation !== 'string' || !body.conversation) {
    return NextResponse.json({ error: 'Conversation is required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

    const { data: conversation, error } = await supabase.from('devin_conversations')
      .select('id,business_id,devin_session_id,url,title,status,created_at,updated_at')
      .eq('id', body.conversation)
      .eq('business_id', business.id)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { status: 404 });

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('devin_org_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const client = await getDevinClient(user.id, profile?.devin_org_id);
    await client.sendMessage(conversation.devin_session_id, "Stop working now. Don't make further changes.");
    const { data: updated, error: updateError } = await supabase.from('devin_conversations')
      .update({ token_expires_at: refreshTokenExpiry(), updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('business_id', business.id)
      .select('id,title,status,url,created_at,updated_at')
      .single();
    if (updateError) throw updateError;
    return NextResponse.json({ conversation: publicConversation(updated) });
  } catch (error) {
    return jsonError(error);
  }
}
