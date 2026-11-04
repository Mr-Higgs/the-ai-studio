import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ask, post, toast } from '../api.js';
import { canDictate, useDictation } from '../dictation.js';
import { MAX_UPLOADS, UPLOAD_ACCEPT, UPLOAD_KINDS } from '../uploads.js';

const STATUS = { pending: '○', in_progress: '◐', completed: '✓', failed: '✕' };
// Machine-wide grants and bypass mode don't belong behind a one-click button.

export default function Chat({ agent, agentName, placeholder = 'Reply to ' + agentName, empty, uploads, onUploadsChange }) {
  const [text, setText] = useState('');
  const scroller = useRef(null);
  const pinned = useRef(true);
  const dict = useDictation(setText);
  const ta = useRef(null);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [agent.items]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [text]);

  const submit = e => {
    e.preventDefault();
    if (!text.trim() || agent.busy) return;
    dict.stop(true);
    agent.send(text.trim());
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-bar">
        <button type="button" className="btn" disabled={agent.busy || !agent.items.length}
          onClick={async () => { if (await ask('Start a new conversation? Devin keeps your documents but forgets this chat.', 'Start new')) agent.restart(); }}>New conversation</button>
      </div>
      <div
        className="chat-log"
        ref={scroller}
        aria-live="polite"
        onScroll={e => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
      >
        {agent.items.length === 0 && <div className="chat-empty">{empty}</div>}
        {agent.items.map((item, i) => <Item key={item.id || i} item={item} agent={agent} agentName={agentName} items={agent.items} />)}
        {agent.busy && <div className="typing" aria-label={`${agentName} is working`}><span /><span /><span /></div>}
        {agent.dead && <button className="btn" onClick={agent.restart}>Restart {agentName}</button>}
      </div>
      {uploads && <Files uploads={uploads} agentName={agentName} onChange={onUploadsChange} />}
      <form className="composer" onSubmit={submit}>
        {uploads && <AttachButton uploads={uploads} agentName={agentName} onChange={onUploadsChange} />}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder={dict.listening ? 'Listening… speak, then press Send' : placeholder}
          aria-label={`Message ${agentName}`}
          onChange={e => { dict.stop(true); setText(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
        />
        {canDictate && (
          <button type="button" className={'btn mic' + (dict.listening ? ' on' : '')} aria-pressed={dict.listening}
            aria-label={dict.listening ? 'Stop dictating' : 'Dictate instead of typing'}
            title={dict.listening ? 'Stop dictating' : 'Dictate instead of typing (tap again if it stops)'}
            onClick={() => (dict.listening ? dict.stop() : dict.start(text.trim() ? text.trimEnd() + ' ' : ''))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        )}
        <button className="btn primary" disabled={!text.trim() || agent.busy}>Send</button>
      </form>
    </div>
  );
}

const sizeLabel = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function AttachButton({ uploads, agentName, onChange }) {
  const [working, setWorking] = useState('');
  const input = useRef(null);
  const pick = async e => {
    const files = [...e.target.files];
    e.target.value = '';
    let room = MAX_UPLOADS - uploads.length, added = 0;
    for (const file of files) {
      if (room <= 0) { toast(`You can keep up to ${MAX_UPLOADS} files. Remove one first.`); break; }
      setWorking(file.name);
      try {
        const { extractUpload } = await import('../extract.js');
        await post('/api/uploads', await extractUpload(file));
        room--; added++;
      } catch (err) { toast(err.message); }
    }
    setWorking('');
    if (added) {
      toast(`${added === 1 ? 'File' : `${added} files`} attached — ${agentName} reads ${added === 1 ? 'it' : 'them'} with your next message.`, 'ok');
      onChange?.();
    }
  };
  return (
    <>
      <input ref={input} type="file" accept={UPLOAD_ACCEPT} multiple hidden onChange={pick} />
      <button type="button" className={'btn attach' + (working ? ' on' : '')} disabled={!!working}
        aria-label={working ? `Reading ${working}` : `Attach a file for ${agentName} (PDF, Markdown, CSV or Excel)`}
        title={working ? `Reading ${working}…` : 'Attach a PDF, Markdown, CSV or Excel file'}
        onClick={() => input.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6" /></svg>
      </button>
    </>
  );
}

function Files({ uploads, agentName, onChange }) {
  if (!uploads.length) return null;
  const remove = async u => {
    if (!await ask(`Remove ${u.name}? ${agentName} stops using it from your next message.`, 'Remove')) return;
    try { await api(`/api/uploads/${u.id}`, { method: 'DELETE' }); onChange?.(); } catch (e) { toast(`Couldn’t remove ${u.name}: ${e.message}`); }
  };
  return (
    <ul className="chat-files" aria-label={`Files ${agentName} can read`}>
      {uploads.map(u => (
        <li key={u.id} className="file-chip" title={`${UPLOAD_KINDS[u.kind] || u.kind} · ${sizeLabel(u.size)}${u.truncated ? ` · ${agentName} reads the first 40,000 characters` : ''}`}>
          <span className="file-name">{u.name}</span>
          {u.truncated && <span className="file-note">partial</span>}
          <button type="button" aria-label={`Remove ${u.name}`} onClick={() => remove(u)}>×</button>
        </li>
      ))}
    </ul>
  );
}

function Item({ item, agent, agentName, items }) {
  switch (item.kind) {
    case 'user': return <div className="msg user">{item.text}</div>;
    case 'agent': return <div className="msg agent"><Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown></div>;
    case 'sys': return <div className="msg sys">{item.text}</div>;
    case 'err': return <div className="msg err" role="alert">{item.text}</div>;
    case 'tool': return (
      <details className="tool">
        <summary><span className={'st ' + item.status}>{STATUS[item.status] || '·'}</span>{item.title}</summary>
        {item.output && <pre>{item.output}</pre>}
      </details>
    );
    case 'plan': return (
      <ol className="plan">{item.entries.map((e, i) => <li key={i} className={e.status}>{e.content}</li>)}</ol>
    );
  }
  return null;
}
