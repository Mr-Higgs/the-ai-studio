import { BEFORE, CHAPTERS, LOOP, WORDS } from '../guide-content.js';

// The guide copy marks button names with **double asterisks** — render them as <strong>.
const B = ({ t }) => <>{String(t).split(/\*\*(.+?)\*\*/g).map((p, i) => i % 2 ? <strong key={i}>{p}</strong> : p)}</>;

// The same red circle the screenshots use, so the captions line up with the marks in the picture.
const Mark = ({ n }) => <span className="guide-mark" aria-hidden="true">{n}</span>;

// Anchor links can't use location.hash — hash routes the whole app. Scroll inside .main instead.
const scrollToId = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const toTop = e => e.currentTarget.closest('.main')?.scrollTo({ top: 0, behavior: 'smooth' });

function GuideFigure({ image }) {
  return (
    <figure className="help-figure">
      <img src={image.src} alt={image.alt} loading="lazy" onError={e => e.currentTarget.closest('figure').classList.add('missing')} />
      {image.marks?.length > 0 && (
        <figcaption>
          <ol>
            {image.marks.map((m, i) => <li key={i}><Mark n={i + 1} /><span><B t={m} /></span></li>)}
          </ol>
        </figcaption>
      )}
    </figure>
  );
}

function Part({ part }) {
  return (
    <div className="help-part">
      <h3>{part.heading}</h3>
      {part.image && <GuideFigure image={part.image} />}
      {part.steps && <ol className="help-steps">{part.steps.map((s, i) => <li key={i}><B t={s} /></li>)}</ol>}
      {part.expect && <div className="help-expect"><strong>What you should see now.</strong> <B t={part.expect} /></div>}
      {part.note && <p className="help-note"><B t={part.note} /></p>}
    </div>
  );
}

// The full step-by-step guide (#help). Same content as the public /guide page, full detail.
export default function Help() {
  return (
    <article className="help">
      <header className="step-head">
        <h1>Step by step: from first sign-in to your finished campaign</h1>
        <p>Every screen, in order, with pictures. Click a chapter below to jump to it — or read top to bottom.</p>
      </header>

      <div className="help-body">
        <nav className="help-toc" aria-label="Guide chapters">
          <strong>Contents</strong>
          <ol>
            {CHAPTERS.map(c => (
              <li key={c.id}>
                <a href={'#help'} onClick={e => { e.preventDefault(); scrollToId(`help-${c.id}`); }}>
                  <span className="toc-n">{c.n}</span> {c.title} <small>{c.time}</small>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="help-main">
          <section className="help-section">
            <h2>Words we use</h2>
            <dl className="help-words">
              {WORDS.map(([w, d]) => <div key={w}><dt>{w}</dt><dd>{d}</dd></div>)}
            </dl>
          </section>

          <section className="help-section">
            <h2>Before you start</h2>
            <div className="help-cards">
              {BEFORE.map(b => <div key={b.title} className="help-card"><strong>{b.title}</strong><p>{b.why}</p></div>)}
            </div>
          </section>

          <section className="help-section">
            <h2>The three moves on every step</h2>
            <ol className="help-loop">
              {LOOP.map(l => <li key={l.title} className="help-card"><strong>{l.title}</strong><p>{l.text}</p></li>)}
            </ol>
          </section>

          {CHAPTERS.map(c => (
            <section key={c.id} id={`help-${c.id}`} className="help-section help-chapter">
              <p className="eyebrow">Chapter {c.n}</p>
              <h2>{c.title} <span className="help-time">{c.time}</span></h2>
              <p className="help-intro">{c.intro}</p>
              {c.parts.map((p, i) => <Part key={i} part={p} />)}
              {c.stuck?.length > 0 && (
                <div className="help-stuck">
                  <h3>If it doesn’t look like that</h3>
                  {c.stuck.map(([problem, fix], i) => (
                    <div key={i} className="help-stuck-row"><strong>{problem}</strong><p>{fix}</p></div>
                  ))}
                </div>
              )}
              <a href="#help" className="help-top" onClick={e => { e.preventDefault(); toTop(e); }}>↑ Back to top</a>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
