import { useState } from 'react';
import { Fields, StepHead } from './GenerateStep.jsx';

export default function Profile({ step, profile, save, ctx }) {
  const { next, go } = ctx;
  const [values, setValues] = useState(profile || {});
  const [state, setState] = useState('idle');
  const dirty = JSON.stringify(values) !== JSON.stringify(profile || {});

  const submit = async e => {
    e.preventDefault();
    setState('saving');
    try { await save({ ...profile, ...values }); setState('saved'); }
    catch (err) { setState(`Couldn’t save: ${err.message}`); }
  };

  return (
    <>
      <StepHead step={step} ctx={ctx} />
      <form className="inputs profile" onSubmit={submit}>
        <div className="fields"><Fields fields={step.inputs} values={values} onChange={v => { setValues(v); setState('idle'); }} /></div>
        <div className="actions">
          <button className="btn primary" disabled={!values.name?.trim() || state === 'saving' || (!dirty && state === 'saved')}>Save profile</button>
          {state === 'saved' && <span className="hint ok">Saved. Devin will use this in every step.</span>}
          {state.startsWith('Couldn') && <span className="hint err">{state}</span>}
          {!values.name?.trim() && <span className="hint">Business name is the only required field.</span>}
          {profile?.name && next && <button type="button" className="btn" onClick={() => go(next.id)}>Next: {next.title}</button>}
        </div>
      </form>
    </>
  );
}
