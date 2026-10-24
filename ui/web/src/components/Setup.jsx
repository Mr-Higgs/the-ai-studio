import { useState } from 'react';
import { SETUP_ACCOUNT } from '../steps.js';
import { post } from '../api.js';

const GROUPS = [
  ['required', 'Needed for everything'],
  ['optional', 'Optional extras'],
  ['integrations', 'Integrations (through Devin)'],
];

// API keys are pasted here and saved (encrypted) to the account; they never come back to the page.
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

// MCP servers plug into Devin, not Studio: the user adds them in their Devin org (marketplace
// listing or custom URL), then flips this on so Devin's prompts know it may use them.
// ponytail: Devin has no per-listing deep link, so everything opens the MCPs tab.
const DEVIN_MCPS = 'https://app.devin.ai/customize?tab=mcps';
function Toggle({ item, recheck }) {
  const [state, setState] = useState('');
  const flip = async on => {
    setState('saving');
    try { await post('/api/setup/integration', { id: item.id, on }); await recheck(); setState(''); }
    catch (err) { setState(err.message); }
  };
  return <>
    <label className="chip" title="Connected in Devin">
      <input type="checkbox" checked={item.ok} disabled={state === 'saving'} onChange={e => flip(e.target.checked)} aria-label={`${item.name} connected in Devin`} />
      <span>{item.ok ? 'On' : 'Off'}</span>
    </label>
    {state && state !== 'saving' && <p className="msg err" role="alert">{state}</p>}
  </>;
}

// Meta servers are custom MCPs: Devin walks the owner through adding one, then checks it works.
function MetaRow({ item, recheck }) {
  const [state, setState] = useState('');
  const start = async () => {
    const w = window.open('', '_blank'); // opened now so the popup blocker allows it
    setState('starting');
    try { const { url } = await post(`/api/setup/integration/${item.id}/devin`, {}); if (w) w.location = url; else window.location.href = url; await recheck(); setState(''); }
    catch (err) { w?.close(); setState(err.message); }
  };
  return (
    <li className={item.ok ? 'ok' : 'bad'}>
      <span className={'dot ' + (item.ok ? 'ok' : '')} />
      <span className="health-name">{item.name}<small>{item.why}</small></span>
      {item.setup
        ? <a className="btn ghost" href={item.setup.url} target="_blank" rel="noreferrer">Open Devin session</a>
        : !item.ok && <button className="btn primary" disabled={state === 'starting'} onClick={start}>{state === 'starting' ? 'Starting…' : 'Set up with Devin'}</button>}
      <Toggle item={item} recheck={recheck} />
      {item.setup && <p className="hint integ-note">{item.setup.note || 'Devin is guiding you in the session tab. When it’s done, click Check again.'}</p>}
      {state && state !== 'starting' && <p className="msg err" role="alert">{state}</p>}
      {!item.ok && (
        <details className="integ-note">
          <summary className="hint">Do it yourself</summary>
          <ol>
            <li>In Devin, open <a href={DEVIN_MCPS} target="_blank" rel="noreferrer">Customize → MCPs</a>, choose <strong>Add custom MCP</strong>, and add a remote (HTTP) server with this URL: <code>{item.url}</code></li>
            <li>Sign in with the Facebook account that manages your business, and approve access.</li>
            <li>Come back here and switch it on.</li>
          </ol>
          <p className="hint">Devin will only read your ads and create new ones <strong>paused</strong> — you review and switch them on in Meta. <a href="https://developers.facebook.com/documentation/mcp" target="_blank" rel="noreferrer">Meta’s guide</a></p>
        </details>
      )}
    </li>
  );
}

function Integrations({ items, recheck }) {
  const meta = items.filter(i => i.url), market = items.filter(i => i.marketplace);
  return <>
    <ul className="health">{meta.map(i => <MetaRow key={i.id} item={i} recheck={recheck} />)}</ul>
    <div className="integ-market">
      <p className="hint">From Devin’s marketplace: open <strong>Customize → MCPs → Browse marketplace</strong>, install the app, choose <strong>Connect</strong> and sign in. Then switch it on here.</p>
      <a className="btn ghost" href={DEVIN_MCPS} target="_blank" rel="noreferrer">Open Devin MCPs</a>
    </div>
    <ul className="integ-grid">
      {market.map(i => (
        <li key={i.id} className="integ-tile">
          <span className="health-name" title={i.why}>{i.name}<small>{i.why}</small></span>
          <Toggle item={i} recheck={recheck} />
        </li>
      ))}
    </ul>
  </>;
}

// The Devin item needs two values: the cog_ key and the organization ID from the same page.
function DevinKeys({ item, recheck }) {
  const [open, setOpen] = useState(!item.ok);
  const [key, setKey] = useState('');
  const [org, setOrg] = useState('');
  const [state, setState] = useState('');
  const save = async e => {
    e.preventDefault();
    setState('saving');
    try {
      await post('/api/setup/env', { name: 'DEVIN_API_KEY', value: key.trim() });
      await post('/api/setup/env', { name: 'DEVIN_ORG_ID', value: org.trim() });
      setKey(''); setOrg(''); setState(''); setOpen(false); await recheck();
    } catch (err) { setState(err.message); }
  };
  if (!open) return <><span className="hint">Ready</span><button className="btn ghost" onClick={() => setOpen(true)}>Replace</button></>;
  return (
    <form className="key-form" onSubmit={save}>
      <label htmlFor="devin-key" className="sr">Devin API key</label>
      <input id="devin-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="Devin API key (cog_…)" />
      <label htmlFor="devin-org" className="sr">Organization ID</label>
      <input id="devin-org" autoComplete="off" spellCheck={false} value={org} onChange={e => setOrg(e.target.value)} placeholder="Organization ID" />
      <button className="btn primary" disabled={!key.trim() || !org.trim() || state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save'}</button>
      {item.link && <a className="btn ghost" href={item.link} target="_blank" rel="noreferrer">Open Devin settings</a>}
      {item.ok && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>}
      {state && state !== 'saving' && <p className="msg err" role="alert">{state}</p>}
    </form>
  );
}

export default function Setup({ health, recheck }) {
  const [checking, setChecking] = useState(false);
  const missing = g => health?.filter(h => h.group === g && !h.ok) || [];
  const req = missing('required');

  const summary = !health ? 'Checking your account…'
    : req.length ? 'Add your Devin key and Org ID to start.'
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

      {GROUPS.map(([g, title]) => (
        <section key={g} className="setup-group">
          <h2>{title}</h2>
          {g === 'integrations' ? health && <Integrations items={health.filter(h => h.group === g)} recheck={recheck} /> :
          <ul className="health">
            {health?.filter(h => h.group === g).map(h => (
              <li key={h.id} className={h.ok ? 'ok' : 'bad'}>
                <span className={'dot ' + (h.ok ? 'ok' : g === 'required' ? 'bad' : 'warn')} />
                <span className="health-name">{h.name}<small>{h.why}</small></span>
                {h.id === 'devin' ? <DevinKeys item={h} recheck={recheck} />
                  : h.key ? <KeyInput item={h} recheck={recheck} />
                  : h.ok ? <span className="hint">Ready</span> : null}
              </li>
            ))}
          </ul>}
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
