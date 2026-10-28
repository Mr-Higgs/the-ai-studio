import { useState } from 'react';
import { SETUP_ACCOUNT } from '../steps.js';
import { post } from '../api.js';
import { connectHeyGen } from '../heygen.js';
import { connectGoogle } from '../google.js';

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
  if (!open) return <>
    <span className="hint">Ready</span>
    <button className="btn ghost" onClick={() => setOpen(true)}>Replace</button>
  </>;
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

// HeyGen: OAuth connection (plan credits) preferred; the API key stays as a fallback.
function HeyGenRow({ item, recheck }) {
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const connect = async () => {
    setBusy(true); setState('');
    // HeyGen allowlists one callback URL, so on an unapproved origin we steer to the API key.
    const onError = d => {
      if (d?.reason === 'redirect_uri') {
        setState('HeyGen hasn’t approved sign-in from this site yet. Paste a HeyGen API key below instead (bills HeyGen API credits, which are separate from your plan).');
        setKeyOpen(true);
      } else setState(d?.message || 'HeyGen didn’t connect. Try again.');
    };
    try { await connectHeyGen(recheck, onError); } catch (err) { setState(err.message); }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true); setState('');
    try { await post('/api/heygen/oauth/disconnect'); await recheck(); } catch (err) { setState(err.message); }
    setBusy(false);
  };
  if (item.oauth) return <>
    <span className="hint">Connected{item.account?.email ? ` as ${item.account.email}` : ''} · uses your HeyGen plan credits</span>
    <button className="btn ghost" disabled={busy} onClick={disconnect}>{busy ? 'Working…' : 'Disconnect'}</button>
    {state && <p className="msg err" role="alert">{state}</p>}
  </>;
  return <>
    <button className="btn primary" disabled={busy} onClick={connect}>{busy ? 'Connecting…' : 'Connect HeyGen'}</button>
    {item.apiKey && <span className="hint">Using your API key (API credits).</span>}
    {state && <p className="msg err" role="alert">{state}</p>}
    <details className="integ-note" open={keyOpen} onToggle={e => setKeyOpen(e.currentTarget.open)}>
      <summary className="hint">Use an API key instead</summary>
      <p className="hint">API keys bill HeyGen API credits, which are separate from your plan.</p>
      <KeyInput item={item} recheck={recheck} />
    </details>
  </>;
}

// Google Business Profile: Studio-owned OAuth reads the listing so docs and the
// website match Google's name/address/phone/hours word for word.
function GoogleRow({ item, recheck }) {
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true); setState('');
    try { await connectGoogle(recheck); } catch (err) { setState(err.message); }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true); setState('');
    try { await post('/api/google/oauth/disconnect'); await recheck(); } catch (err) { setState(err.message); }
    setBusy(false);
  };
  const sync = async () => {
    setBusy(true); setState('');
    try { await post('/api/google/sync'); await recheck(); } catch (err) { setState(err.message); }
    setBusy(false);
  };
  const pick = async name => {
    setState('');
    try { await post('/api/google/location', { name }); await recheck(); } catch (err) { setState(err.message); }
  };
  const account = item.account;
  if (!item.available) return <>
    <button className="btn primary" disabled>Connect Google Business Profile</button>
    <p className="hint">Coming soon — Studio is waiting on Google’s approval to read Business Profiles. Until then, keep your listing up to date at business.google.com.</p>
    {item.link && <a className="btn ghost" href={item.link} target="_blank" rel="noreferrer">Open Google Business Profile</a>}
  </>;
  if (!item.oauth) return <>
    <button className="btn primary" disabled={busy} onClick={connect}>{busy ? 'Connecting…' : 'Connect Google Business Profile'}</button>
    {state && <p className="msg err" role="alert">{state}</p>}
  </>;
  return <>
    <span className="hint">Connected{account?.email ? ` as ${account.email}` : ''}</span>
    {account?.pending && <>
      <p className="hint">Connected. Google hasn’t finished approving Studio’s access to read listings yet — we’ll pick up your listing automatically once it has.</p>
      <button className="btn ghost" disabled={busy} onClick={sync}>{busy ? 'Checking…' : 'Check again'}</button>
    </>}
    {!account?.pending && account?.locations?.length > 1 && (
      <label className="agent-pick">
        <span>Listing</span>
        <select value={account.location || ''} onChange={e => pick(e.target.value)}>
          <option value="" disabled>Choose your listing</option>
          {account.locations.map(l => <option key={l.name} value={l.name}>{l.title}{l.address ? ` — ${l.address}` : ''}</option>)}
        </select>
      </label>
    )}
    {!account?.pending && account?.locations?.length === 1 && (
      <span className="hint">Listing: {account.locations[0].title}{account.locations[0].address ? `, ${account.locations[0].address}` : ''}</span>
    )}
    {!account?.pending && account && !account.locations?.length && (
      <p className="hint">No Business Profile found on this Google account. Sign in with the account that manages your listing.</p>
    )}
    <button className="btn ghost" disabled={busy} onClick={disconnect}>{busy ? 'Working…' : 'Disconnect'}</button>
    {state && <p className="msg err" role="alert">{state}</p>}
  </>;
}

