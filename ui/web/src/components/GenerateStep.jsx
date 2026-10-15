import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Calendar from './Calendar.jsx';
import LinkedInAutopilot from './LinkedInAutopilot.jsx';

export function StepHead({ step, ctx, children }) {
  return (
    <header className="step-head">
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

export function Fields({ fields, values, onChange }) {
  const set = (id, v) => onChange({ ...values, [id]: v });
  return fields.map(f => {
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
          ) : <input id={id} type={f.type || 'text'} value={v || ''} placeholder={f.placeholder} onChange={e => set(f.id, e.target.value)} />}
      </div>
    );
  });
}

const ago = ms => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const stampOf = f => { const m = /-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(f); return m ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5])).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : f; };

export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function History({ files }) {
  if (!files?.length) return null;
  return (
    <details className="history">
      <summary>Previous versions ({files.length})</summary>
      <ul>{files.map(f => <li key={f}><a href={`/business/history/${f}`} target="_blank" rel="noreferrer">{stampOf(f)}</a></li>)}</ul>
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

  const run = () => {
    saveInputs(step.id, inputs);
    generate(step, step.prompt(inputs, step), has ? step.file : undefined); // keep the old version before a rewrite
  };

  const form = (
    <div className="inputs">
      <div className="fields"><Fields fields={step.inputs} values={inputs} onChange={setInputs} /></div>
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
        <p className="stale" role="status">{biz.calendarIssues} calendar item{biz.calendarIssues > 1 ? 's' : ''} couldn’t be read. Ask {agentName}: “Fix business/calendar.json so every item has a date (YYYY-MM-DD) and a title.”</p>
      )}
      {step.kind === 'calendar' && has && (
        <>
          <div className="doc-bar"><span>Saved to <code>business/calendar.json</code></span><History files={history} /></div>
          <Calendar items={biz.calendar} refresh={refresh} />
        </>
      )}
      {doc && (
        <article className="doc">
          <div className="doc-bar">
            <span>Saved to <code>business/{step.file}</code> · updated {ago(doc.mtime)}</span>
            <span className="doc-bar-actions"><History files={history} /><CopyButton text={doc.content} label="Copy all" /></span>
          </div>
          <div className="prose"><Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown></div>
        </article>
      )}
      {step.id === 'automation' && <LinkedInAutopilot step={step} ctx={ctx} />}
      {!has && !mine && (
        <div className="placeholder">
          <p>Nothing here yet. Answer what you can above (blanks are fine) and {agentName} will write this step from your profile and everything you’ve made so far.</p>
        </div>
      )}
      {has && next && <div className="next"><button className="btn" onClick={() => go(next.id)}>Next: {next.title}</button></div>}
    </>
  );
}
