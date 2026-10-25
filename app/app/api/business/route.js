import { NextResponse } from 'next/server';
import { ensureActiveBusiness, readBusinessState } from '../../../lib/business.js';
import { createClient } from '../../../lib/supabase/server.js';
import { jsonError } from '../../../lib/http.js';

export async function GET() {
  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    return NextResponse.json(await readBusinessState(supabase, business));
  } catch (error) {
    return jsonError(error);
  }
}
