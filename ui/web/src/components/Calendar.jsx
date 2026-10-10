import { useEffect, useState } from 'react';
import { put } from '../api.js';
import { CopyButton } from './GenerateStep.jsx';

const parse = d => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
const monday = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmt = (d, o) => d.toLocaleDateString([], o);

export default function Calendar({ items, refresh }) {
  const [list, setList] = useState(items);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => setList(items), [items]); // Devin rewrote the file

  const toggle = async i => {
    const next = list.map((x, j) => (j === i ? { ...x, status: x.status === 'posted' ? 'planned' : 'posted' } : x));
    setList(next);
    try { await put('/api/business/calendar.json', next); setError(''); refresh(); }
    catch (e) { setError(`Couldn’t save: ${e.message}`); setList(list); }
  };

  const weeks = [];
  list.forEach((item, i) => {
    const d = parse(item.date), key = monday(d).toDateString();
    let w = weeks.find(x => x.key === key);
    if (!w) weeks.push(w = { key, start: monday(d), rows: [] });
    w.rows.push({ item, i, d });
  });
  const posted = list.filter(x => x.status === 'posted').length;

  return (
    <section className="calendar" aria-label="Campaign calendar">
      <div className="cal-summary">
        <strong>{list.length} pieces</strong> from {fmt(parse(list[0].date), { month: 'short', day: 'numeric' })} to {fmt(parse(list.at(-1).date), { month: 'short', day: 'numeric' })}
        <span>{posted} posted</span>
      </div>
      {error && <p className="msg err" role="alert">{error}</p>}
      {weeks.map(w => (
        <div key={w.key} className="week">
          <h2>Week of {fmt(w.start, { month: 'long', day: 'numeric' })}</h2>
          <ul>
            {w.rows.map(({ item, i, d }) => (
              <li key={i} className={'cal-row' + (item.status === 'posted' ? ' posted' : '')}>
                <label className="cal-check" title="Mark as posted">
                  <input type="checkbox" checked={item.status === 'posted'} onChange={() => toggle(i)} />
                  <span className="sr">Posted</span>
                </label>
                <button className="cal-main" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="cal-date">{fmt(d, { weekday: 'short', day: 'numeric' })}</span>
                  <span className="cal-chan">{item.channel}<em>{item.format}</em></span>
                  <span className="cal-title">{item.title}</span>
                </button>
                {open === i && (
                  <div className="cal-body">
                    <p>{item.copy}</p>
                    {item.cta && <p className="cal-cta">Call to action: {item.cta}</p>}
                    <CopyButton text={item.copy + (item.cta ? `\n\n${item.cta}` : '')} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
