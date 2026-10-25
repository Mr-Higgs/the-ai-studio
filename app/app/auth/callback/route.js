import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server.js';
import { safeNextPath } from '../../../lib/auth.js';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL('/login?error=auth', request.url));
}
