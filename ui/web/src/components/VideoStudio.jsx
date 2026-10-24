import { useEffect, useRef, useState } from 'react';
import { api, post, toast, useAgent } from '../api.js';
import { SPRINT, VIDEO_FORMATS } from '../steps.js';
import { AGENT_NAMES, ChatGrip } from '../App.jsx';
import Chat from './Chat.jsx';
import { StepHead } from './GenerateStep.jsx';

const enc = encodeURIComponent;
const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export default function VideoStudio({ step, projects, ctx }) {
  const { refresh, next, go } = ctx;
  const [current, setCurrent] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  // Projects can arrive after mount, so fall back to the latest one with a video.
  const project = projects.find(p => p.name === current) || projects.find(p => p.raw.length) || projects[0];

  const create = async e => {
    e.preventDefault();
    try { await post('/api/projects', { name: slug(name) }); await refresh(); setCurrent(slug(name)); setName(''); setError(''); }
    catch (err) { setError(err.message); }
  };

  const picker = (
    <>
      <StepHead step={step} ctx={ctx} />
      <div className="video-projects">
          {projects.map(p => (
            <button key={p.name} className={'proj' + (p === project ? ' active' : '')} aria-pressed={p === project} onClick={() => setCurrent(p.name)}>
              <span>{p.name}</span>
              <small>{p.raw.length} video{p.raw.length === 1 ? '' : 's'}</small>
            </button>
          ))}
          <form className="proj-new" onSubmit={create}>
            <label htmlFor="new-video" className="sr">New video name</label>
            <input id="new-video" value={name} onChange={e => setName(e.target.value)} placeholder="Name a new video, e.g. gift-box-promo" />
            <button className="btn primary" disabled={!slug(name)}>New video</button>
          </form>
          {error && <p className="msg err" role="alert">{error}</p>}
      </div>
    </>
  );
  const nextBtn = projects.some(p => p.raw.length) && next && <div className="next"><button className="btn" onClick={() => go(next.id)}>Next: {next.title}</button></div>;

  return (
    <div className="video">
      {project ? <ProjectWorkspace key={project.name} project={project} refresh={refresh} top={picker} bottom={nextBtn} hosted={ctx.hosted} /> : (
        <main className="main">
          {picker}
          <div className="placeholder"><p>Name your first video above. Each video gets its own folder and chat.</p></div>
        </main>
      )}
    </div>
  );
}

// One video project: its own agent session for the script + the chat column.
function ProjectWorkspace({ project, refresh, top, bottom, hosted }) {
  const agent = useAgent(`/api/projects/${enc(project.name)}`, refresh);
  const agentName = AGENT_NAMES[project.agent] || 'Devin';
  const switchAgent = async a => { try { await post(`/api/projects/${enc(project.name)}/agent`, { agent: a }); await refresh(); agent.restart(); } catch (e) { toast(e.message); } };
  const started = agent.items.some(i => i.kind === 'user');
  const lastAgent = [...agent.items].reverse().find(i => i.kind === 'agent')?.text || '';
  return (
    <>
    <main className="main">
      {top}
      <Project project={project} refresh={refresh} agent={agent} agentName={agentName} lastAgent={lastAgent} />
      {bottom}
    </main>
    <aside className="side" aria-label={`Chat with ${agentName} about ${project.name}`}>
      <ChatGrip />
      <div className="side-head">
        <span>{agentName} · {project.name}</span>
        {!hosted && (
          <select aria-label="Assistant for this video" value={project.agent} onChange={e => switchAgent(e.target.value)} disabled={agent.busy}>
            <option value="devin">Devin</option>
            <option value="claude">Claude Code</option>
          </select>
        )}
      </div>
      <Chat
        agent={agent}
        agentName={agentName}
        placeholder={started ? `Reply to ${agentName}` : 'Or describe the video you want'}
        empty={<><strong>Write the script, then make it in HeyGen.</strong><p>{agentName} drafts a presenter script from your offer; you make the video in HeyGen and import it back here.</p></>}
      />
    </aside>
    </>
  );
}

