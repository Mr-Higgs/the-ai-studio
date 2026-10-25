import { useEffect, useRef, useState } from 'react';
import { post, put } from '../api.js';
import { SCORE_EXPERIMENTS } from '../steps.js';
import { experimentStats } from '../experiments.js';

const STATUSES = ['running', 'scale', 'keep', 'kill'];
const PLATFORM_NAMES = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger' };
const money = (value, currency = 'USD') => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString([], { style: 'currency', currency, maximumFractionDigits: 2 });

export default function Experiments({ experiments = [], rows = [], step, agent, agentName, generate, refresh, adInsights }) {
  const campaigns = adInsights?.campaigns || [];
  const currency = adInsights?.account?.currency || 'USD';
  const propKey = JSON.stringify(experiments);
  const [items, setItems] = useState(experiments);
  const [saveState, setSaveState] = useState('');
  const [metaState, setMetaState] = useState('');
  const [syncing, setSyncing] = useState(false);
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

  const update = (id, changes) => {
    const next = itemsRef.current.map(item => item.id === id ? { ...item, ...changes } : item);
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
  const refreshMeta = async () => {
    setSyncing(true);
    setMetaState('');
    try {
      await post('/api/ads/sync', {});
      await refresh();
    } catch (error) {
      setMetaState(error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (!items.length) return null;
  return (
    <section className="experiments" aria-label="Growth experiments">
      <div className="experiments-head">
        <div>
          <h2>Growth experiments</h2>
          <p className="hint">Track what each test costs and whether it is bringing in customers.</p>
          {campaigns.length > 0 && (
            <div className="meta-refresh">
              <button className="btn" onClick={refreshMeta} disabled={syncing}>{syncing ? 'Refreshing…' : 'Refresh Meta results'}</button>
              <span className="hint">Synced {adInsights.syncedAt ? new Date(adInsights.syncedAt).toLocaleString() : 'time unknown'}</span>
              {metaState && <p className="msg err" role="alert">{metaState}</p>}
            </div>
          )}
        </div>
        <button className="btn" onClick={() => generate(step, SCORE_EXPERIMENTS)} disabled={agent.busy}>
          Score my experiments with {agentName}
        </button>
      </div>
      {saveState && <p className="hint experiment-save" aria-live="polite">{saveState}</p>}
      <div className="experiment-grid">
        {items.map(experiment => {
          const stats = experimentStats(experiment, rows);
          const linkedCampaign = campaigns.find(campaign => String(campaign.id) === experiment.campaignId);
          const platformSummary = linkedCampaign
            ? Object.entries(linkedCampaign.platforms || {})
              .filter(([, values]) => Number(values.spend) > 0 || Number(values.leads) > 0)
              .map(([platform, values]) => `${PLATFORM_NAMES[platform] || platform} ${money(values.spend, currency)} · ${values.leads} leads`)
              .join(' · ')
            : '';
          return (
            <article className="experiment-card" key={experiment.id}>
              <div className="experiment-title">
                <h3>{experiment.name}</h3>
                <span className={`experiment-status status-${experiment.status}`}>{experiment.status}</span>
              </div>
              <p className="experiment-channel">{experiment.channel || 'Channel not set'}</p>
              {experiment.hypothesis && <p className="experiment-hypothesis">{experiment.hypothesis}</p>}
              <p className="experiment-cost">Planned test cost: {money(experiment.cost, currency)}</p>
              <dl className="experiment-stats">
                <div><dt>Leads</dt><dd>{stats.leads}</dd></div>
                <div><dt>{experiment.target != null ? 'Won / target' : 'Customers won'}</dt><dd>{stats.won}{experiment.target != null ? ` / ${experiment.target}` : ''}</dd></div>
                <div><dt>Revenue</dt><dd>{money(stats.revenue, currency)}</dd></div>
                <div><dt>Cost / customer</dt><dd>{money(stats.costPerCustomer, currency)}{experiment.maxCac != null ? ` / ${money(experiment.maxCac, currency)} max` : ' / — max'}</dd></div>
              </dl>
              {campaigns.length > 0 && (
                <label className="experiment-campaign">
                  Meta campaign
                  <select
                    value={experiment.campaignId || ''}
                    onChange={event => {
                      const campaignId = event.target.value;
                      const campaign = campaigns.find(item => String(item.id) === campaignId);
                      update(experiment.id, {
                        campaignId: campaignId || null,
                        ...(campaign ? { spent: campaign.spend } : {}),
                      });
                    }}
                  >
                    <option value="">Not linked</option>
                    {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                </label>
              )}
              {linkedCampaign && <p className="experiment-meta">Meta: {money(linkedCampaign.spend, currency)} · {linkedCampaign.leads} leads · {linkedCampaign.clicks} clicks</p>}
              {platformSummary && <small className="experiment-platforms">{platformSummary}</small>}
              <div className="experiment-controls">
                <label>
                  Actual spend ({adInsights?.account?.currency ? currency : '$'})
                  <input type="number" min="0" step="0.01" inputMode="decimal" readOnly={!!linkedCampaign} value={experiment.spent ?? ''} onChange={event => update(experiment.id, { spent: event.target.value === '' ? null : event.target.value })} />
                  {linkedCampaign && <small className="hint">from Meta</small>}
                </label>
                <label>
                  Status
                  <select value={experiment.status} onChange={event => update(experiment.id, { status: event.target.value })}>
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
