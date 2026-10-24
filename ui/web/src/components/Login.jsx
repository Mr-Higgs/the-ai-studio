import { useState } from 'react';
import { post } from '../api.js';
import { SPRINTS } from '../steps.js';

// Hosted mode gate: one card, "Sign in" or "Create account" (invite code required there).
export default function Login({ onDone }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [state, setState] = useState(''); // '' | 'busy' | error text

  const submit = async e => {
    e.preventDefault();
    setState('busy');
    try {
      await post(mode === 'in' ? '/api/auth/login' : '/api/auth/register', { email, password, ...(mode === 'up' && { invite }) });
      onDone();
    } catch (err) { setState(err.message); }
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
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
        {mode === 'up' && (
          <div className="field">
            <label htmlFor="login-invite">Invite code</label>
            <input id="login-invite" required value={invite} onChange={e => setInvite(e.target.value)} />
          </div>
        )}
        {state && state !== 'busy' && <p className="msg err" role="alert">{state}</p>}
        <button className="btn primary" disabled={state === 'busy'}>{state === 'busy' ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
    </main>
  );
}
