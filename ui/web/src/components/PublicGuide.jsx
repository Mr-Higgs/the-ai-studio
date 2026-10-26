import FiberBackground from './FiberBackground.jsx';
import BuiltWithDevin from './BuiltWithDevin.jsx';
import { BEFORE, LOOP, OUTCOMES, SHORT_CHAPTERS } from '../guide-content.js';

// Public /guide — the short, no-sign-in version. Reuses the Landing look; the full
// guide lives in the app at #help.
export default function PublicGuide() {
  return (
    <main className="landing pub-guide">
      <FiberBackground />
      <header className="landing-nav">
        <a className="nav-brand" href="/" style={{ textDecoration: 'none' }}><img className="rll-logo" src="/ratelimitlabs.png" alt="RateLimitLabs" width="714" height="165" /><span className="brand-name">GENESIS | Growth Sprint</span></a>
        <a className="btn ghost" href="/#login">Sign in</a>
      </header>

      <section className="landing-hero">
        <p className="eyebrow">HOW STUDIO WORKS</p>
        <h1>What you’ll actually do today</h1>
        <p className="lede">You answer questions about your business. Devin — an AI helper — writes your offer, posts, emails and plan. You read it, ask for changes, and post it. No technical skills needed.</p>
        <div className="landing-ctas"><a className="btn primary lg" href="/#login">Create your account</a><a className="btn lg" href="/#login">I already have an account</a></div>
      </section>

      <section>
        <h2>What you’ll leave with</h2>
        <div className="landing-pains">
          {OUTCOMES.map(([t, d]) => <div key={t} className="landing-card"><p className="pain">{t}</p><p>{d}</p></div>)}
        </div>
      </section>

      <section>
        <h2>The three moves on every step</h2>
        <p className="lede">Every one of the 11 steps works the same way.</p>
        <ol className="pub-loop">
          {LOOP.map(l => <li key={l.title} className="landing-card"><strong>{l.title}</strong><p>{l.text}</p></li>)}
        </ol>
        <figure className="pub-shot">
          <img src="/guide/09-anatomy.png" alt="A step page: steps on the left, questions and the big button in the middle, chat on the right" loading="lazy" />
          <figcaption>A real step, with the parts numbered: the step list, your answers, the button, and the chat with Devin.</figcaption>
        </figure>
      </section>

      <section>
        <h2>Have these ready</h2>
        <div className="landing-pains">
          {BEFORE.map(b => <div key={b.title} className="landing-card"><p className="pain">{b.title}</p><p>{b.why}</p></div>)}
        </div>
      </section>

      <section>
        <h2>The day, chapter by chapter</h2>
        <p className="lede">The full guide with every screen is inside Studio under Help — sign in to open it.</p>
        <ol className="pub-chapters">
          {SHORT_CHAPTERS.map(c => (
            <li key={c.id} className="landing-card pub-chapter">
              {c.image && <img className="pub-thumb" src={c.image.src} alt={c.image.alt} loading="lazy" onError={e => e.currentTarget.remove()} />}
              <div className="pub-chapter-body">
                <span className="pub-chapter-n">Chapter {c.n} · {c.time}</span>
                <strong>{c.title}</strong>
                <p>{c.intro}</p>
                <a className="btn" href="/#help">Open this chapter in Studio</a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-final">
        <h2>Ready?</h2>
        <a className="btn primary lg" href="/#login">Create your account</a>
        <BuiltWithDevin />
      </section>
    </main>
  );
}
