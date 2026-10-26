import { useState } from 'react';
import { supabase } from '../supabase.js';
import { SPRINTS } from '../steps.js';
import BuiltWithDevin from './BuiltWithDevin.jsx';

// Hosted gate: one card, "Sign in" or "Create account".
export default function Login({ onDone }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState(''); // '' | 'busy' | error text

  const submit = async e => {
    e.preventDefault();
    setState('busy');
    try {
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        // Supabase returns no session when email confirmation is on; the user signs in after clicking the link.
        if (!data.session) { setState('Check your email for a confirmation link, then sign in.'); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
      }
      onDone();
    } catch (err) { setState(err.message); }
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <a className="back-link" href="#">← Back</a>
        <div className="brand"><span className="brand-name">{SPRINTS.holiday.name}</span></div>
        <div className="tabs" role="tablist">
          {[['in', 'Sign in'], ['up', 'Create account']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'active' : ''}
              onClick={() => { setMode(id); setState(''); }}>{label}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-pass">Password</label>
          <input id="login-pass" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {state && state !== 'busy' && <p className={state.startsWith('Check your email') ? 'msg' : 'msg err'} role="alert">{state}</p>}
        <button className="btn primary" disabled={state === 'busy'}>{state === 'busy' ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <BuiltWithDevin />
      </form>
    </main>
  );
}
