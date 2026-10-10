import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';

const STATUS = { pending: '○', in_progress: '◐', completed: '✓', failed: '✕' };
// Machine-wide grants and bypass mode don't belong behind a one-click button.
const HIDDEN_OPTIONS = ['allow_always_global', 'switch_bypass'];

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
        {agent.busy
          ? <button type="button" className="btn" onClick={agent.cancel}>Stop</button>
          : <button className="btn primary" disabled={!text.trim()}>Send</button>}
      </form>
    </div>
  );
}

function Item({ item, agent, agentName, items }) {
  switch (item.kind) {
    case 'user': return <div className="msg user">{item.text}</div>;
    case 'agent': return <div className="msg agent"><Markdown>{item.text}</Markdown></div>;
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
    case 'perm': {
      const tc = item.toolCall;
      const known = items.find(x => x.kind === 'tool' && x.id === tc.toolCallId);
      const cmd = tc.rawInput?.command || tc._meta?.['cognition.ai/editableCommand']; // Devin puts the command in _meta
      return (
        <div className="perm" role="group" aria-label="Permission request">
          <p>{cmd ? `${agentName} needs your OK to run this:` : `${agentName} needs your OK: ${tc.title || known?.title || 'use a tool'}`}</p>
          {cmd && <pre>{cmd}</pre>}
          <div className="perm-btns">
            {item.options.filter(o => !HIDDEN_OPTIONS.includes(o.optionId)).map(o => (
              <button key={o.optionId} className={'btn' + (o.kind === 'allow_once' ? ' primary' : '')} onClick={() => agent.answer(item.id, o.optionId)}>{o.name}</button>
            ))}
          </div>
        </div>
      );
    }
  }
  return null;
}
