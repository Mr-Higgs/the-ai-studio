import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { api, ask, post, put, toast, useAgent } from './api.js';
import { supabase } from './supabase.js';
import { PHASES, SPRINTS, STEPS, countdown, setSprint } from './steps.js';
import { BRAIN_STEP, brainReady, sectionProgress, BRAIN_SECTIONS } from './brain.js';
import Brain from './components/Brain.jsx';
import Chat from './components/Chat.jsx';
import GenerateStep from './components/GenerateStep.jsx';
import Guide from './components/Guide.jsx';
import Profile from './components/Profile.jsx';
import Tracker from './components/Tracker.jsx';
import VideoStudio from './components/VideoStudio.jsx';
import Setup from './components/Setup.jsx';
import Login from './components/Login.jsx';

export const AGENT_NAMES = { devin: 'Devin' };

function useHash() {
  const read = () => decodeURIComponent(location.hash.slice(1));
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return [hash, h => { location.hash = h; }];
}

// localStorage can throw (private mode, blocked storage) — prefs are nice-to-have only.
const pref = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v)); } catch { return null; } };
const root = document.documentElement;
{ const w = pref('chatW'); if (w) root.style.setProperty('--chat-w', w + 'px'); }

// Drag the chat's left edge to resize it; arrow keys nudge, double-click resets. Width is shared by every chat column.
export function ChatGrip() {
  const set = w => { w = Math.round(Math.max(280, Math.min(w, innerWidth * .55))); root.style.setProperty('--chat-w', w + 'px'); pref('chatW', w); };
  const width = el => el.parentElement.getBoundingClientRect().width;
  const down = e => {
    const el = e.currentTarget, x0 = e.clientX, w0 = width(el);
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging'); root.classList.add('resizing');
    el.onpointermove = m => set(w0 + x0 - m.clientX);
    el.onpointerup = el.onpointercancel = () => { el.onpointermove = null; el.classList.remove('dragging'); root.classList.remove('resizing'); };
  };
  const key = e => {
    const d = { ArrowLeft: 24, ArrowRight: -24 }[e.key];
    if (d) { e.preventDefault(); set(width(e.currentTarget) + d); }
  };
  const reset = () => { root.style.removeProperty('--chat-w'); pref('chatW', null); };
  return <div className="side-grip" role="separator" aria-orientation="vertical" aria-label="Resize chat (arrow keys, double-click to reset)" tabIndex={0} onPointerDown={down} onKeyDown={key} onDoubleClick={reset} />;
}

