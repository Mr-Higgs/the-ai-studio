import { NextResponse } from 'next/server';
import { ensureActiveBusiness } from '../../../../lib/business.js';
import { createStudioToken, hashStudioToken, refreshTokenExpiry } from '../../../../lib/devin-tokens.js';
import { getDevinClient } from '../../../../lib/devin.js';
import { buildDevinPrompt } from '../../../../lib/devin-prompts.js';
import { maxAcuLimit, publicConversation } from '../../../../lib/devin-api.js';
import { guardWrite, jsonError, readJson } from '../../../../lib/http.js';
import { createClient } from '../../../../lib/supabase/server.js';

const SETTINGS_MESSAGE = 'Add your Devin token and Org ID in Settings';

async function getUser(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return user;
}

async function getDevinProfile(supabase, userId) {
  const { data, error } = await supabase.from('profiles')
    .select('devin_org_id,devin_max_acu')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.devin_org_id) throw Object.assign(new Error(SETTINGS_MESSAGE), { status: 400 });
  return data;
}

function titleFrom(value) {
  return String(value || '').split(/\r?\n/, 1)[0].trim().slice(0, 120) || 'New conversation';
}

export async function POST(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'Enter a message' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const business = await ensureActiveBusiness(supabase);
    const profile = await getDevinProfile(supabase, user.id);
    const client = await getDevinClient(user.id, profile.devin_org_id);

    if (!body.new && body.conversation) {
      const { data: conversation, error } = await supabase.from('devin_conversations')
        .select('id,business_id,devin_session_id,url,title,status,created_at,updated_at')
        .eq('id', body.conversation)
        .eq('business_id', business.id)
        .maybeSingle();
      if (error) throw error;
      if (!conversation) throw Object.assign(new Error('Conversation not found'), { status: 404 });

      await client.sendMessage(conversation.devin_session_id, body.text.trim());
      const { data: updated, error: updateError } = await supabase.from('devin_conversations')
        .update({ token_expires_at: refreshTokenExpiry(), updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
        .eq('business_id', business.id)
        .select('id,title,status,url,created_at,updated_at')
        .single();
      if (updateError) throw updateError;
      return NextResponse.json({ conversation: publicConversation(updated) });
    }

    const studioToken = createStudioToken();
    const title = titleFrom(body.title || body.text);
    const session = await client.createSession({
      prompt: buildDevinPrompt(body.text.trim()),
      maxAcu: maxAcuLimit(profile),
      sessionToken: studioToken.token,
      title,
    });
    if (!session?.session_id) {
      throw Object.assign(new Error('Devin did not return a session ID'), { status: 502 });
    }

    const { data: conversation, error } = await supabase.from('devin_conversations')
      .insert({
        business_id: business.id,
        devin_session_id: session.session_id,
        url: session.url || null,
        title,
        status: session.status || 'new',
        token_hash: studioToken.token_hash,
        token_expires_at: studioToken.token_expires_at,
      })
      .select('id,title,status,url,created_at,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ conversation: publicConversation(conversation) });
  } catch (error) {
    return jsonError(error);
  }
}
