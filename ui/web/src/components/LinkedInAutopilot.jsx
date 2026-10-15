import { useEffect, useState } from 'react';
import { put } from '../api.js';

const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD, local
const fmt = d => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); };

// Automate it → LinkedIn: tick the calendar's LinkedIn posts you approve; the server posts them on time (ui/server.mjs autopilotTick).
export default function LinkedInAutopilot({ step, ctx }) {
  const { biz, agent, agentName, generate, refresh, linkedinReady } = ctx;
  const [list, setList] = useState(biz.calendar || []);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => setList(biz.calendar || []), [biz.calendar]);

  const rows = list.map((item, i) => ({ item, i })).filter(r => /linkedin/i.test(r.item.channel));
  const save = async (i, fields) => {
    const next = list.map((x, j) => (j === i ? { ...x, ...fields } : x));
    setList(next);
    try { await put('/api/business/calendar.json', next); setError(''); refresh(); }
    catch (e) { setError(`Couldn’t save: ${e.message}`); setList(list); }
  };
  const due = rows.filter(({ item }) => item.autopost && item.status !== 'posted' && item.date <= today()).length;
  const postNow = () => generate(step, `Post my approved LinkedIn items now using the linkedin MCP.

In business/calendar.json, take every item whose channel is LinkedIn, autopost is true, status is not "posted", and date is ${today()} or earlier. For each one, show me the exact text (copy, then a blank line, then cta) and wait for my OK before calling linkedin_post. After each successful post, set that item's status to "posted", url to the returned link and postedAt to the current ISO time in business/calendar.json, keeping every other item and field unchanged. If linkedin_post fails, tell me the error and stop. End with a one-line summary.`);

  return (
    <section className="autopilot" aria-label="LinkedIn autopilot">
      <h2>LinkedIn autopilot</h2>
      {linkedinReady
        ? <p className="hint ok">Connected. Ticked posts go out on their date and time while Studio is open. Over a day late, they wait for you.</p>
        : <p className="stale">LinkedIn isn’t connected yet. Add your LinkedIn access token in <a href="#setup">Setup</a>, then restart Studio.</p>}
      {error && <p className="msg err" role="alert">{error}</p>}
      {!rows.length ? (
        <p className="hint">No LinkedIn posts on your calendar yet. Tick LinkedIn in <a href="#content">Content</a>, then rebuild your <a href="#calendar">Campaign calendar</a>.</p>
      ) : (
        <>
          <ul>
            {rows.map(({ item, i }) => (
              <li key={i} className={'ap-row' + (item.status === 'posted' ? ' posted' : '')}>
                <label className="cal-check" title="Approve: post this automatically">
                  <input type="checkbox" checked={!!item.autopost} disabled={item.status === 'posted'} onChange={e => save(i, { autopost: e.target.checked, autopostError: undefined })} />
                  <span className="sr">Auto-post</span>
                </label>
                <span className="cal-date">{fmt(item.date)}</span>
                <input type="time" aria-label="Post time" value={item.time || '09:00'} disabled={item.status === 'posted'} onChange={e => save(i, { time: e.target.value })} />
                <button className="cal-main" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="cal-title">{item.title}</span>
                </button>
                <span className="ap-status">
                  {item.status === 'posted' ? (item.url ? <a href={item.url} target="_blank" rel="noreferrer">Posted ↗</a> : 'Posted')
                    : item.autopostError ? <span className="err" title={item.autopostError}>Failed</span>
                    : item.autopost ? 'Approved' : ''}
                </span>
                {open === i && (
                  <div className="cal-body">
                    <p>{item.copy}</p>
                    {item.cta && <p className="cal-cta">Call to action: {item.cta}</p>}
                    {item.autopostError && <p className="err">{item.autopostError}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button className="btn" onClick={postNow} disabled={agent.busy || !due}>Post today’s approved items with {agentName}</button>
            {!due && <span className="hint">Nothing approved is due yet.</span>}
          </div>
        </>
      )}
    </section>
  );
}
