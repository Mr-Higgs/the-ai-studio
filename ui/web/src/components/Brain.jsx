import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { put, toast } from '../api.js';
import { BRAIN_SECTIONS, BRAIN_STEP, ITEM_FIELDS, MAX_ITEMS, TAGS, answerOf, brainMath, brainReady, brainReviewPrompt, cleanBrain, helpPrompt, profileWithBrain, sectionProgress } from '../brain.js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BrainGraph = lazy(() => import('./BrainGraph.jsx')); // canvas + d3 only load on this page

const money = n => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const clean = b => { const c = cleanBrain(b); return { answers: c.answers, items: c.items.length ? c.items : [{}] }; };

function Tag({ id, value, onChange }) {
  return (
    <div className="tag-pick" role="radiogroup" aria-label="How sure are you?">
      {Object.entries(TAGS).map(([k, t]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={'tag-' + k} title={t.hint} onClick={() => onChange(value === k ? '' : k)} id={`${id}-${k}`}>{t.label}</button>
      ))}
    </div>
  );
}

function Field({ id, q, a, set, hint }) {
  const v = a.v ?? (q.type === 'checks' ? [] : '');
  let input;
  if (q.type === 'textarea') input = <textarea id={id} rows={2} value={v} placeholder={q.placeholder} onChange={e => set({ v: e.target.value })} />;
  else if (q.type === 'select') input = (
    <select id={id} value={v} onChange={e => set({ v: e.target.value })}>
      <option value="">Choose…</option>
      {q.options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
  else if (q.type === 'checks') input = (
    <div className="checks" id={id}>
      {q.options.map(o => (
        <label key={o} className="chip">
          <input type="checkbox" checked={v.includes(o)} onChange={e => set({ v: e.target.checked ? [...v, o] : v.filter(x => x !== o) })} />{o}
        </label>
      ))}
    </div>
  );
  else input = <input id={id} value={v} inputMode={q.num ? 'decimal' : undefined} placeholder={q.placeholder} onChange={e => set({ v: e.target.value })} />;
  return (
    <div className={'brain-q' + (q.type === 'textarea' ? ' wide' : '')}>
      <label htmlFor={id}>{q.label}{q.key && <span className="req" title="Needed to finish this section"> *</span>}</label>
      {hint && <small className="hint">{hint}</small>}
      {input}
      <Tag id={id} value={a.s || ''} onChange={s => set({ s })} />
    </div>
  );
}

// Whole-business view from the profile's time, monthly cost and customer answers. Also shown on the profile step.
export function BusinessNumbers({ m }) {
  const rows = [
    m.goalRate != null && ['Your pay goal, per hour', money(m.goalRate), `${money(m.payGoal)}/year at ${m.hoursWeek} h/week${m.rate != null && m.rate < m.goalRate ? ` — more than the ${money(m.rate)}/hour you price your time at` : ''}`, m.rate != null && m.rate < m.goalRate ? 'bad' : ''],
    m.monthCosts != null && ['Monthly break-even', money(m.monthCosts), 'sales that cover staff, materials and running costs', ''],
    m.monthForGoal != null && ['Monthly sales to also pay you', money(m.monthForGoal), 'break-even + your pay goal ÷ 12', ''],
    m.monthLeft != null && ['Left for you in a typical month', money(m.monthLeft), m.earnedRate != null ? `about ${money(m.earnedRate)}/hour for your hours` : 'add your weekly hours to see it per hour', m.monthLeft > 0 && !(m.goalRate != null && m.earnedRate < m.goalRate) ? 'ok' : 'bad'],
    m.ltv != null && ['Customer lifetime value', money(m.ltv), m.ltvCalculated ? 'average sale × purchases a year × years' : 'your figure', ''],
    m.ltvCac != null && ['Lifetime value ÷ cost to win a customer', `${m.ltvCac}×`, '3× or more is healthy', m.ltvCac >= 3 ? 'ok' : 'bad'],
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="num-card">
      <h3>Your business</h3>
      <dl>{rows.map(([t, v, note, cls]) => <div key={t} className="num-row"><dt>{t}</dt><dd className={cls}>{v}<small>{note}</small></dd></div>)}</dl>
      {m.goalRate != null && m.earnedRate != null && m.earnedRate < m.goalRate && <ul className="flags"><li className="bad">A typical month pays you {money(m.earnedRate)}/hour, below your {money(m.goalRate)}/hour goal.</li></ul>}
    </div>
  );
}

function Numbers({ m }) {
  return (
    <section className="brain-numbers" aria-label="Your numbers">
      <h2>Your numbers <small>calculated by the app from your answers — estimates, not a promise of profit or demand</small></h2>
      {m.items.map(it => (
        <div key={it.name} className="num-card">
          <h3>{it.name}{it.unit && <small> · per {it.unit}</small>}{it.estimated.length > 0 && <span className="chip tag-estimate">uses estimates</span>}</h3>
          <dl>
            <dt>Price</dt><dd>{money(it.price)}</dd>
            <dt>Cash left after purchases</dt><dd>{money(it.cashLeft)}<small>after materials, fees, extras and {money(it.losses)} losses</small></dd>
            <dt>Your pay for the work</dt><dd>{money(it.labor)}<small>{m.rate == null ? 'add your hourly rate' : `at ${money(m.rate)}/hour`}</small></dd>
            <dt>Earnings per sale</dt><dd className={it.earnings > 0 ? 'ok' : 'bad'}>{money(it.earnings)}<small>after paying yourself</small></dd>
            {it.discounted && <><dt>At your {m.discount}% max discount</dt><dd className={it.discounted.earnings > 0 ? 'ok' : 'bad'}>{money(it.discounted.earnings)}<small>price {money(it.discounted.price)}</small></dd></>}
            <dt>Sales to break even</dt><dd>{it.breakEven ?? '—'}<small>{m.fixed == null ? 'needs the campaign length to include your overhead' : m.fixed ? `covers ${money(m.fixed)} of campaign + overhead costs` : 'no fixed costs entered'}{it.hoursBreakEven != null && ` · ${it.hoursBreakEven} h of work`}</small></dd>
            {it.firstSale != null && <><dt>First sale to a new customer</dt><dd className={it.firstSale > 0 ? 'ok' : 'bad'}>{money(it.firstSale)}<small>after the {money(m.cac)} it costs to win them</small></dd></>}
            {m.profitTarget > 0 && <><dt>Sales for your {money(m.profitTarget)} profit goal</dt><dd>{it.forTarget ?? '—'}<small>{it.hoursTarget != null && `${it.hoursTarget} h of work`}{it.cashForTarget != null && ` · ${money(it.cashForTarget)} in purchases`}</small></dd></>}
          </dl>
          <ul className="flags">
            {it.notProfitable && <li className="bad">At this price you lose money on every sale once you’re paid for your time.</li>}
            {it.firstSaleLoses && <li className="bad">After the {money(m.cac)} it costs to win a new customer, their first sale loses money — this only pays off if they come back.</li>}
            {it.belowMin && <li className="bad">Below your {money(m.minEarn)} minimum earnings per sale.</li>}
            {it.fits === false && <li className="bad">Your goal needs {it.forTarget} sales but you have room for about {m.capacity} this campaign.</li>}
            {it.gaps.length > 0 && <li className="bad">Blank: {it.gaps.join(', ')}. They count as $0 here, so earnings are a best case and sales targets wait until they’re filled in.</li>}
            {it.fits === true && <li className="ok">Fits your free capacity ({m.capacity} over the campaign).</li>}
            {m.upfront != null && it.cashForTarget != null && it.cashForTarget > m.upfront && <li className="bad">Needs {money(it.cashForTarget)} in purchases; you can spend {money(m.upfront)} upfront — consider deposits.</li>}
          </ul>
        </div>
      ))}
      <div className="num-card">
        <h3>Campaign</h3>
        <dl>
          <dt>Free capacity</dt><dd>{m.free == null ? '—' : `${m.free}/week`}<small>{m.capacity != null && `${m.capacity} over ${m.weeks} weeks`}</small></dd>
          <dt>Overhead share</dt><dd>{money(m.overheadShare)}</dd>
          <dt>Campaign costs</dt><dd>{money(m.campaignSpend)}</dd>
        </dl>
      </div>
      <BusinessNumbers m={m} />
      {m.missing.length > 0 && <p className="stale">Missing, so these numbers are provisional: {m.missing.join('; ')}.</p>}
    </section>
  );
}

export default function Brain({ ctx }) {
  const { biz, agent, agentName, workingOn, generate, refresh, go, byId, isDone } = ctx;
  const serverBrain = clean(biz.brain);
  const serverProfile = profileWithBrain(biz.profile, biz.brain);
  const serverBrainJson = JSON.stringify(cleanBrain(biz.brain));
  const serverProfileJson = JSON.stringify(serverProfile);
  const [brain, setBrain] = useState(() => serverBrain);
  const [profile, setProfile] = useState(() => serverProfile);
  const [open, setOpen] = useState(() => new Set([BRAIN_SECTIONS.find(s => s.required && !sectionProgress(biz.brain, biz.profile, s).ready)?.id || 'basics']));
  const [saving, setSaving] = useState(false);
  const synced = useRef({ brain: serverBrainJson, profile: serverProfileJson });
  const dirtyBrain = JSON.stringify(cleanBrain(brain)) !== synced.current.brain;
  const dirtyProfile = JSON.stringify(profile) !== synced.current.profile;
  const dirty = dirtyBrain || dirtyProfile;
  const m = useMemo(() => brainMath(brain, profile), [brain, profile]);
  const ready = brainReady(brain, profile);
  const doc = biz.docs.brain;

  useEffect(() => {
    if (JSON.stringify(cleanBrain(brain)) === synced.current.brain) {
      setBrain(serverBrain);
      synced.current.brain = serverBrainJson;
    }
    if (JSON.stringify(profile) === synced.current.profile) {
      setProfile(serverProfile);
      synced.current.profile = serverProfileJson;
    }
  }, [serverBrainJson, serverProfileJson]);

  // Autosave shortly after edits and when leaving the page via the nav (hash changes don't fire beforeunload).
  const latest = useRef(null);
  latest.current = { brain, profile, dirtyBrain, dirtyProfile };
  const queue = useRef(Promise.resolve(true));
  const save = () => (queue.current = queue.current.then(async () => {
    const cur = latest.current;
    if (!cur.dirtyBrain && !cur.dirtyProfile) return true;
    setSaving(true);
    try {
      if (cur.dirtyProfile) await put('/api/business/profile.json', cur.profile);
      if (cur.dirtyBrain) await put('/api/business/brain.json', cleanBrain(cur.brain));
      synced.current = { brain: JSON.stringify(cleanBrain(cur.brain)), profile: JSON.stringify(cur.profile) };
      await refresh();
      return true;
    } catch (e) { toast(`Couldn’t save your Business Brain: ${e.message}`); return false; }
    finally { setSaving(false); }
  }));
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [brain, profile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { save(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setAnswer = (q, patch) => {
    if (q.profile && 'v' in patch) setProfile(p => ({ ...p, [q.profile]: patch.v }));
    const { v, ...rest } = patch;
    const keep = q.profile ? rest : patch;
    if (Object.keys(keep).length) setBrain(b => ({ ...b, answers: { ...b.answers, [q.id]: { ...b.answers[q.id], ...keep } } }));
  };
  const setItem = (i, f, patch) => setBrain(b => ({ ...b, items: b.items.map((it, j) => (j === i ? { ...it, [f]: { ...it[f], ...patch } } : it)) }));
  const review = async () => { if (dirty && !(await save())) return; generate(BRAIN_STEP, brainReviewPrompt(brain, profile), doc ? BRAIN_STEP.file : undefined); };
  const helpIds = BRAIN_SECTIONS.flatMap(s => s.questions).filter(q => answerOf(brain, profile, q).s === 'help').map(q => q.id);
  const workOut = async () => {
    if (dirty && !(await save())) return;
    generate(BRAIN_STEP, helpPrompt(profile, brain, helpIds));
  };
  const toggle = (id, on) => setOpen(s => { const n = new Set(s); (on ?? !n.has(id)) ? n.add(id) : n.delete(id); return n; });
  const reveal = (id, q) => {
    toggle(id, true);
    requestAnimationFrame(() => document.getElementById(q ? `bq-${q}` : `brain-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const mix = brain.answers.mix?.v;

  return (
    <>
      <header className="step-head">
        <h1>{BRAIN_STEP.title}</h1>
        <p>{BRAIN_STEP.blurb}</p>
        <p className="hint">Tag each answer <strong>Known</strong>, <strong>Estimate</strong> or <strong>Help me work this out</strong> — Devin treats estimates as estimates and never invents reviews or numbers. Start with the sections marked required. Changes save as you go.</p>
      </header>

      <Suspense fallback={<div className="brain-graph placeholder">Loading the map…</div>}>
        <BrainGraph brain={brain} profile={profile} name={profile.name} byId={byId} isDone={isDone} onSection={reveal} onStep={id => go(id)} />
      </Suspense>

      <div className="brain-sections">
        {BRAIN_SECTIONS.map(s => {
          const p = sectionProgress(brain, profile, s);
          return (
            <details key={s.id} id={`brain-${s.id}`} className={'brain-section' + (p.ready ? ' ready' : '')} open={open.has(s.id)} onToggle={e => toggle(s.id, e.currentTarget.open)}>
              <summary>
                <span className="brain-title">{s.title}</span>
                {s.required && !p.ready && <span className="chip">required</span>}
                <small>{p.ready ? '✓ ' : ''}{p.answered}/{p.total} answered</small>
              </summary>
              {s.blurb && <p className="hint">{s.blurb}</p>}
              {s.items && brain.items.map((it, i) => {
                const kind = it.kind?.v || (mix === 'Services' ? 'Service' : 'Product');
                return (
                  <fieldset key={i} className="brain-item">
                    <legend>{it.name?.v || `Product or service ${i + 1}`}</legend>
                    <div className="brain-grid">
                      {ITEM_FIELDS.map(f => <Field key={f.id} id={`bi-${i}-${f.id}`} q={f} a={it[f.id] || {}} hint={f.hint?.[kind]} set={patch => setItem(i, f.id, patch)} />)}
                    </div>
                    {brain.items.length > 1 && <button type="button" className="btn ghost" onClick={() => setBrain(b => ({ ...b, items: b.items.filter((_, j) => j !== i) }))}>Remove</button>}
                  </fieldset>
                );
              })}
              {s.items && brain.items.length < MAX_ITEMS && <button type="button" className="btn" onClick={() => setBrain(b => ({ ...b, items: [...b.items, {}] }))}>+ Add a second product or service</button>}
              <div className="brain-grid">
                {s.questions.map(q => <Field key={q.id} id={`bq-${q.id}`} q={q} a={answerOf(brain, profile, q)} set={patch => setAnswer(q, patch)} />)}
              </div>
            </details>
          );
        })}
      </div>

      <Numbers m={m} />

      <div className="actions sticky">
        <button className="btn" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</button>
        {helpIds.length > 0 && <button className="btn" disabled={agent.busy || saving} onClick={workOut}>Work out {helpIds.length} ‘Help me’ answers with {agentName}</button>}
        <button className="btn primary" disabled={agent.busy || saving} onClick={review} title={ready ? '' : 'Works best once the required sections are done'}>
          {workingOn === BRAIN_STEP.title ? 'Devin is reviewing…' : doc ? 'Review it again' : 'Review my Business Brain'}
        </button>
        {!ready && <span className="hint">Finish Basics, Prices and costs, Capacity and Campaign goals for the best review.</span>}
      </div>

      {doc && <section className="brain-review"><h2>Devin’s review</h2><div className="prose"><Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown></div></section>}
    </>
  );
}
