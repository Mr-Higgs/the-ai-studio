export default function Chat({ empty }) {
  return (
    <div className="chat">
      <div className="chat-log">
        <div className="chat-empty">{empty}</div>
      </div>
      <div className="composer chat-coming-soon">
        <span>AI writing is coming in the next update.</span>
      </div>
    </div>
  );
}
