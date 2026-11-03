import { createClient } from '@supabase/supabase-js';

const url = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let _admin;
export function admin() {
  return (_admin ||= createClient(url(), key(), { auth: { persistSession: false } }));
}
// Bearer access token (from supabase-js on the client) -> { id, email } or null.
// 401 only when the token is rejected; a Supabase Auth outage is a 503 so the UI doesn't treat it as signed out.
export async function userFromReq(req, auth = admin().auth) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const { data, error } = await auth.getUser(m[1]);
  if (error) {
    if (error.status >= 400 && error.status < 500) return null;
    console.error(JSON.stringify({ t: 'auth_unavailable', status: error.status ?? null, message: error.message }));
    throw Object.assign(new Error('Sign-in service unavailable. Try again in a moment.'), { status: 503 });
  }
  return data.user ? { id: data.user.id, email: data.user.email } : null;
}
