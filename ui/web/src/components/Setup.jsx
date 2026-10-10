import { useState } from 'react';
import { SETUP_ACCOUNT } from '../steps.js';
import { post } from '../api.js';
import { CopyButton } from './GenerateStep.jsx';

const GROUPS = [
  ['required', 'Needed for everything'],
  ['video', 'Only for promo videos'],
  ['optional', 'Optional extras'],
];

// API keys are pasted here and saved into .env by the server; they never come back to the page.
function KeyInput({ item, recheck }) {
  const [open, setOpen] = useState(!item.ok);
  const [value, setValue] = useState('');
  const [state, setState] = useState('');
  const save = async e => {
    e.preventDefault();
    setState('saving');
    try { await post('/api/setup/env', { name: item.key, value: value.trim() }); setValue(''); setState(''); setOpen(false); await recheck(); }
    catch (err) { setState(err.message); }
  };
  if (!open) return <><span className="hint">Ready</span><button className="btn ghost" onClick={() => setOpen(true)}>Replace key</button></>;
  return (
    <form className="key-form" onSubmit={save}>
      <label htmlFor={`key-${item.id}`} className="sr">{item.name}</label>
      <input id={`key-${item.id}`} type="password" autoComplete="off" spellCheck={false} value={value} onChange={e => setValue(e.target.value)} placeholder="Paste your key" />
      <button className="btn primary" disabled={!value.trim() || state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save'}</button>
      {item.link && <a className="btn ghost" href={item.link} target="_blank" rel="noreferrer">Get a key</a>}
      {item.ok && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>}
      {state && state !== 'saving' && <p className="msg err" role="alert">{state}</p>}
    </form>
  );
}

export default function Setup({ health, recheck }) {
  const [checking, setChecking] = useState(false);
  const missing = g => health?.filter(h => h.group === g && !h.ok) || [];
  const req = missing('required'), vid = missing('video');
  const win = navigator.userAgent.includes('Windows');

  const summary = !health ? 'Checking your computer…'
    : req.length ? `${req.length} thing${req.length > 1 ? 's' : ''} to do before you can start. Run each command below, then click Check again.`
    : vid.length ? 'You’re ready for every step except promo videos. Set those up whenever you get to them.'
    : 'Everything’s ready.';

  return (
    <>
      <header className="step-head">
        <h1>Setup</h1>
        <p>{summary}</p>
      </header>

      <section className="setup-account">
        <h2>Your Devin account</h2>
        <p>{SETUP_ACCOUNT.text}</p>
        {SETUP_ACCOUNT.link && <a className="btn" href={SETUP_ACCOUNT.link} target="_blank" rel="noreferrer">{SETUP_ACCOUNT.linkLabel}</a>}
      </section>

      <p className="hint setup-how">
        Run commands in {win ? <><strong>PowerShell</strong> (not Command Prompt)</> : <><strong>Terminal</strong></>}, from this project’s folder.
        After installing something, <strong>open a new {win ? 'PowerShell' : 'Terminal'} window</strong> and restart <code>npm run studio</code> so it’s found.
      </p>

      {GROUPS.map(([g, title]) => (
        <section key={g} className="setup-group">
          <h2>{title}</h2>
          <ul className="health">
            {health?.filter(h => h.group === g).map(h => (
              <li key={h.id} className={h.ok ? 'ok' : 'bad'}>
                <span className={'dot ' + (h.ok ? 'ok' : g === 'required' ? 'bad' : 'warn')} />
                <span className="health-name">{h.name}<small>{h.why}</small></span>
                {h.key ? <KeyInput item={h} recheck={recheck} />
                  : h.ok ? <span className="hint">Ready</span> : <><code>{h.fix}</code><CopyButton text={h.fix} /></>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="actions">
        <button className="btn" disabled={checking} onClick={() => { setChecking(true); recheck().finally(() => setChecking(false)); }}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        {health && !req.length && <a className="btn primary" href="#profile">Start with your profile</a>}
      </div>
    </>
  );
}
