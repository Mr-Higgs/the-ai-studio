'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client.js';
import { authCallbackUrl, safeNextPath } from '../../lib/auth.js';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [next] = useState(() => safeNextPath(typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('next')));
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async action => {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (result?.error) throw result.error;
      if (result?.data?.session) {
        router.push(next);
        router.refresh();
      } else if (result?.message) {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submit = event => {
    event.preventDefault();
    if (mode === 'reset') return;
    if (mode === 'signup') {
      return run(() => supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authCallbackUrl('/') },
      }).then(({ data, error }) => ({ data, error, message: 'Check your email to confirm your account.' })));
    }
    return run(() => supabase.auth.signInWithPassword({ email, password }));
  };

  const magicLink = () => run(() => supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl(next) },
  }).then(({ data, error }) => ({ data, error, message: 'Check your email for your sign-in link.' })));

  const google = () => run(() => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authCallbackUrl(next) },
  }));

  const forgot = event => {
    event.preventDefault();
    setMode('reset');
    run(() => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl('/auth/update-password'),
    }).then(({ data, error }) => ({ data, error, message: 'If an account exists for that email, a reset link is on its way.' })));
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">STUDIO</p>
        <h1>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Check your email' : 'Welcome back'}</h1>
        <p className="auth-copy">Your business growth workspace.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
          )}
          {mode !== 'reset' && <button className="btn primary auth-submit" disabled={busy}>{mode === 'signup' ? 'Sign up' : 'Sign in with email'}</button>}
        </form>
        {mode === 'signin' && <button className="btn auth-action" disabled={busy || !email} onClick={magicLink}>Email me a magic link</button>}
        {mode === 'reset' && <button className="btn auth-action" disabled={busy || !email} onClick={() => forgot({ preventDefault() {} })}>Send password reset link</button>}
        <button className="btn auth-action" disabled={busy} onClick={google}>Continue with Google</button>
        {mode === 'signin' && (
          <div className="auth-links">
            <button type="button" onClick={() => setMode('signup')}>Create an account</button>
            <button type="button" onClick={forgot}>Forgot password?</button>
          </div>
        )}
        {mode === 'signup' && <button className="auth-text-button" onClick={() => setMode('signin')}>Already have an account? Sign in</button>}
        {mode === 'reset' && <button className="auth-text-button" onClick={() => setMode('signin')}>Back to sign in</button>}
        {message && <p className="auth-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
