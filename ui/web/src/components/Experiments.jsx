import { useEffect, useRef, useState } from 'react';
import { put } from '../api.js';
import { SCORE_EXPERIMENTS } from '../steps.js';
import { experimentStats } from '../experiments.js';

const STATUSES = ['running', 'scale', 'keep', 'kill'];
const money = value => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString([], { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function Experiments({ experiments = [], rows = [], step, agent, agentName, generate, refresh }) {
  const propKey = JSON.stringify(experiments);
  const [items, setItems] = useState(experiments);
  const [saveState, setSaveState] = useState('');
  const timer = useRef();
  const itemsRef = useRef(items);
  const dirty = useRef(false);
  const awaitingRefresh = useRef(null);
  const propKeyRef = useRef(propKey);

  useEffect(() => {
    propKeyRef.current = propKey;
    if (dirty.current) return;
    if (awaitingRefresh.current === propKey) return;
    awaitingRefresh.current = null;
    itemsRef.current = experiments;
    setItems(experiments);
  }, [propKey]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (id, field, value) => {
    const next = itemsRef.current.map(item => item.id === id ? { ...item, [field]: value } : item);
    itemsRef.current = next;
    setItems(next);
    dirty.current = true;
    setSaveState('Saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await put('/api/business/experiments.json', next);
        awaitingRefresh.current = propKeyRef.current;
        dirty.current = false;
        setSaveState('Saved');
        refresh?.();
      } catch (error) {
        setSaveState(`Couldn’t save: ${error.message}`);
      }
    }, 500);
  };

  if (!items.length) return null;
  return (
    <section className="experiments" aria-label="Growth experiments">
      <div className="experiments-head">
        <div>
          <h2>Growth experiments</h2>
          <p className="hint">Track what each test costs and whether it is bringing in customers.</p>
        </div>
        <button className="btn" onClick={() => generate(step, SCORE_EXPERIMENTS)} disabled={agent.busy}>
          Score my experiments with {agentName}
        </button>
      </div>
      {saveState && <p className="hint experiment-save" aria-live="polite">{saveState}</p>}
      <div className="experiment-grid">
        {items.map(experiment => {
          const stats = experimentStats(experiment, rows);
          return (
            <article className="experiment-card" key={experiment.id}>
              <div className="experiment-title">
                <h3>{experiment.name}</h3>
                <span className={`experiment-status status-${experiment.status}`}>{experiment.status}</span>
              </div>
              <p className="experiment-channel">{experiment.channel || 'Channel not set'}</p>
              {experiment.hypothesis && <p className="experiment-hypothesis">{experiment.hypothesis}</p>}
              <p className="experiment-cost">Planned test cost: {money(experiment.cost)}</p>
              <dl className="experiment-stats">
                <div><dt>Leads</dt><dd>{stats.leads}</dd></div>
                <div><dt>{experiment.target != null ? 'Won / target' : 'Customers won'}</dt><dd>{stats.won}{experiment.target != null ? ` / ${experiment.target}` : ''}</dd></div>
                <div><dt>Revenue</dt><dd>{money(stats.revenue)}</dd></div>
                <div><dt>Cost / customer</dt><dd>{money(stats.costPerCustomer)}{experiment.maxCac != null ? ` / ${money(experiment.maxCac)} max` : ' / — max'}</dd></div>
              </dl>
              <div className="experiment-controls">
                <label>
                  Actual spend ($)
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={experiment.spent ?? ''} onChange={event => update(experiment.id, 'spent', event.target.value === '' ? null : event.target.value)} />
                </label>
                <label>
                  Status
                  <select value={experiment.status} onChange={event => update(experiment.id, 'status', event.target.value)}>
                    {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <p className="experiment-verdict">{experiment.verdict || 'No verdict yet.'}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
