import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server.js';
import { guardWrite } from '../../../../lib/http.js';

export async function POST(request) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
