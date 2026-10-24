'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client.js';

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">STUDIO</p>
        <h1>Choose a new password</h1>
        <form onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input type="password" minLength={6} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <button className="btn primary auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
        {message && <p className="auth-message" role="alert">{message}</p>}
      </section>
    </main>
  );
}
