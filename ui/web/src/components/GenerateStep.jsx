import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Calendar from './Calendar.jsx';
import { api, toast } from '../api.js';
import { SPRINT, SPRINTS, STEPS, phaseOf, targetSummary } from '../steps.js';
import { growthTargets } from '../brain.js';
import Experiments from './Experiments.jsx';
import InstagramPanel from './InstagramPanel.jsx';

export function StepHead({ step, ctx, children }) {
  return (
    <header className="step-head">
      <div className="eyebrow">{phaseOf(step.id)?.name} · Step {STEPS.indexOf(step) + 1} of {STEPS.length}</div>
      <h1>{step.title}</h1>
      <p>{step.blurb}</p>
      {ctx && <BuildsOn step={step} ctx={ctx} />}
      {ctx && step.guide && <StepGuide guide={step.guide} open={!ctx.isDone(step.id)} />}
      {children}
    </header>
  );
}

// "How to do this step": open until the step is done, then tucked away.
export function StepGuide({ guide, open }) {
  return (
    <details className="step-guide" open={open}>
      <summary>How to do this step <span>{guide.time}</span></summary>
      <div className="step-guide-body">
        <p>{guide.why}</p>
        <div className="step-guide-cols">
          <div>
            <h3>Done looks like</h3>
            <ul className="done-list">{guide.done.map(d => <li key={d}>{d}</li>)}</ul>
          </div>
          <div>
            <h3>Tips</h3>
            <ul>{guide.tips.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>
    </details>
  );
}

// Which earlier steps feed this one, and whether they've changed since it was written.
export function BuildsOn({ step, ctx }) {
  const uses = (step.uses || []).map(id => ctx.byId[id]).filter(Boolean);
  if (!uses.length) return null;
  const mine = ctx.mtimeOf(step.id);
  const changed = mine == null ? [] : uses.filter(u => u.kind !== 'tracker' && u.kind !== 'video' && (ctx.mtimeOf(u.id) ?? 0) > mine);
  const missing = uses.filter(u => !ctx.isDone(u.id));
  return (
    <>
      <p className="builds-on">
        Builds on{' '}
        {uses.map((u, i) => (
          <span key={u.id}>
            {i > 0 && ', '}
            <a href={'#' + u.id} className={ctx.isDone(u.id) ? 'is-done' : 'is-missing'}>{u.title}{ctx.isDone(u.id) ? ' ✓' : ''}</a>
          </span>
        ))}
        {missing.length > 0 && <span className="hint"> — you can start here anyway; {ctx.agentName} fills the gaps with labelled assumptions.</span>}
      </p>
      {changed.length > 0 && (
        <p className="stale" role="status">
          {changed.map(u => u.title).join(' and ')} changed after this was written. Rewrite to bring it in line.
        </p>
      )}
    </>
  );
}

export function Fields({ fields, values, onChange, after }) {
  const set = (id, v) => onChange({ ...values, [id]: v });
  return fields.map(f => {
    if (f.heading) return (
      <div key={'h-' + f.heading} className="fields-head">
        <h3>{f.heading}</h3>
        {f.blurb && <p className="hint">{f.blurb}</p>}
      </div>
    );
    const id = 'f-' + f.id, v = values[f.id];
    if (f.type === 'checks') return (
      <fieldset key={f.id} className="field checks">
        <legend>{f.label}</legend>
        {f.options.map(o => (
          <label key={o} className="chip">
            <input type="checkbox" checked={!!v?.includes(o)} onChange={e => set(f.id, e.target.checked ? [...(v || []), o] : (v || []).filter(x => x !== o))} />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
    );
    return (
      <div key={f.id} className={'field' + (f.type === 'textarea' ? ' full' : '')}>
        <label htmlFor={id}>{f.label}</label>
        {f.type === 'textarea' ? <textarea id={id} rows={3} value={v || ''} placeholder={f.placeholder} onChange={e => set(f.id, e.target.value)} />
          : f.type === 'select' ? (
            <select id={id} value={v || ''} onChange={e => set(f.id, e.target.value)}>
              <option value="">Choose…</option>
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : <input id={id} type={f.type || 'text'} inputMode={f.num ? 'decimal' : undefined} value={v || ''} placeholder={f.placeholder} onChange={e => set(f.id, e.target.value)} />}
        {after?.(f)}
      </div>
    );
  });
}

const ago = ms => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const stampLabel = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function History({ files }) {
  const [view, setView] = useState(null); // { kind, content } fetched on click
  if (!files?.length) return null;
  const open = f => api(`/api/business/history/${f.id}`).then(r => setView({ ...r, at: f.at })).catch(e => toast(e.message));
  let items = null;
  if (view?.kind === 'calendar') { try { items = JSON.parse(view.content); } catch { items = []; } }
  return (
    <details className="history">
      <summary>Previous versions ({files.length})</summary>
      <ul>{files.map(f => <li key={f.id}><button type="button" className="btn ghost" onClick={() => open(f)}>{stampLabel(f.at)}</button></li>)}</ul>
      {view && (
        <div className="history-view">
          <div className="doc-bar"><span>Version from {stampLabel(view.at)}</span><CopyButton text={view.content} /></div>
          {view.kind === 'calendar'
            ? <ul>{(items || []).map((item, i) => <li key={i}>{item.date} · {item.channel} {item.format} · {item.title}</li>)}</ul>
            : <div className="prose"><Markdown remarkPlugins={[remarkGfm]}>{view.content}</Markdown></div>}
        </div>
      )}
    </details>
  );
}

// A step Devin writes: a few inputs, one button, and the saved result underneath.
export default function GenerateStep({ step, ...ctx }) {
  const { biz, agent, agentName, workingOn, generate, saveInputs, refresh, next, go } = ctx;
  const [inputs, setInputs] = useState(biz.inputs?.[step.id] || {});
  const doc = step.kind === 'doc' ? biz.docs[step.file.replace('.md', '')] : null;
  const has = step.kind === 'calendar' ? !!biz.calendar?.length : !!doc;
  const mine = workingOn === step.title;
  const history = biz.history?.[step.file.replace(/\.(md|json)$/, '')];
  const targetHints = biz.sprint?.id === 'growth' && step.id === 'strategy' ? growthTargets(biz.brain, biz.profile) : null;
  const targetSummaryText = targetHints ? targetSummary(targetHints) : '';

  const run = () => {
    saveInputs(step.id, inputs);
    generate(step, step.prompt(inputs, step, biz), has ? step.file : undefined); // keep the old version before a rewrite
  };

  const form = (
    <div className="inputs">
      <div className="fields"><Fields fields={step.inputs} values={inputs} onChange={setInputs} /></div>
      {targetHints && <p className="hint growth-target-hint">{targetSummaryText ? `App-calculated sprint targets: ${targetSummaryText}` : `App-calculated targets are incomplete. Missing: ${targetHints.missing.join(', ') || 'product costs and customer value'}.`}</p>}
      <div className="actions">
        <button className="btn primary" onClick={run} disabled={agent.busy}>
          {mine ? `${agentName} is writing…` : has ? `Rewrite with ${agentName}` : `Write it with ${agentName}`}
        </button>
        {!biz.profile?.name && !agent.busy && <span className="hint">No <a href="#profile">business profile</a> yet, so {agentName} will ask a few quick questions first.</span>}
        {agent.busy && !mine && <span className="hint">{agentName} is busy{workingOn ? ` with ${workingOn.toLowerCase()}` : ''}. This unlocks when it’s done.</span>}
        {mine && <span className="hint">Watch the chat on the right. {agentName} may ask you a question there first.</span>}
      </div>
    </div>
  );

  return (
    <>
      <StepHead step={step} ctx={ctx} />
      {has ? <details className="inputs-fold"><summary>Change the answers and rewrite</summary>{form}</details> : form}

      {step.kind === 'calendar' && biz.calendarIssues > 0 && (
        <p className="stale" role="status">{biz.calendarIssues} calendar item{biz.calendarIssues > 1 ? 's' : ''} couldn’t be read. Ask {agentName}: “Fix the calendar so every item has a date (YYYY-MM-DD) and a title.”</p>
      )}
      {step.kind === 'calendar' && has && (
        <>
          <div className="doc-bar"><span>Saved · {biz.calendar.length} items</span><History files={history} /></div>
          <Calendar items={biz.calendar} experiments={biz.experiments || []} projects={ctx.projects || []} refresh={refresh} />
        </>
      )}
      {doc && (
        <article className="doc">
          <div className="doc-bar">
            <span>Saved · updated {ago(doc.mtime)}</span>
            <span className="doc-bar-actions"><History files={history} /><CopyButton text={doc.content} label="Copy all" /></span>
          </div>
          <div className="prose"><Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown></div>
        </article>
      )}
      {step.id === 'strategy' && biz.experiments?.length > 0 && <Experiments experiments={biz.experiments} rows={biz.tracker || []} step={step} agent={agent} agentName={agentName} generate={generate} refresh={refresh} adInsights={biz.adInsights} />}
      {step.id === 'strategy' && SPRINT === SPRINTS.growth && biz.instagramInsights && <InstagramPanel insights={biz.instagramInsights} refresh={refresh} />}
      {!has && !mine && (
        <div className="placeholder">
          <p>Nothing here yet. Answer what you can above (blanks are fine) and {agentName} will write this step from your profile and everything you’ve made so far.</p>
        </div>
      )}
      {has && next && <div className="next"><button className="btn" onClick={() => go(next.id)}>Next: {next.title}</button></div>}
    </>
  );
}
