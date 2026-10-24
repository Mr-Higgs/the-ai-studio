import { AGENDA, SPRINT, STEPS } from '../steps.js';

const minutes = t => parseInt(t, 10) || 0;

// "Start here": what the day is and how the workspace works.
export default function Guide({ ctx }) {
  const { isDone } = ctx;
  const total = AGENDA.reduce((t, a) => t + minutes(a.time), 0);
  const first = STEPS.find(s => !isDone(s.id));

  return (
    <article className="guide">
      <header className="step-head">
        <h1>{SPRINT.headline}</h1>
        <p>Build a growth plan for your own business. Your profile, calendar and tracker are saved to your account. AI writing is coming in the next update; promo videos are coming soon.</p>
        <div className="actions">
          <a className="btn primary" href={'#' + (first?.id || 'profile')}>{first && first.id !== 'profile' ? `Continue: ${first.title}` : 'Start with your business profile'}</a>
        </div>
      </header>

      <section>
        <h2>What you’ll leave with</h2>
        <ol className="outcomes">
          {STEPS.map(s => (
            <li key={s.id} className={isDone(s.id) ? 'done' : ''}>
              <a href={'#' + s.id}>{s.title}</a>
              <span>{s.blurb}</span>
            </li>
          ))}
        </ol>
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
          <li><strong>Fill in your business profile.</strong> Add the details you know; you can update them later.</li>
          <li><strong>Track leads and sales.</strong> Add leads and update their stages in the tracker.</li>
          <li><strong>Plan your campaign calendar.</strong> Add, edit and mark posts as published.</li>
          <li><strong>Download your sprint.</strong> Export the saved profile, plans and calendar from the sidebar.</li>
        </ol>
        <p>Each step opens with a short <strong>How to do this step</strong> box: how long it takes, why it matters, and what “done” looks like.</p>
      </section>

      <section className="two-col">
        <div>
          <h2>Start anywhere</h2>
          <p>The order above builds each step on the last, but nothing is locked. Profile, tracker and calendar changes are saved to your account. AI writing and promo videos will arrive in a later update.</p>
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
        <p>Your business profile, plans, calendar and tracker are saved to your account. Previous document versions are kept under <em>Previous versions</em>. When you’re done, use <a href="/api/business/export.md" download>Download my sprint</a> to get it all in one document.</p>
      </section>
    </article>
  );
}
