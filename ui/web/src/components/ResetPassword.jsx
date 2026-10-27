import { useState } from 'react';
import { supabase } from '../supabase.js';
import BuiltWithDevin from './BuiltWithDevin.jsx';
import FiberBackground from './FiberBackground.jsx';

// Shown when a password-recovery link signs the user in (PASSWORD_RECOVERY event).
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [state, setState] = useState(''); // '' | 'busy' | error text

  const submit = async e => {
    e.preventDefault();
    setState('busy');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) { setState(err.message); }
  };

  return (
    <main className="login">
      <FiberBackground />
      <form className="login-card" onSubmit={submit}>
        <img className="rll-logo" src="/ratelimitlabs.png" alt="RateLimitLabs" width="714" height="165" />
        <h2>Choose a new password</h2>
        <div className="field">
          <label htmlFor="reset-pass">New password</label>
          <input id="reset-pass" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {state && state !== 'busy' && <p className="msg err" role="alert">{state}</p>}
        <button className="btn primary" disabled={state === 'busy'}>{state === 'busy' ? 'One moment…' : 'Save password'}</button>
        <BuiltWithDevin />
      </form>
    </main>
  );
}
