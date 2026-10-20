import { NextResponse } from 'next/server';
import { ensureActiveBusiness } from '../../../../lib/business.js';
import { publicConversation } from '../../../../lib/devin-api.js';
import { jsonError } from '../../../../lib/http.js';
import { createClient } from '../../../../lib/supabase/server.js';

export async function GET() {
  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    const { data, error } = await supabase.from('devin_conversations')
      .select('id,title,status,url,created_at,updated_at')
      .eq('business_id', business.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ conversations: (data || []).map(publicConversation) });
  } catch (error) {
    return jsonError(error);
  }
}
