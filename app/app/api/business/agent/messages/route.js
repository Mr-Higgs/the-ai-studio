import { NextResponse } from 'next/server';
import { ensureActiveBusiness } from '../../../../../lib/business.js';
import { getDevinClient } from '../../../../../lib/devin.js';
import { mapDevinMessages } from '../../../../../lib/devin-api.js';
import { jsonError } from '../../../../../lib/http.js';
import { createClient } from '../../../../../lib/supabase/server.js';

export async function GET(request) {
  const conversationId = new URL(request.url).searchParams.get('conversation');
  if (!conversationId) {
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
      .eq('id', conversationId)
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
    const [session, result] = await Promise.all([
      client.getSession(conversation.devin_session_id),
      client.listMessages(conversation.devin_session_id),
    ]);

    const status = session?.status || conversation.status;
    const url = session?.url || conversation.url;
    if (status !== conversation.status || url !== conversation.url) {
      const { error: updateError } = await supabase.from('devin_conversations')
        .update({ status, url, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
        .eq('business_id', business.id);
      if (updateError) throw updateError;
    }
    return NextResponse.json({
      status,
      url,
      messages: mapDevinMessages(result.items),
    });
  } catch (error) {
    return jsonError(error);
  }
}
