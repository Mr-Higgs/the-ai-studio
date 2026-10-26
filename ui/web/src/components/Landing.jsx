import { PHASES, SPRINTS, STEPS, setSprint } from '../steps.js';
import BuiltWithDevin from './BuiltWithDevin.jsx';
import FiberBackground from './FiberBackground.jsx';

// Signed-out front page for the GENESIS holiday workshop (Be One & Branches). Copy follows the $100M Offers frame: dream outcome, proof, speed, low effort, value stack.
const PAINS = [
  ['“I’m too busy in the holidays to do marketing.”', 'Answer a few questions. Devin writes the holiday strategy, posts, emails and ads for you.'],
  ['“I never know what to post.”', 'A ready-to-post content kit in your voice, and a calendar lined up with Black Friday, Small Business Saturday and Cyber Monday.'],
  ['“Nobody finds me on Google.”', 'A get-found plan for “gifts near me” searches on Google, Maps and AI assistants.'],
  ['“My offer sounds like everyone else’s.”', 'One holiday offer so clear and valuable the right customer feels silly saying no.'],
  ['“Leads slip through the cracks.”', 'A lead form and tracker so every inquiry is caught and followed up.'],
];
const HOW = [
  ['Bring your business to the workshop', 'What you sell, who buys, what it costs. Plain questions, your real numbers.'],
  ['Devin does the work', 'Each step produces a finished piece of your holiday campaign: offer, research, strategy, content, calendar.'],
  ['Launch and track', 'Post through the season, follow the plan, and watch leads and sales land in your tracker.'],
];
const TEAM = [
  ['jerry-pierre.jpeg', 'Jerry Pierre', 'Co-Founder & CTO, Patterned · Co-Founder, RateLimitLabs · Devin AI and HeyGen Ambassador'],
  ['sam-shaqour.jpeg', 'Samer Shaqour', 'Co-Founder & CEO, Patterned · Co-Founder, RateLimitLabs'],
];

export default function Landing() {
  setSprint('holiday'); // STEPS is only filled once a sprint is picked
  const byId = Object.fromEntries(STEPS.map(s => [s.id, s]));
  const cta = <a className="btn primary lg" href="#login">Start your sprint</a>;

  return (
    <main className="landing">
      <FiberBackground />
      <header className="landing-nav">
        <span className="nav-brand"><img className="rll-logo" src="/ratelimitlabs.png" alt="RateLimitLabs" width="714" height="165" /><span className="brand-name">GENESIS | {SPRINTS.growth.name}</span></span>
        <a className="btn ghost" href="#login">Sign in</a>
      </header>

      <section className="landing-hero">
        <p className="eyebrow">GENESIS · A hands-on workshop with Be One &amp; Branches</p>
        <h1>{SPRINTS.growth.name}: Build Your AI-Powered Sales Engine</h1>
        <p className="lede">This hands-on workshop helps micro and small business owners use AI to turn the holiday season into a real growth opportunity. You’ll work on your own business and build a practical holiday sales campaign that attracts new customers, strengthens engagement and grows revenue.</p>
        <div className="landing-ctas">{cta}<a className="btn lg" href="#what">See what you get</a></div>
        <p className="partners-label">Presented by</p>
        <div className="landing-logos partners">
          <img src="/be-one.png" alt="Be One" />
          <img className="tile light" src="/branches.png" alt="Branches — Trish &amp; Dan Bell Family Empowerment Centers" />
        </div>
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
        <div className="landing-logos centered">
          <span className="patterned-logo" role="img" aria-label="Patterned" />
        </div>
      </section>

      <section className="landing-final">
        <h2>Leave the workshop with your holiday campaign built.</h2>
        {cta}
        <BuiltWithDevin />
      </section>
    </main>
  );
}
