import { NextResponse } from 'next/server';
import { encrypt } from '../../../../lib/crypto.js';
import { guardWrite, jsonError, readJson } from '../../../../lib/http.js';
import { createAdminClient } from '../../../../lib/supabase/admin.js';
import { createClient } from '../../../../lib/supabase/server.js';

const providers = ['heygen', 'elevenlabs', 'devin', 'linkedin'];

async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return user;
}

export async function GET() {
  try {
    const user = await getUser();
    const { data, error } = await createAdminClient().from('user_api_keys')
      .select('provider,last4,updated_at').eq('user_id', user.id).order('provider');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  if (!providers.includes(body?.provider)) return NextResponse.json({ error: 'Unknown key provider' }, { status: 400 });
  if (typeof body.value !== 'string' || !body.value.trim() || body.value.trim().length > 4096) {
    return NextResponse.json({ error: 'Enter a valid API key' }, { status: 400 });
  }
  try {
    const user = await getUser();
    const value = body.value.trim();
    const { error } = await createAdminClient().from('user_api_keys').upsert({
      user_id: user.id,
      provider: body.provider,
      ciphertext: encrypt(value),
      last4: value.slice(-4),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const provider = new URL(request.url).searchParams.get('provider');
  if (!providers.includes(provider)) return NextResponse.json({ error: 'Unknown key provider' }, { status: 400 });
  try {
    const user = await getUser();
    const { error } = await createAdminClient().from('user_api_keys')
      .delete().eq('user_id', user.id).eq('provider', provider);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
