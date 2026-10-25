import { AGENDA, PHASES, SPRINT, STEPS } from '../steps.js';

const minutes = t => parseInt(t, 10) || 0;

// "Start here": what the day is, how it runs, and how to work with the assistant.
export default function Guide({ ctx, agentName }) {
  const { isDone, byId } = ctx;
  const total = AGENDA.reduce((t, a) => t + minutes(a.time), 0);
  const first = STEPS.find(s => !isDone(s.id));

  return (
    <article className="guide">
      <header className="step-head">
        <h1>{SPRINT.headline}</h1>
        <p>You’ll work on your own business, with {agentName} as your campaign partner. You bring what you know; {agentName} turns it into an offer, a plan, ready-to-post content, videos and a calendar. Everything is saved to your account.</p>
        <div className="actions">
          {!isDone('brain') && <a className="btn primary" href="#brain">Fill in your Business Brain</a>}
          <a className={'btn' + (isDone('brain') ? ' primary' : '')} href={'#' + (first?.id || 'profile')}>{first && first.id !== 'profile' ? `Continue: ${first.title}` : 'Start with your business profile'}</a>
        </div>
      </header>

      <section>
        <h2>What you’ll leave with</h2>
        {PHASES.map(p => {
          const steps = p.steps.map(id => byId[id]).filter(Boolean);
          return (
            <div key={p.name} className="phase-outcomes">
              <h3>{p.name}</h3>
              <ol className="outcomes" style={{ counterReset: `o ${STEPS.indexOf(steps[0])}` }}>
                {steps.map(s => (
                  <li key={s.id} className={isDone(s.id) ? 'done' : ''}>
                    <a href={'#' + s.id}>{s.title}</a>
                    <span>{s.blurb}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </section>

      <section>
        <h2>How the day runs</h2>
        <p className="hint">About {Math.round(total / 30) / 2} hours with breaks. Fall behind? Skip ahead — every step works on its own, and you can finish the rest at home.</p>
        <table className="agenda">
          <tbody>
            {AGENDA.map((a, i) => (
              <tr key={i} className={a.step ? '' : 'pause'}>
                <td>{a.time}</td>
                <td>{a.step ? <a href={'#' + a.step}>{a.what}</a> : a.what}{a.step && isDone(a.step) ? ' ✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>How every step works</h2>
        <ol className="how">
          <li><strong>Answer a few questions.</strong> Blanks are fine — {agentName} already knows your profile and earlier steps.</li>
          <li><strong>Click “Write it with {agentName}”.</strong> It may ask you a quick question in the chat first.</li>
          <li><strong>Read it, then ask for changes in the chat.</strong> Plain words work: “shorter”, “sound more like me”, “add a gift-card option”.</li>
        </ol>
        <p>Each step opens with a short <strong>How to do this step</strong> box: how long it takes, why it matters, and what “done” looks like.</p>
      </section>

      <section className="two-col">
        <div>
          <h2>Start anywhere</h2>
          <p>The order above builds each step on the last, but nothing is locked. Got footage on your phone? Start with <a href={'#video'}>{byId.video.title}</a>. If a step needs something you haven’t made yet, {agentName} fills the gap and labels its assumptions. When an earlier step changes, later steps show a note so you can rewrite them.</p>
        </div>
        <div>
          <h2>Talking to {agentName}</h2>
          <ul>
            <li>Be specific about your situation: “I can only post 3 times a week.”</li>
            <li>Ask for options: “Give me 3 versions of this headline.”</li>
            <li>Push back: “That price is too high for my customers.”</li>
            <li>Paste real examples: a caption you liked, a customer’s message.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Your files</h2>
        <p>Everything is saved to your account. Before a rewrite, the previous version is kept under <em>Previous versions</em>. When you’re done, use <a href="/api/business/export.md" download>Download my sprint</a> to get it all in one document.</p>
      </section>
    </article>
  );
}
