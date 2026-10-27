import { useState } from 'react';
import { supabase } from '../supabase.js';
import BuiltWithDevin from './BuiltWithDevin.jsx';
import FiberBackground from './FiberBackground.jsx';

// Hosted gate: one card, "Sign in" or "Create account".
// Supabase Auth 429s: the built-in mailer allows only a few confirmation emails per hour, and
// sign-up/sign-in requests are limited per IP (a whole workshop room shares one).
const authMessage = (error, mode) => {
  if (error.code === 'over_email_send_rate_limit')
    return mode === 'reset'
      ? 'Too many reset emails went out in the last hour. Try again later.'
      : 'Too many sign-up emails went out in the last hour. Try again later, or sign in if you already have an account.';
  if (error.code === 'over_request_rate_limit' || error.status === 429)
    return `Too many ${mode === 'up' ? 'sign-ups' : mode === 'reset' ? 'reset requests' : 'sign-in attempts'} from this network right now. Wait a minute and try again.`;
  if (error.code === 'user_already_exists') return 'That email already has an account. Sign in instead.';
  if (error.message === 'Invalid login credentials') return 'Wrong email or password.';
  return error.message;
};

export default function Login({ onDone }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState(''); // '' | 'busy' | error text

  const submit = async e => {
    e.preventDefault();
    setState('busy');
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw new Error(authMessage(error, mode));
        setState('Check your email for a password reset link.');
        return;
      }
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(authMessage(error, mode));
        // Supabase returns no session when email confirmation is on; the user signs in after clicking the link.
        if (!data.session) { setState('Check your email for a confirmation link, then sign in.'); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(authMessage(error, mode));
      }
      onDone();
    } catch (err) { setState(err.message); }
  };

  return (
    <main className="login">
      <FiberBackground />
      <form className="login-card" onSubmit={submit}>
        <a className="back-link" href="#">← Back</a>
        <img className="rll-logo" src="/ratelimitlabs.png" alt="RateLimitLabs" width="714" height="165" />
        <div className="tabs" role="tablist">
          {[['in', 'Sign in'], ['up', 'Create account']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'active' : ''}
              onClick={() => { setMode(id); setState(''); }}>{label}</button>
          ))}
        </div>
        {mode === 'reset' && <p className="hint">Enter your email and we'll send a link to set a new password.</p>}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {mode !== 'reset' && <div className="field">
          <label htmlFor="login-pass">Password</label>
          <input id="login-pass" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </div>}
        {mode === 'in' && <button type="button" className="link forgot" onClick={() => { setMode('reset'); setState(''); }}>Forgot password?</button>}
        {state && state !== 'busy' && <p className={state.startsWith('Check your email') ? 'msg' : 'msg err'} role="alert">{state}</p>}
        <button className="btn primary" disabled={state === 'busy'}>{state === 'busy' ? 'One moment…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        {mode === 'reset' && <button type="button" className="link" onClick={() => { setMode('in'); setState(''); }}>Back to sign in</button>}
        <a className="back-link guide-link" href="/guide">First time? Read how it works</a>
        <BuiltWithDevin />
      </form>
    </main>
  );
}
