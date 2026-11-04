import { useState } from 'react';
import { post } from '../api.js';
import { ago } from './GenerateStep.jsx';

const ORDER = { fail: 0, warn: 1, pass: 2, skip: 3 };
const SITE_CHECKS = new Set(['site_reachable', 'canonical_host', 'robots_allows', 'sitemap', 'title_h1', 'schema_local', 'nap_phone', 'nap_address', 'llms_txt']);
const GBP_PROMPTS = {
  gbp_description: "Write my Google Business Profile description: 250–750 characters, plain words, what we do, where, and what we're known for — using only facts from my Business Brain and Google listing. Then tell me in two steps where to paste it at business.google.com. Don't rewrite visibility.md.",
  gbp_category: 'Which primary category and up to 3 additional categories should my Google Business Profile use? Give the exact Google category names and one line why each. Then tell me where to set them at business.google.com. Don\'t rewrite visibility.md.',
};
const GBP_LINK = new Set(['gbp_website', 'gbp_hours']);

export default function VisibilityPanel({ audit, docMtime, refresh, site, agent, agentName, send }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fixed, setFixed] = useState(false);
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/api/visibility/audit', {});
      await refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const fixSite = async ids => {
    const win = window.open('', '_blank'); // open before the await or popup blockers eat it
    try {
      const r = await post('/api/site/fix', { ids });
      setFixed(true);
      if (win) win.location = r.url; else window.open(r.url, '_blank');
    } catch (cause) {
      win?.close();
      setError(cause.message);
    }
  };
  const fixPrompt = c => `Studio's health check found: "${c.title}" — ${c.detail} ${c.fix}. My website is ${audit.siteUrl || 'not built by Studio'}. Write the exact fix I can paste or hand to whoever runs my website: the code snippet or file content if it's code, where it goes, and a two-sentence plain-English note explaining it. Don't rewrite visibility.md.`;
  const action = c => {
    if (c.status !== 'fail' && c.status !== 'warn') return null;
    if (SITE_CHECKS.has(c.id)) {
      if (site?.url) return <button className="btn ghost" onClick={() => fixSite([c.id])}>Fix it</button>;
      return <button className="btn ghost" disabled={agent?.busy} onClick={() => send(fixPrompt(c))}>Fix it</button>;
    }
    if (GBP_PROMPTS[c.id]) return <button className="btn ghost" disabled={agent?.busy} onClick={() => send(GBP_PROMPTS[c.id])}>Fix it</button>;
    if (GBP_LINK.has(c.id)) return <a className="btn ghost" href="https://business.google.com/" target="_blank" rel="noreferrer">Open in Google</a>;
    return null;
  };
  const Item = ({ check }) => (
    <li className="visibility-item">
      <span className={`dot status-${check.status}`} />
      <div>
        <strong>{check.title}</strong>
        <p className="hint">{check.detail}</p>
        {check.fix && <p className="hint">{check.fix}</p>}
      </div>
      {action(check) && <span className="visibility-act">{action(check)}</span>}
    </li>
  );
  if (!audit) return (
    <section className="visibility-panel" aria-label="Can people find you?">
      <header className="visibility-head">
        <div><h2>Can people find you?</h2></div>
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Checking…' : 'Run check'}</button>
      </header>
      <p className="hint">Connect Google Business Profile in Setup or add your website in the Business profile, then this check runs on its own.</p>
      {error && <p className="msg err" role="alert">{error}</p>}
    </section>
  );
  const checks = audit.checks || [];
  const problems = checks.filter(c => c.status === 'fail' || c.status === 'warn').sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const good = checks.filter(c => c.status === 'pass');
  const siteProblems = problems.filter(c => SITE_CHECKS.has(c.id));
  const stale = docMtime && Date.parse(audit.checkedAt) > docMtime;
  return (
    <section className="visibility-panel" aria-label="Can people find you?">
      <header className="visibility-head">
        <div>
          <h2>Can people find you?</h2>
          <p className="hint">{audit.total > 0
            ? `${audit.score} of ${audit.total} checks pass · checked ${ago(Date.parse(audit.checkedAt))}`
            : 'Nothing to check yet — add your website in the Business profile or connect Google Business Profile in Setup.'}</p>
        </div>
        <span className="visibility-actions">
          {site?.url && siteProblems.length >= 2 && <button className="btn" onClick={() => fixSite(siteProblems.map(c => c.id))}>Fix all</button>}
          <button className="btn" onClick={run} disabled={busy}>{busy ? 'Checking…' : 'Check again'}</button>
        </span>
      </header>
      {error && <p className="msg err" role="alert">{error}</p>}
      {fixed && <p className="hint">{agentName || 'Devin'} is fixing it in your website window. Come back and press Check again when it says it’s done.</p>}
      {stale && <p className="stale" role="status">This check ran after your plan was written. Rewrite to bring it in line.</p>}
      <ul className="visibility-list">
        {problems.map(c => <Item key={c.id} check={c} />)}
      </ul>
      {good.length > 0 && (
        <details className="visibility-good">
          <summary>{good.length} things look good</summary>
          <ul className="visibility-list">
            {good.map(c => <Item key={c.id} check={c} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
