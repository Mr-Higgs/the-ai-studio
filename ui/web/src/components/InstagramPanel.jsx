import { useState } from 'react';
import { post } from '../api.js';

const number = value => value == null ? '—' : Number(value).toLocaleString();
const date = value => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString() : 'Date unavailable';
};

export default function InstagramPanel({ insights, refresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!insights) return null;
  const posts = [...(insights.posts || [])]
    .sort((a, b) => (b.interactions == null ? -1 : Number(b.interactions)) - (a.interactions == null ? -1 : Number(a.interactions)))
    .slice(0, 3);
  const stats = [
    ['Reach', insights.last28?.reach],
    ['Views', insights.last28?.views],
    ['Accounts engaged', insights.last28?.accountsEngaged],
    ['Interactions', insights.last28?.interactions],
  ];
  const sync = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/api/instagram/sync', {});
      await refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="instagram-panel" aria-label="Instagram organic results">
      <header className="instagram-head">
        <div>
          <h2>Instagram (organic)</h2>
          <p className="hint">@{insights.account?.username || 'unknown'} · {number(insights.account?.followers)} followers · Last 28 days</p>
        </div>
        <button className="btn" onClick={sync} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </header>
      {error && <p className="msg err" role="alert">{error}</p>}
      <dl className="instagram-stats">
        {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}
      </dl>
      {posts.length > 0 && (
        <div className="instagram-posts">
          <h3>Top recent posts</h3>
          <div className="instagram-post-grid">
            {posts.map(post => (
              <article className="instagram-post" key={post.id}>
                {post.permalink
                  ? <a href={post.permalink} target="_blank" rel="noreferrer">{post.caption || 'Instagram post'}</a>
                  : <strong>{post.caption || 'Instagram post'}</strong>}
                <p className="hint">{date(post.timestamp)} · {post.type || 'Post'}</p>
                <p className="instagram-post-numbers">
                  Reach {number(post.reach)} · Views {number(post.views)} · Interactions {number(post.interactions)}
                </p>
                <p className="hint">Saved {number(post.saved)} · Shares {number(post.shares)} · Likes {number(post.likes)} · Comments {number(post.comments)}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
