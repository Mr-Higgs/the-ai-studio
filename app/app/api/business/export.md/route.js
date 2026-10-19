import { NextResponse } from 'next/server';
import { ensureActiveBusiness, exportMarkdown, readBusinessState } from '../../../../lib/business.js';
import { createClient } from '../../../../lib/supabase/server.js';
import { jsonError } from '../../../../lib/http.js';

export async function GET() {
  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    const state = await readBusinessState(supabase, business);
    const filename = `${state.sprint?.id === 'growth' ? 'growth-hack' : 'holiday-growth'}-sprint.md`;
    return new Response(exportMarkdown(state), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
