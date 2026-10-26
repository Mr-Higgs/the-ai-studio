import { PHASES, SPRINTS, STEPS, setSprint } from '../steps.js';
import BuiltWithDevin from './BuiltWithDevin.jsx';

// Signed-out front page. Copy follows the $100M Offers frame: dream outcome, proof, speed, low effort, value stack.
const PAINS = [
  ['“I don’t have time to do marketing.”', 'Answer a few questions. Devin writes the strategy, posts, emails and ads for you.'],
  ['“I never know what to post.”', 'A ready-to-post content kit in your voice, and a calendar that says what goes out when.'],
  ['“Nobody finds me on Google.”', 'A get-found-locally plan for Google, Maps and AI assistants, with the numbers that prove it’s working.'],
  ['“My offer sounds like everyone else’s.”', 'One offer so clear and valuable the right customer feels silly saying no.'],
  ['“Leads slip through the cracks.”', 'A lead form and tracker so every inquiry is caught and followed up.'],
];
const HOW = [
  ['Tell it about your business', 'What you sell, who buys, what it costs. Ten minutes, plain questions.'],
  ['Devin does the work', 'Each step produces a finished document: offer, research, strategy, content, calendar.'],
  ['Launch and track', 'Post, follow the plan, and watch leads land in your tracker.'],
];
const TEAM = [
  ['jerry-pierre.jpeg', 'Jerry Pierre', 'Co-Founder & CTO, Patterned · Co-Founder, RateLimitLabs · Devin AI and HeyGen Ambassador'],
  ['sam-shaqour.jpeg', 'Samer Shaqour', 'Co-Founder & CEO, Patterned · Co-Founder, RateLimitLabs'],
];

export default function Landing() {
  setSprint('growth'); // STEPS is only filled once a sprint is picked
  const byId = Object.fromEntries(STEPS.map(s => [s.id, s]));
  const cta = <a className="btn primary lg" href="#login">Start your sprint</a>;

  return (
    <main className="landing">
      <header className="landing-nav">
        <span className="brand-name">{SPRINTS.growth.name}</span>
        <a className="btn ghost" href="#login">Sign in</a>
      </header>

      <section className="landing-hero">
        <p className="eyebrow">For small business owners</p>
        <h1>{SPRINTS.growth.headline}, without hiring an agency.</h1>
        <p className="lede">A guided marketing sprint where an AI agent writes every piece for you: the offer, the plan, the posts, the calendar and the follow-up. You make the calls; Devin does the work.</p>
        <div className="landing-ctas">{cta}<a className="btn lg" href="#what">See what you get</a></div>
      </section>

      <section>
        <h2>Sound familiar?</h2>
        <div className="landing-pains">
          {PAINS.map(([pain, fix]) => <div key={pain} className="landing-card"><p className="pain">{pain}</p><p>{fix}</p></div>)}
        </div>
      </section>

      <section id="what">
        <h2>Everything you get</h2>
        <p className="lede">{STEPS.length} steps, each one a finished piece of your marketing.</p>
        {PHASES.map(p => (
          <div key={p.name} className="landing-phase">
            <h3>{p.name}</h3>
            <ul>
              {p.steps.map(id => byId[id] && <li key={id}><strong>{byId[id].title}</strong><span>{byId[id].blurb}</span></li>)}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>How it works</h2>
        <ol className="landing-how">
          {HOW.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}
        </ol>
      </section>

      {/* ponytail: no price, guarantee or deadline block until we have real ones; fake scarcity backfires */}

      <section>
        <h2>Who built this</h2>
        <div className="landing-team">
          {TEAM.map(([img, name, role]) => (
            <div key={name} className="landing-card person">
              <img src={`/${img}`} alt="" width="64" height="64" />
              <div><strong>{name}</strong><span>{role}</span></div>
            </div>
          ))}
        </div>
        <div className="landing-logos">
          <span className="patterned-logo" role="img" aria-label="Patterned" />
          <img className="tile" src="/ratelimitlabs.png" alt="RateLimitLabs" />
        </div>
      </section>

      <section className="landing-final">
        <h2>Your next 30 days of marketing, done with you.</h2>
        {cta}
        <BuiltWithDevin />
      </section>
    </main>
  );
}
