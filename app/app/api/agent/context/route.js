import { NextResponse } from 'next/server';
import { getAgentConversation } from '../../../../lib/agent-auth.js';
import { jsonError } from '../../../../lib/http.js';
import { createAdminClient } from '../../../../lib/supabase/admin.js';

export async function GET(request) {
  try {
    const conversation = await getAgentConversation(request);
    if (!conversation) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const [businessResult, docsResult] = await Promise.all([
      admin.from('businesses')
        .select('sprint,profile,inputs,calendar')
        .eq('id', conversation.business_id)
        .maybeSingle(),
      admin.from('business_docs')
        .select('doc_id,content')
        .eq('business_id', conversation.business_id),
    ]);
    if (businessResult.error) throw businessResult.error;
    if (docsResult.error) throw docsResult.error;
    if (!businessResult.data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const docs = Object.fromEntries((docsResult.data || []).map(doc => [`${doc.doc_id}.md`, doc.content]));
    return NextResponse.json({
      sprint: businessResult.data.sprint,
      profile: businessResult.data.profile,
      inputs: businessResult.data.inputs || {},
      docs,
      calendar: businessResult.data.calendar,
    });
  } catch (error) {
    return jsonError(error);
  }
}
