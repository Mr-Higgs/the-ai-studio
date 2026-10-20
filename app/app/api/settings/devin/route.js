import { NextResponse } from 'next/server';
import { guardWrite, jsonError, readJson } from '../../../../lib/http.js';
import { createClient } from '../../../../lib/supabase/server.js';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const { data, error } = await supabase.from('profiles')
      .select('devin_org_id,devin_max_acu')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      org_id: data?.devin_org_id || '',
      max_acu: data?.devin_max_acu || 5,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  const orgId = typeof body?.org_id === 'string' ? body.org_id.trim() : '';
  const maxAcu = body?.max_acu;
  if ((orgId && (!orgId.startsWith('org-') || orgId.length > 255)) ||
      !Number.isInteger(maxAcu) || maxAcu < 1 || maxAcu > 100) {
    return NextResponse.json({ error: 'Enter a valid Org ID and ACU limit (1–100)' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const { data, error } = await supabase.from('profiles')
      .update({ devin_org_id: orgId || null, devin_max_acu: maxAcu })
      .eq('id', user.id)
      .select('devin_org_id,devin_max_acu')
      .single();
    if (error) throw error;
    return NextResponse.json({
      org_id: data.devin_org_id || '',
      max_acu: data.devin_max_acu,
    });
  } catch (error) {
    return jsonError(error);
  }
}