function Project({ project, refresh, agent, agentName, lastAgent }) {
  const videos = project.raw.filter(f => /\.(mp4|mov|webm)$/i.test(f));
  const scriptPrompt = `Write a HeyGen presenter script for a ${SPRINT.adj}promo video for project "${project.name}", selling the offer in business/offer.md (if it exists; otherwise ask me what to promote). 60–90 words, spoken-word style, hook in the first sentence, end on the call-to-action. Give me the script in chat (don't write a file), then one line on which avatar look and aspect ratio to pick.`;
  return (
    <>
      <section className="panel">
        <h2>Make it in HeyGen</h2>
        <div className="actions">
          <button className="btn primary" onClick={() => agent.send(scriptPrompt)} disabled={agent.busy}>Write the script with {agentName}</button>
        </div>
        <HeyGen project={project} refresh={refresh} lastAgent={lastAgent} />
      </section>

      <section className="panel">
        <h2>Your videos</h2>
        {videos.length ? videos.map(f => {
          const src = `/projects/${enc(project.name)}/raw/${enc(f)}`;
          return (
            <figure key={f} className="render">
              <video controls preload="metadata" src={src} />
              <figcaption><span>{f}</span><a className="btn ghost" href={src} download={f}>Download</a></figcaption>
            </figure>
          );
        }) : <p className="hint">Videos you import from HeyGen show up here.</p>}
      </section>
    </>
  );
}

// HeyGen, from the user's own account: import finished videos, or make a new one from an avatar.
function HeyGen({ project, refresh, lastAgent }) {
  const [mode, setMode] = useState(null);
  const close = () => setMode(null);
  if (mode === 'import') return <HeyGenImport project={project} refresh={refresh} close={close} />;
  if (mode === 'make') return <HeyGenMake project={project} refresh={refresh} close={close} lastAgent={lastAgent} />;
  return (
    <div className="actions">
      <button className="btn ghost" onClick={() => setMode('import')}>Import from HeyGen</button>
      <button className="btn ghost" onClick={() => setMode('make')}>Make an avatar video</button>
    </div>
  );
}
const keyError = error => error && <p className="msg err" role="alert">{error} {/Setup/.test(error) && <a href="#setup">Open setup</a>}</p>;

