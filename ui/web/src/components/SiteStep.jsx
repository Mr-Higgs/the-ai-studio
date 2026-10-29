import { useState } from 'react';
import { post, toast } from '../api.js';
import { StepHead } from './GenerateStep.jsx';

const stamp = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "Your website" is not a chat step: one button opens a plain Devin session in a
// new tab, and the whole conversation happens over there — no sidebar here.
export default function SiteStep({ step, ctx }) {
  const [busy, setBusy] = useState(false);
  const site = ctx.biz.site;
  const offerDone = ctx.isDone('offer');

  const start = async body => {
    if (busy) return;
    setBusy(true);
    const win = window.open('', '_blank'); // open first, before the await, or popup blockers eat it
    try {
      const r = await post('/api/site/start', body);
      if (win) win.location = r.url; else window.open(r.url, '_blank');
      ctx.refresh();
    } catch (e) {
      win?.close();
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main wide">
      <StepHead step={step} ctx={ctx} />
      {site?.url ? (
        <section className="panel">
          <h2>Devin is building your website</h2>
          <p>It’s happening in its own window. Open it to see progress, ask for changes, or send photos.</p>
          {site.startedAt && <p className="hint">Started {stamp(site.startedAt)}</p>}
          <div className="actions">
            <a className="btn primary" href={site.url} target="_blank" rel="noopener">Open my website session</a>
            <button className="btn ghost" disabled={busy} onClick={() => {
              if (window.confirm('Start a brand-new design? Your current session stays in Devin, but Studio will point to the new one.')) start({ fresh: true });
            }}>{busy ? 'Opening Devin…' : 'Start over with a fresh design'}</button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p>Devin reads your whole sprint, designs a one-page website that’s yours alone, and puts it online. It opens in a new tab and Devin will message you there within a minute. There’s nothing technical for you to do.</p>
          <div className="actions">
            <button className="btn primary" disabled={busy || !offerDone} onClick={() => start({})}>
              {busy ? 'Opening Devin…' : 'Build my website'}
            </button>
            {!offerDone && <span className="hint">Finish your <a href="#offer">Offer</a> first — the website is built around it.</span>}
          </div>
        </section>
      )}
    </main>
  );
}
