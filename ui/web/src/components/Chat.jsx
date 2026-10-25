import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ask } from '../api.js';

const STATUS = { pending: '○', in_progress: '◐', completed: '✓', failed: '✕' };
// Machine-wide grants and bypass mode don't belong behind a one-click button.

export default function Chat({ agent, agentName, placeholder = 'Reply to ' + agentName, empty }) {
  const [text, setText] = useState('');
  const scroller = useRef(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [agent.items]);

  const submit = e => {
    e.preventDefault();
    if (!text.trim() || agent.busy) return;
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
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label={`Message ${agentName}`}
          onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
        />
        <button className="btn primary" disabled={!text.trim() || agent.busy}>Send</button>
      </form>
    </div>
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