function HeyGenImport({ project, refresh, close }) {
  const [list, setList] = useState(null);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState({});
  const [error, setError] = useState('');
  const imported = id => project.raw.includes(`heygen-${id}.mp4`);

  const load = async token => {
    setError('');
    try {
      const r = await api(`/api/heygen/videos${token ? `?token=${enc(token)}` : ''}`);
      setList(l => [...(token ? l : []), ...r.videos]);
      setNext(r.next_token);
    } catch (e) { setError(e.message); setList(l => l || []); }
  };
  useEffect(() => { load(); }, []);
  const pull = async id => {
    setBusy(b => ({ ...b, [id]: true })); setError('');
    try { await post(`/api/projects/${enc(project.name)}/heygen`, { id }); await refresh(); }
    catch (e) { setError(e.message); }
    setBusy(b => ({ ...b, [id]: false }));
  };

  return (
    <div className="heygen">
      <h3>Your HeyGen videos</h3>
      {keyError(error)}
      {!list && <p className="hint">Loading…</p>}
      {list && !list.length && !error && <p className="hint">No finished videos in your HeyGen account yet. Make one with “Make an avatar video”, or at app.heygen.com.</p>}
      <ul className="heygen-grid">
        {(list || []).map(v => (
          <li key={v.id}>
            <button className="heygen-card" onClick={() => pull(v.id)} disabled={busy[v.id] || imported(v.id)}>
              {v.thumbnail_url && <img src={v.thumbnail_url} alt="" loading="lazy" />}
              <span>{v.title || 'Untitled'}</span>
              <small>{busy[v.id] ? 'Importing…' : imported(v.id) ? 'Imported ✓' : v.duration ? `${Math.round(v.duration)}s · Import` : 'Import'}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="actions">
        {next && <button className="btn ghost" onClick={() => load(next)}>Load more</button>}
        <button className="btn ghost" onClick={close}>Close</button>
      </div>
    </div>
  );
}

const SHAPES = { vertical: '9:16', square: '1:1', wide: '16:9' };

// Pick one of the user's avatars, paste the script; HeyGen renders it and we import the MP4 into raw/.
// ponytail: the browser polls; if the tab closes, the video still finishes and shows under "Import from HeyGen".
function HeyGenMake({ project, refresh, close, lastAgent }) {
  const [avatars, setAvatars] = useState(null);
  const [pick, setPick] = useState('');
  // If Devin just wrote a script in chat, prefill it so the user doesn't have to copy/paste.
  const [script, setScript] = useState(() => lastAgent || '');
  const [shape, setShape] = useState('vertical');
  const [status, setStatus] = useState(''); // '', 'starting', 'rendering', 'importing'
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { api('/api/heygen/avatars').then(r => setAvatars(r.avatars)).catch(e => { setError(e.message); setAvatars([]); }); }, []);

  const generate = async e => {
    e.preventDefault();
    setError(''); setStatus('starting');
    try {
      const { video_id } = await post(`/api/projects/${enc(project.name)}/heygen/generate`, { avatar_id: pick, script, aspect_ratio: SHAPES[shape] });
      setStatus('rendering');
      for (;;) {
        await new Promise(r => setTimeout(r, 10000));
        if (!alive.current) return;
        const v = await api(`/api/heygen/videos/${enc(video_id)}`);
        if (v.status === 'failed') throw new Error(v.failure_message || 'HeyGen couldn’t make this video.');
        if (v.status === 'completed') break;
      }
      setStatus('importing');
      await post(`/api/projects/${enc(project.name)}/heygen`, { id: video_id });
      await refresh();
      if (alive.current) { setStatus(''); setScript(''); }
    } catch (err) { if (alive.current) { setError(err.message); setStatus(''); } }
  };

  const working = !!status;
  return (
    <form className="heygen" onSubmit={generate}>
      <h3>Make an avatar video</h3>
      {keyError(error)}
      {!avatars && <p className="hint">Loading your avatars…</p>}
      {avatars && !avatars.length && !error && <p className="hint">No avatars in your HeyGen account yet. Create one at app.heygen.com, then come back.</p>}
      <ul className="heygen-grid" role="radiogroup" aria-label="Avatar">
        {(avatars || []).map(a => (
          <li key={a.id}>
            <button type="button" role="radio" aria-checked={pick === a.id} className={'heygen-card' + (pick === a.id ? ' active' : '')} onClick={() => setPick(a.id)} disabled={working}>
              {a.preview_image_url && <img src={a.preview_image_url} alt="" loading="lazy" />}
              <span>{a.name || 'Avatar'}</span>
              <small>{a.avatar_type === 'digital_twin' ? 'Video twin' : a.avatar_type === 'photo_avatar' ? 'Photo' : 'Studio'}</small>
            </button>
          </li>
        ))}
      </ul>
      {avatars?.length > 0 && <div className="fields">
        <div className="field full">
          <label htmlFor="hg-script">What should they say?</label>
          <textarea id="hg-script" rows={4} maxLength={5000} value={script} onChange={e => setScript(e.target.value)} disabled={working}
            placeholder={SPRINT.introPh} />
        </div>
        <div className="field">
          <label htmlFor="hg-shape">Shape</label>
          <select id="hg-shape" value={shape} onChange={e => setShape(e.target.value)} disabled={working}>
            {Object.keys(SHAPES).map(k => <option key={k} value={k}>{VIDEO_FORMATS[k]}</option>)}
          </select>
        </div>
      </div>}
      <div className="actions">
        {avatars?.length > 0 && <button className="btn primary" disabled={!pick || !script.trim() || working}>
          {status === 'starting' ? 'Starting…' : status === 'rendering' ? 'HeyGen is making it…' : status === 'importing' ? 'Importing…' : 'Generate'}
        </button>}
        <button type="button" className="btn ghost" onClick={close}>{working ? 'Hide' : 'Close'}</button>
      </div>
      <p className="hint">{status === 'rendering' ? 'Usually 1–5 minutes. Keep this page open; it lands under Your videos when done.' : 'Uses HeyGen credits from your account. Uses the avatar’s own voice.'}</p>
    </form>
  );
}
