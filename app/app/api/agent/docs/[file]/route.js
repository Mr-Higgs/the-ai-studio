import { NextResponse } from 'next/server';
import { getAgentDocTarget } from '../../../../../lib/agent-docs.js';
import { saveDoc } from '../../../../../lib/business.js';
import { getAgentConversation } from '../../../../../lib/agent-auth.js';
import { jsonError } from '../../../../../lib/http.js';
import { createAdminClient } from '../../../../../lib/supabase/admin.js';

export async function PUT(request, { params }) {
  const { file } = await params;
  try {
    const conversation = await getAgentConversation(request);
    if (!conversation) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const target = getAgentDocTarget(file);
    if (!target) return NextResponse.json({ error: 'Document is not allowed' }, { status: 400 });
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    const expectedType = target.kind === 'profile' ? 'application/json' : 'text/markdown';
    if (contentType !== expectedType) {
      return NextResponse.json({ error: `Content-Type must be ${expectedType}` }, { status: 415 });
    }
    const admin = createAdminClient();

    if (target.kind === 'profile') {
      let profile;
      try {
        profile = await request.json();
      } catch {
        return NextResponse.json({ error: 'Profile must be valid JSON' }, { status: 400 });
      }
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        return NextResponse.json({ error: 'Profile must be a JSON object' }, { status: 400 });
      }
      const { data, error } = await admin.from('businesses')
        .update({ profile })
        .eq('id', conversation.business_id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const content = await request.text();
    await saveDoc(admin, conversation.business_id, target.id, content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