// System / light / dark. index.html applies the saved choice before first paint.
function ThemePick() {
  const [theme, setTheme] = useState(() => pref('theme') || 'system');
  const pick = t => {
    setTheme(t);
    if (t === 'system') { delete root.dataset.theme; pref('theme', null); }
    else { root.dataset.theme = t; pref('theme', t); }
  };
  return (
    <div className="theme-pick" role="group" aria-label="Theme">
      {['system', 'light', 'dark'].map(t => <button key={t} type="button" aria-pressed={theme === t} onClick={() => pick(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
    </div>
  );
}

// A broken view (e.g. a file Devin wrote in an unexpected shape) shouldn't blank the app.
class StepBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="placeholder" role="alert">
        <p>Something went wrong showing this step{this.props.file ? <> — probably <code>business/{this.props.file}</code> isn’t in the shape the page expects. Ask the assistant to fix that file</> : ''}, then reload.</p>
        <p className="hint">{String(this.state.error.message || this.state.error)}</p>
      </div>
    );
  }
}

export default function App() {
  const [me, setMe] = useState(null); // { hosted, email?, admin? }
  const [biz, setBiz] = useState(null);
  const [projects, setProjects] = useState([]);
  const [health, setHealth] = useState(null);
  const [workingOn, setWorkingOn] = useState(null);
  const [hash, go] = useHash();

  const refresh = useCallback(() => Promise.all([
    api('/api/business').then(setBiz),
    api('/api/projects').then(r => setProjects(r.projects)),
  ]).catch(() => {}), []);
  const signedIn = me && (!me.hosted || me.email);
  const agent = useAgent(signedIn ? '/api/agent/business' : null, refresh);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setMe(session ? await api('/api/auth/me').catch(() => null) : { hosted: true });
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => load());
    const unauth = () => setMe({ hosted: true });
    addEventListener('unauth', unauth);
    return () => { subscription.unsubscribe(); removeEventListener('unauth', unauth); };
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    refresh();
    api('/api/health').then(r => setHealth(r.items)).catch(() => {});
  }, [refresh, signedIn]);
  useEffect(() => { if (!agent.busy) setWorkingOn(null); }, [agent.busy]);

  const recheck = () => api('/api/health').then(r => setHealth(r.items));
  if (!me) return <div className="boot">Loading your workspace…</div>;
  if (me.hosted && !me.email) return <Login onDone={() => api('/api/auth/me').then(setMe)} />;
  if (!biz) return <div className="boot">Loading your workspace…</div>;

  setSprint(biz.sprint?.id); // before anything reads STEPS
  const agentName = AGENT_NAMES[biz.agent] || 'Devin';
  const byId = { ...Object.fromEntries(STEPS.map(s => [s.id, s])), brain: BRAIN_STEP };
  // When each step's output last changed (null = not done). Drives ticks and "out of date".
  const mtimeOf = id => {
    const s = byId[id];
    if (!s) return null;
    if (s.kind === 'brain') return biz.mtimes.brain ?? null;
    if (s.kind === 'doc') return biz.docs[s.file.replace('.md', '')]?.mtime ?? null;
    if (s.kind === 'video') return projects.some(p => p.videos.length) ? 0 : null;
    return biz.profile?.name || s.kind !== 'profile' ? biz.mtimes[s.kind] ?? null : null;
  };
  const isDone = id => id === 'brain' ? brainReady(biz.brain, biz.profile) : mtimeOf(id) != null && (id !== 'calendar' || !!biz.calendar?.length) && (id !== 'tracker' || !!biz.tracker?.length);
  const doneCount = STEPS.filter(s => isDone(s.id)).length;
  const missing = g => health ? health.some(h => h.group === g && !h.ok) : null;
  const setupOk = health ? !missing('required') : undefined; // video tools only matter on the video step
  const route = hash || 'guide'; // Start here; its button jumps to the first unfinished step
  const step = byId[route] || null;
  const next = step && STEPS[STEPS.indexOf(step) + 1];
  const { days, label } = countdown(biz.sprint);

  const saveProfile = async profile => { await put('/api/business/profile.json', profile); await refresh(); };
  // Step answers live apart from the profile so saving them doesn't make every step look out of date.
  const saveInputs = (id, inputs) => put('/api/business/inputs.json', { ...biz.inputs, [id]: inputs }).then(refresh).catch(e => toast(`Couldn’t save your answers: ${e.message}`));
  const generate = (s, prompt, snapshot) => { setWorkingOn(s.title); agent.send(prompt, snapshot); };

  const ctx = { biz, agent, agentName, workingOn, generate, saveInputs, refresh, next, go, isDone, mtimeOf, byId };
  const chatEmpty = step?.kind === 'profile'
    ? <><strong>{agentName} can help with the numbers.</strong><p>Don’t know a figure? Mark it “Not sure”, then press “Work out … with {agentName}”. It walks you through each one and fills in the answers for you to check.</p></>
    : <><strong>{agentName} is your campaign partner.</strong><p>Use the button on the left to write this step, then ask for changes here — “make it shorter”, “more playful”, “add a gift-card option”.</p></>;

  let page;
  if (route === 'setup') page = <main className="main wide"><Setup health={health} recheck={recheck} /></main>;
  else if (route === 'guide' || !step) page = <main className="main wide"><Guide ctx={ctx} agentName={agentName} /></main>;
  else if (step.kind === 'video') page = <StepBoundary key="video"><VideoStudio step={step} projects={projects} ctx={ctx} /></StepBoundary>;
  else page = (
    <>
      <main className="main">
        {setupOk === false && step.kind !== 'profile' && (
          <a className="banner" href="#setup">Some tools aren’t set up yet, so {agentName} may not be able to finish this. Open setup to fix it.</a>
        )}
        <StepBoundary key={step.id} file={step.file}>
          {step.kind === 'profile' && <Profile step={step} profile={biz.profile} save={saveProfile} ctx={ctx} />}
          {(step.kind === 'doc' || step.kind === 'calendar') && <GenerateStep step={step} {...ctx} />}
          {step.kind === 'tracker' && <Tracker step={step} {...ctx} />}
          {step.kind === 'brain' && <Brain ctx={ctx} />}
        </StepBoundary>
      </main>
      <aside className="side" aria-label={`Chat with ${agentName}`}>
        <ChatGrip />
        <div className="side-head">
          <span>{agentName}</span>
          {agent.busy && <span className="side-status">{workingOn ? `Working on ${workingOn.toLowerCase()}` : 'Working'}</span>}
        </div>
        <Chat agent={agent} agentName={agentName} empty={chatEmpty} />
      </aside>
    </>
  );

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-name">{SPRINTS[biz.sprint?.id]?.name || SPRINTS.holiday.name}</span>
          <div className="countdown" aria-label={`${days} days to ${label}`}>
            <span className="countdown-n">{days}</span>
            <span className="countdown-l">{days === 1 ? 'day' : 'days'} to {label}</span>
          </div>
        </div>
        <BusinessPick current={biz.profile?.name} busy={agent.busy} />
        <SprintPick sprint={biz.sprint} busy={agent.busy} />
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={doneCount} aria-label="Workshop progress">
          <div className="progress-bar" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
          <span>{doneCount} of {STEPS.length} done</span>
        </div>
        <nav aria-label="Workshop steps">
          <a href="#guide" className={'start-here' + (route === 'guide' ? ' active' : '')} aria-current={route === 'guide' ? 'page' : undefined}>Start here</a>
          <a href="#brain" className={'start-here brain-link' + (route === 'brain' ? ' active' : '') + (isDone('brain') ? ' done' : '')} aria-current={route === 'brain' ? 'page' : undefined}>
            <span>Business Brain</span>
            <small>{isDone('brain') ? '✓' : `${BRAIN_SECTIONS.filter(s => s.required && sectionProgress(biz.brain, biz.profile, s).ready).length}/${BRAIN_SECTIONS.filter(s => s.required).length}`}</small>
            {workingOn === BRAIN_STEP.title && <span className="working" title={`${agentName} is working on this`} />}
          </a>
          <ol className="steps">
            {PHASES.map(p => (
              <li key={p.name} className="phase">
                <span className="phase-name">{p.name}<small>{p.steps.filter(isDone).length}/{p.steps.length}</small></span>
                <ol>
                  {p.steps.map(id => byId[id]).filter(Boolean).map(s => (
                    <li key={s.id}>
                      <a href={'#' + s.id} className={(s === step ? 'active ' : '') + (isDone(s.id) ? 'done' : '')} aria-current={s === step ? 'page' : undefined}>
                        <span className="step-n">{isDone(s.id) ? '✓' : STEPS.indexOf(s) + 1}</span>
                        <span>{s.title}</span>
                        {workingOn === s.title && <span className="working" title={`${agentName} is working on this`} />}
                      </a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </nav>
        <div className="rail-foot">
          <a className="setup-link" href="/api/business/export.md" download>Download my sprint</a>
          <a href="#setup" className={'setup-link' + (route === 'setup' ? ' active' : '')}>
            <span className={'dot ' + (!health ? '' : !setupOk ? 'bad' : 'ok')} />
            {setupOk === false ? 'Finish setup' : 'Setup'}
            </a>
          <div className="agent-pick">
            <span className="who" title={me.email}>{me.email}</span>
            <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
          <ThemePick />
        </div>
      </aside>
      {page}
      <Toasts />
      <Confirm />
    </div>
  );
}

// Which business this workspace is for. Switching swaps the whole workspace, so reload to pick it all up.
function BusinessPick({ current, busy }) {
  const [list, setList] = useState([]);
  useEffect(() => { api('/api/businesses').then(r => setList(r.list)).catch(() => {}); }, [current]);
  const pick = async v => {
    if (v === 'new' && !(await ask('Start a new business? This one is saved and you can switch back any time.', 'Start new'))) return;
    try {
      await post(`/api/businesses/${v === 'new' ? 'new' : 'switch'}`, { id: v });
      location.hash = v === 'new' ? '#profile' : '#guide';
      location.reload();
    } catch (e) { toast(e.message); }
  };
  return (
    <label className="agent-pick">
      <span>Business</span>
      <select value="" onChange={e => pick(e.target.value)} disabled={busy}>
        <option value="" disabled>{current || 'Unnamed business'}</option>
        {list.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value="new">+ New business</option>
      </select>
    </label>
  );
}

// Same steps either way; the sprint changes the wording, prompts and countdown. Saved per business.
function SprintPick({ sprint, busy }) {
  const current = SPRINTS[sprint?.id] ? sprint.id : 'holiday';
  const pick = async id => {
    if (!(await ask(`Switch to ${SPRINTS[id].name}? Your existing plans stay; regenerate steps to fit the new sprint.`, 'Switch sprint'))) return;
    try {
      await put('/api/business/sprint.json', { id, name: SPRINTS[id].name, started: new Date().toLocaleDateString('en-CA') });
      location.reload();
    } catch (e) { toast(e.message); }
  };
  return (
    <label className="agent-pick">
      <span>Sprint</span>
      <select value={current} onChange={e => pick(e.target.value)} disabled={busy}>
        {Object.values(SPRINTS).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}

// One question at a time via ask(); native <dialog> handles focus, Esc and the backdrop.
function Confirm() {
  const [req, setReq] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const on = e => setReq(e.detail);
    addEventListener('ask', on);
    return () => removeEventListener('ask', on);
  }, []);
  useEffect(() => { if (req && !ref.current.open) { ref.current.returnValue = ''; ref.current.showModal(); } }, [req]);
  const close = () => { req?.resolve(ref.current.returnValue === 'ok'); setReq(null); };
  return (
    <dialog ref={ref} className="confirm" onClose={close}>
      <form method="dialog">
        <p>{req?.text}</p>
        <div className="confirm-actions">
          <button className="btn" value="cancel">Cancel</button>
          <button className="btn primary" value="ok" autoFocus>{req?.ok}</button>
        </div>
      </form>
    </dialog>
  );
}

// Stacks toasts bottom-right; each clears itself after a few seconds (errors linger longer) or on ×.
function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    let n = 0;
    const on = e => {
      const t = { id: ++n, ...e.detail };
      setList(l => [...l.slice(-3), t]); // ponytail: keep the last 4, older ones just drop
      setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), t.kind === 'err' ? 8000 : 4000);
    };
    addEventListener('toast', on);
    return () => removeEventListener('toast', on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={'toast ' + t.kind}>
          <span>{t.text}</span>
          <button onClick={() => setList(l => l.filter(x => x.id !== t.id))} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