function MetaApiInput({ item, recheck }) {
  const [open, setOpen] = useState(!item.ok);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [state, setState] = useState('');
  const [message, setMessage] = useState('');
  const [instagramError, setInstagramError] = useState('');
  const save = async event => {
    event.preventDefault();
    setState('saving');
    setMessage('');
    setInstagramError('');
    try {
      const result = await post('/api/setup/meta', { token: token.trim(), accountId: accountId.trim() });
      setToken('');
      setAccountId('');
      setState('');
      setMessage(`Connected to ${result.account}`);
      if (result.instagram?.error) setInstagramError(result.instagram.error);
      setOpen(false);
      await recheck();
    } catch (error) {
      setState(error.message);
    }
  };
  const disconnect = async () => {
    setState('saving');
    setMessage('');
    try {
      await post('/api/setup/meta', { disconnect: true });
      setState('');
      setOpen(true);
      await recheck();
    } catch (error) {
      setState(error.message);
    }
  };
  if (item.ok && !open) return <>
    <span className="hint">Ready</span>
    <span className="hint">Instagram: {item.instagram ? `@${item.instagram}` : 'not found'}</span>
    <button className="btn ghost" onClick={() => setOpen(true)}>Replace</button>
    <button className="btn ghost" disabled={state === 'saving'} onClick={disconnect}>{state === 'saving' ? 'Disconnecting…' : 'Disconnect'}</button>
    {message && <p className="hint ok">{message}</p>}
    {instagramError && <p className="msg err" role="alert">{instagramError}</p>}
    {state && state !== 'saving' && <p className="msg err" role="alert">{state}</p>}
  </>;
  return (
    <div className="meta-setup">
      <form className="key-form" onSubmit={save}>
        <label htmlFor="meta-access-token" className="sr">Access token</label>
        <input id="meta-access-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value)} placeholder="Access token" />
        <label htmlFor="meta-account-id" className="sr">Ad account ID</label>
        <input id="meta-account-id" autoComplete="off" spellCheck={false} value={accountId} onChange={event => setAccountId(event.target.value)} placeholder="Ad account ID" />
        <button className="btn primary" disabled={!token.trim() || !accountId.trim() || state === 'saving'}>{state === 'saving' ? 'Connecting…' : 'Save'}</button>
        {item.ok && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>}
        {state && state !== 'saving' && <p className="msg err" role="alert">{state}</p>}
      </form>
      {message && <p className="hint ok">{message}</p>}
      <details className="integ-note">
        <summary className="hint">How to get these</summary>
        <ol>
          <li>In Meta Business Settings → Users → System users, add a system user.</li>
          <li>Assign it your ad account with “View performance” access.</li>
          <li>Generate a token with <code>ads_read</code> and, for Instagram, <code>instagram_basic</code>, <code>instagram_manage_insights</code> and <code>pages_read_engagement</code>; paste it here.</li>
          <li>The ad account ID is the number after <code>act=</code> in the Ads Manager URL.</li>
          <li>To include organic Instagram, also assign your Facebook Page (connected to Instagram) to the system user.</li>
        </ol>
      </details>
      <p className="hint">Studio only reads results. It never creates or changes ads.</p>
    </div>
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
                  : h.id === 'meta_api' ? <MetaApiInput item={h} recheck={recheck} />
                  : h.id === 'heygen' ? <HeyGenRow item={h} recheck={recheck} />
                  : h.id === 'google_business' ? <GoogleRow item={h} recheck={recheck} />
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
