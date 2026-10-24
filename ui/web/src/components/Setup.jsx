import { useState } from 'react';
import { SETUP_ACCOUNT, SETUP_ACCOUNT_HOSTED, SETUP_INTEGRATIONS } from '../steps.js';
import { post } from '../api.js';
import { CopyButton } from './GenerateStep.jsx';

const GROUPS = [
  ['required', 'Needed for everything'],
  ['video', 'Only for promo videos'],
  ['optional', 'Optional extras'],
];
const HOSTED_GROUPS = [
  ['required', 'Needed for everything'],
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

// Hosted mode: the server relays `devin auth login --force-manual-token-flow` through a pty.
// We show the sign-in URL it prints, the user pastes back the code the page gives them.
function DevinSignIn({ item, recheck }) {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState(''); // '' | 'starting' | 'finishing' | error text

  const start = async () => {
    setState('starting'); setUrl(''); setCode('');
    try { const r = await post('/api/setup/devin/login'); setUrl(r.url); setState(''); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { setState(e.message); }
  };
  const finish = async e => {
    e.preventDefault();
    setState('finishing');
    try { await post('/api/setup/devin/code', { code: code.trim() }); setUrl(''); setCode(''); setState(''); await recheck(); }
    catch (err) { setState(err.message); }
  };
  const logout = async () => { try { await post('/api/setup/devin/logout'); } catch {} await recheck(); };

  if (item.ok) return <><span className="hint">Signed in</span><button className="btn ghost" onClick={logout}>Sign out</button></>;
  return (
    <div className="devin-signin">
      {!url && <button className="btn primary" onClick={start} disabled={state === 'starting'}>{state === 'starting' ? 'Getting your link…' : 'Sign in to Devin'}</button>}
      {url && (
        <form className="key-form" onSubmit={finish}>
          <p className="hint">Opened <a href={url} target="_blank" rel="noreferrer">the Devin sign-in page</a> — log in there, copy the code it shows, paste it here.</p>
          <label htmlFor="devin-code" className="sr">Sign-in code</label>
          <input id="devin-code" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} placeholder="Paste the code" />
          <button className="btn primary" disabled={!code.trim() || state === 'finishing'}>{state === 'finishing' ? 'Checking…' : 'Finish sign-in'}</button>
          <button type="button" className="btn ghost" onClick={start}>Start again</button>
        </form>
      )}
      {state && !['starting', 'finishing'].includes(state) && <p className="msg err" role="alert">{state}</p>}
      <details className="hint">
        <summary>Advanced: paste an API key instead</summary>
        <KeyInput item={{ ...item, key: 'DEVIN_API_KEY', id: 'devin-key', link: null }} recheck={recheck} />
      </details>
    </div>
  );
}

export default function Setup({ health, integrations, agentName, hosted, recheck }) {
  const [checking, setChecking] = useState(false);
  const missing = g => health?.filter(h => h.group === g && !h.ok) || [];
  const req = missing('required'), vid = missing('video');
  const win = navigator.userAgent.includes('Windows');
  const groups = hosted ? HOSTED_GROUPS : GROUPS;
  const account = hosted ? SETUP_ACCOUNT_HOSTED : SETUP_ACCOUNT;

  const summary = !health ? (hosted ? 'Checking your account…' : 'Checking your computer…')
    : req.length ? (hosted ? 'Sign in to Devin to start.' : `${req.length} thing${req.length > 1 ? 's' : ''} to do before you can start. Run each command below, then click Check again.`)
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
        <p>{account.text}</p>
        {account.link && <a className="btn" href={account.link} target="_blank" rel="noreferrer">{account.linkLabel}</a>}
      </section>

      {!hosted && (
        <p className="hint setup-how">
          Run commands in {win ? <><strong>PowerShell</strong> (not Command Prompt)</> : <><strong>Terminal</strong></>}, from this project’s folder.
          After installing something, <strong>open a new {win ? 'PowerShell' : 'Terminal'} window</strong> and restart <code>npm run studio</code> so it’s found.
        </p>
      )}

      {groups.map(([g, title]) => (
        <section key={g} className="setup-group">
          <h2>{title}</h2>
          <ul className="health">
            {health?.filter(h => h.group === g).map(h => (
              <li key={h.id} className={h.ok ? 'ok' : 'bad'}>
                <span className={'dot ' + (h.ok ? 'ok' : g === 'required' ? 'bad' : 'warn')} />
                <span className="health-name">{h.name}<small>{h.why}</small></span>
                {h.id === 'devin-auth' && hosted ? <DevinSignIn item={h} recheck={recheck} />
                  : h.key ? <KeyInput item={h} recheck={recheck} />
                  : h.ok ? <span className="hint">Ready</span> : <><code>{h.fix}</code><CopyButton text={h.fix} /></>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!hosted && (
        <section className="setup-group">
          <h2>What {agentName} can connect to</h2>
          <p className="hint setup-how">{SETUP_INTEGRATIONS.intro}</p>

          <h3 className="integ-h">Connected tools (MCP servers)</h3>
          {integrations?.mcpError === 'devin-missing' ? (
            <p className="hint">Install the Devin CLI (above) to see these.</p>
          ) : integrations?.mcp?.length ? (
            <ul className="health">
              {integrations.mcp.map(m => (
                <li key={m.name}>
                  <span className={'dot ' + (m.disabled ? 'warn' : 'ok')} />
                  <span className="health-name">{m.name}{m.target && <small>{m.target}</small>}</span>
                  {m.disabled && <span className="hint">Disabled</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">{integrations ? 'No extra tools yet — add one below.' : 'Checking…'}</p>
          )}

          <h3 className="integ-h">Plugins</h3>
          {integrations && !integrations.loggedIn && (
            <p className="hint">Sign in to Devin (<code>devin auth login</code>) to install or update plugins; the list below is what’s already on this computer.</p>
          )}
          {integrations?.plugins?.length ? (
            <ul className="health">
              {integrations.plugins.map(p => (
                <li key={p.name}>
                  <span className="dot ok" />
                  <span className="health-name">{p.name === 'default' ? 'Your own skills' : p.displayName}
                    {(p.name === 'default' || p.description) && <small className="integ-desc">{p.name === 'default' ? 'Skills uploaded to your Devin account' : p.description}</small>}</span>
                  <span className="integ-meta">
                    {p.keywords.map(k => <span key={k} className="chip">{k}</span>)}
                    {p.skills.length > 0 && <span className="chip">{p.skills.length} skill{p.skills.length === 1 ? '' : 's'}</span>}
                    {p.mcpServers.length > 0 && <span className="chip">includes MCP</span>}
                    {p.homepage && <a href={p.homepage} target="_blank" rel="noreferrer">website</a>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            integrations && <p className="hint">No plugins installed yet — add one below.</p>
          )}

          <h3 className="integ-h">{SETUP_INTEGRATIONS.title}</h3>
          <div className="howto">
            {SETUP_INTEGRATIONS.howtos.map(h => (
              <div key={h.id} className="setup-account">
                <h3>{h.title}</h3>
                <ol>
                  {h.steps.map((s, i) => (
                    <li key={i}>{s.text}{s.code && <div className="howto-code"><code>{s.code}</code><CopyButton text={s.code} /></div>}</li>
                  ))}
                </ol>
                {h.link && <a className="btn" href={h.link} target="_blank" rel="noreferrer">{h.linkLabel}</a>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button className="btn" disabled={checking} onClick={() => { setChecking(true); recheck().finally(() => setChecking(false)); }}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        {health && !req.length && <a className="btn primary" href="#profile">Start with your profile</a>}
      </div>
    </>
  );
}
