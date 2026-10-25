import { useEffect, useRef, useState } from 'react';
import { put } from '../api.js';
import { TRACKER_INSIGHTS } from '../steps.js';
import { StepHead } from './GenerateStep.jsx';
import Experiments from './Experiments.jsx';
import InstagramPanel from './InstagramPanel.jsx';

const STAGES = ['Lead', 'Contacted', 'Quoted', 'Won', 'Lost'];
const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Email', 'Google', 'Website', 'Referral', 'Walk-in', 'Other'];
const money = n => n.toLocaleString([], { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function Tracker({ step, ...ctx }) {
  const { biz, agent, agentName, generate, next, go, refresh } = ctx;
  const [rows, setRows] = useState(biz.tracker || []);
  const [saveState, setSaveState] = useState('');
  const timer = useRef();

  // Auto-save half a second after the last edit.
  const update = next => {
    setRows(next);
    clearTimeout(timer.current);
    setSaveState('Saving…');
    timer.current = setTimeout(() => put('/api/business/tracker.json', next)
      .then(() => { setSaveState('Saved'); refresh(); })
      .catch(e => setSaveState(`Couldn’t save: ${e.message}`)), 500);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const set = (i, k, v) => update(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => update([{ id: crypto.randomUUID(), name: '', contact: '', source: '', stage: 'Lead', value: '', date: today(), notes: '' }, ...rows]);
  const remove = i => update(rows.filter((_, j) => j !== i));

  const won = rows.filter(r => r.stage === 'Won');
  const closed = rows.filter(r => r.stage === 'Won' || r.stage === 'Lost').length;
  const open = rows.filter(r => !['Won', 'Lost'].includes(r.stage));
  const sum = list => list.reduce((t, r) => t + (Number(r.value) || 0), 0);
  const stats = [
    ['Leads', rows.length],
    ['Customers won', won.length],
    ['Win rate', closed ? `${Math.round((won.length / closed) * 100)}%` : '—'],
    ['Revenue', money(sum(won))],
    ['Open pipeline', money(sum(open))],
  ];

  return (
    <>
      <StepHead step={step} ctx={ctx} />
      {biz.experiments?.length > 0 && <Experiments experiments={biz.experiments} rows={rows} step={step} agent={agent} agentName={agentName} generate={generate} refresh={refresh} adInsights={biz.adInsights} />}
      {biz.instagramInsights && <InstagramPanel insights={biz.instagramInsights} refresh={refresh} />}
      <dl className="stats">
        {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="tracker-bar">
        <button className="btn primary" onClick={add}>Add a lead</button>
        <button className="btn" onClick={() => generate(step, TRACKER_INSIGHTS)} disabled={agent.busy || !rows.length}>Ask {agentName} what to do next</button>
        <span className="hint" aria-live="polite">{saveState}</span>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className={'tracker' + (biz.experiments?.length ? ' has-experiments' : '')}>
            <thead><tr><th>Name</th><th>Contact</th><th>Source</th>{biz.experiments?.length > 0 && <th>Experiment</th>}<th>Stage</th><th>Value ($)</th><th>Date</th><th>Notes</th><th><span className="sr">Remove</span></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i} className={'stage-' + r.stage.toLowerCase()}>
                  <td><input aria-label="Name" value={r.name} onChange={e => set(i, 'name', e.target.value)} placeholder="Name" /></td>
                  <td><input aria-label="Contact" value={r.contact} onChange={e => set(i, 'contact', e.target.value)} placeholder="Email or phone" /></td>
                  <td><select aria-label="Source" value={r.source} onChange={e => set(i, 'source', e.target.value)}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></td>
                  {biz.experiments?.length > 0 && <td><select aria-label="Experiment" value={r.experiment || ''} onChange={e => set(i, 'experiment', e.target.value || null)}><option value="">—</option>{biz.experiments.map(experiment => <option key={experiment.id} value={experiment.id}>{experiment.name}</option>)}</select></td>}
                  <td><select aria-label="Stage" value={r.stage} onChange={e => set(i, 'stage', e.target.value)}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td><input aria-label="Value" type="number" min="0" inputMode="decimal" value={r.value} onChange={e => set(i, 'value', e.target.value)} /></td>
                  <td><input aria-label="Date" type="date" value={r.date} onChange={e => set(i, 'date', e.target.value)} /></td>
                  <td><input aria-label="Notes" value={r.notes} onChange={e => set(i, 'notes', e.target.value)} placeholder="Next step…" /></td>
                  <td><button className="btn ghost icon" aria-label={`Remove ${r.name || 'this lead'}`} onClick={() => remove(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="placeholder"><p>Every DM, call, quote request and sale goes here. Add your first one — even a test — to see the totals move.</p></div>
      )}
      {rows.length > 0 && next && <div className="next"><button className="btn" onClick={() => go(next.id)}>Next: {next.title}</button></div>}
    </>
  );
}
