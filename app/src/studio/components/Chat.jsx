import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Chat({ agent, empty }) {
  const [draft, setDraft] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agent.items]);

  const submit = event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || agent.busy) return;
    setDraft('');
    agent.send(text);
  };

  return (
    <div className="chat">
      <div className="chat-bar">
        <select
          aria-label="Past conversations"
          value={agent.conversation || ''}
          onChange={event => event.target.value ? agent.openConversation(event.target.value) : agent.newConversation()}
        >
          <option value="">New conversation</option>
          {agent.conversations.map(item => (
            <option key={item.id} value={item.id}>{item.title || 'Devin conversation'}</option>
          ))}
        </select>
        <button className="btn ghost" type="button" onClick={agent.newConversation}>New</button>
      </div>
      <div className="chat-actions">
        {agent.url
          ? <a href={agent.url} target="_blank" rel="noreferrer">Open in Devin ↗</a>
          : <span className="hint">{agent.status || 'Ready'}</span>}
        {agent.active && <button className="btn ghost" type="button" onClick={agent.cancel} disabled={agent.busy}>Stop</button>}
      </div>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {agent.items.length
          ? agent.items.map((item, index) => (
            <div key={`${item.created_at}-${index}`} className={`msg ${item.role === 'user' ? 'user' : 'agent'}`}>
              {item.role === 'user'
                ? item.text
                : <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>}
            </div>
          ))
          : <div className="chat-empty">{empty}</div>}
        {agent.active && <div className="typing" aria-label="Devin is working"><span /><span /><span /></div>}
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          aria-label="Message Devin"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Message Devin…"
          disabled={agent.busy}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={!draft.trim() || agent.busy}>
          {agent.busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
