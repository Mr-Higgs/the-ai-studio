'use client';

import { useEffect, useState } from 'react';
import { api, signOut, put } from '../api.js';
import { createClient } from '../../../lib/supabase/client.js';

const providers = [
  { id: 'heygen', name: 'HeyGen', help: 'https://app.heygen.com/settings?nav=API' },
  { id: 'elevenlabs', name: 'ElevenLabs', help: 'https://elevenlabs.io/app/settings/api-keys' },
  { id: 'devin', name: 'Devin', help: 'https://app.devin.ai/settings/api-keys' },
  { id: 'linkedin', name: 'LinkedIn', help: 'https://www.linkedin.com/developers/apps' },
];

export default function Settings() {
  const [email, setEmail] = useState('');
  const [keys, setKeys] = useState({});
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({});
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const saved = await api('/api/settings/keys');
      setKeys(Object.fromEntries(saved.map(item => [item.provider, item])));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    refresh();
  }, []);

  const save = async (event, provider) => {
    event.preventDefault();
    setStatus(current => ({ ...current, [provider]: 'Saving…' }));
    setError('');
    try {
      await put('/api/settings/keys', { provider, value: values[provider] || '' });
      setValues(current => ({ ...current, [provider]: '' }));
      setStatus(current => ({ ...current, [provider]: 'Saved' }));
      await refresh();
    } catch (err) {
      setError(err.message);
      setStatus(current => ({ ...current, [provider]: '' }));
    }
  };

  const remove = async provider => {
    setError('');
    try {
      await api(`/api/settings/keys?provider=${provider}`, { method: 'DELETE' });
      setKeys(current => {
        const next = { ...current };
        delete next[provider];
        return next;
      });
      setStatus(current => ({ ...current, [provider]: 'Removed' }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <header className="step-head">
        <h1>Settings</h1>
        <p>Manage your connected service keys and account.</p>
      </header>
      <section className="settings-account">
        <div>
          <h2>Signed in</h2>
          <p>{email || 'Loading account…'}</p>
        </div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </section>
      <section className="settings-keys">
        <h2>API keys</h2>
        <p className="hint">Keys are encrypted before they are stored and are never shown again.</p>
        {error && <p className="msg err" role="alert">{error}</p>}
        {providers.map(provider => {
          const saved = keys[provider.id];
          return (
            <article key={provider.id} className="settings-key">
              <div className="settings-key-heading">
                <h3>{provider.name}</h3>
                <a href={provider.help} target="_blank" rel="noreferrer">Get a key ↗</a>
              </div>
              {saved ? (
                <div className="settings-key-saved">
                  <span className="hint ok">Saved ••••{saved.last4}</span>
                  <button className="btn ghost" onClick={() => remove(provider.id)}>Remove</button>
                </div>
              ) : (
                <form className="key-form" onSubmit={event => save(event, provider.id)}>
                  <label className="sr" htmlFor={`key-${provider.id}`}>{provider.name} API key</label>
                  <input
                    id={`key-${provider.id}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={values[provider.id] || ''}
                    onChange={event => setValues(current => ({ ...current, [provider.id]: event.target.value }))}
                    placeholder={`Paste your ${provider.name} key`}
                  />
                  <button className="btn primary" disabled={!values[provider.id]?.trim() || status[provider.id] === 'Saving…'}>
                    {status[provider.id] === 'Saving…' ? 'Saving…' : 'Save'}
                  </button>
                  {status[provider.id] && status[provider.id] !== 'Saving…' && <span className="hint">{status[provider.id]}</span>}
                </form>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
