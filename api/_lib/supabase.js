import { createClient } from '@supabase/supabase-js';

const url = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let _admin;
export function admin() {
  return (_admin ||= createClient(url(), key(), { auth: { persistSession: false } }));
}
// Bearer access token (from supabase-js on the client) -> { id, email } or null.
export async function userFromReq(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const { data, error } = await admin().auth.getUser(m[1]);
  return error || !data.user ? null : { id: data.user.id, email: data.user.email };
}
