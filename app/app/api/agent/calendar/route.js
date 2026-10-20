import { NextResponse } from 'next/server';
import { cleanCalendar } from '../../../../lib/business.js';
import { getAgentConversation } from '../../../../lib/agent-auth.js';
import { jsonError } from '../../../../lib/http.js';
import { createAdminClient } from '../../../../lib/supabase/admin.js';

export async function PUT(request) {
  try {
    const conversation = await getAgentConversation(request);
    if (!conversation) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }
    let items;
    try {
      items = await request.json();
    } catch {
      return NextResponse.json({ error: 'Calendar must be valid JSON' }, { status: 400 });
    }
    if (!Array.isArray(items)) return NextResponse.json({ error: 'Calendar must be a JSON array' }, { status: 400 });

    const cleaned = cleanCalendar(items);
    const { data, error } = await createAdminClient().from('businesses')
      .update({ calendar: cleaned.items })
      .eq('id', conversation.business_id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json({ ok: true, calendarIssues: cleaned.issues });
  } catch (error) {
    return jsonError(error);
  }
}
