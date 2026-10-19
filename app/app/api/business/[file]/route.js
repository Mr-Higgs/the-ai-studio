import { NextResponse } from 'next/server';
import { BUSINESS_JSON, cleanCalendar, ensureActiveBusiness } from '../../../../lib/business.js';
import { guardWrite, jsonError, readJson } from '../../../../lib/http.js';
import { createClient } from '../../../../lib/supabase/server.js';

const columns = Object.fromEntries(BUSINESS_JSON.map(file => [file, file.replace('.json', '')]));

export async function PUT(request, { params }) {
  const blocked = guardWrite(request);
  if (blocked) return blocked;
  const { file } = await params;
  if (!Object.hasOwn(columns, file)) return NextResponse.json({ error: 'Unknown business file' }, { status: 404 });
  const value = await readJson(request);
  if (value === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  try {
    const supabase = await createClient();
    const business = await ensureActiveBusiness(supabase);
    const column = columns[file];
    const updated = column === 'calendar' ? cleanCalendar(value).items : value;
    const { error } = await supabase.from('businesses').update({ [column]: updated }).eq('id', business.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, ...(column === 'calendar' ? { calendarIssues: cleanCalendar(value).issues } : {}) });
  } catch (error) {
    return jsonError(error);
  }
}
