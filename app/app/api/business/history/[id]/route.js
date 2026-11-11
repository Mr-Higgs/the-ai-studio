import { NextResponse } from 'next/server';
import { ensureActiveBusiness } from '../../../../../lib/business.js';
import { createClient } from '../../../../../lib/supabase/server.js';
import { jsonError } from '../../../../../lib/http.js';

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    const { data, error } = await supabase.from('business_history').select('content,ext')
      .eq('business_id', business.id).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new Response(data.content, {
      headers: { 'Content-Type': data.ext === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
