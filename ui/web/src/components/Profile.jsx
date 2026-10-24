import { useEffect, useMemo, useRef, useState } from 'react';
import { put } from '../api.js';
import { Fields, StepHead } from './GenerateStep.jsx';
import { BusinessNumbers } from './Brain.jsx';
import { PROFILE_FIELDS, brainMath, cleanBrain, helpPrompt, profileWithBrain } from '../brain.js';

export default function Profile({ step, profile, save, ctx }) {
  const { next, go, biz, agent, agentName, generate, refresh } = ctx;
  const serverValues = profileWithBrain(profile, biz?.brain);
  const serverBrain = cleanBrain(biz?.brain);
  const serverProfileJson = JSON.stringify(serverValues);
  const serverBrainJson = JSON.stringify(serverBrain);
  const [values, setValues] = useState(() => serverValues);
  const [brain, setBrain] = useState(() => serverBrain);
  const [state, setState] = useState('idle');
  const synced = useRef({ profile: serverProfileJson, brain: serverBrainJson });
  const dirtyProfile = JSON.stringify(values) !== synced.current.profile;
  const dirtyBrain = JSON.stringify(cleanBrain(brain)) !== synced.current.brain;
  const dirty = dirtyProfile || dirtyBrain;
  const m = useMemo(() => brainMath(brain, values), [brain, values]);

  useEffect(() => {
    if (JSON.stringify(values) === synced.current.profile) {
      setValues(serverValues);
      synced.current.profile = serverProfileJson;
    }
    if (JSON.stringify(cleanBrain(brain)) === synced.current.brain) {
      setBrain(serverBrain);
      synced.current.brain = serverBrainJson;
    }
  }, [serverProfileJson, serverBrainJson]);

  const saveChanges = async () => {
    setState('saving');
    const nextProfile = { ...(profile || {}), ...values };
    const nextBrain = cleanBrain(brain);
    try {
      await save(nextProfile);
      if (dirtyBrain) {
        await put('/api/business/brain.json', nextBrain);
        await refresh();
      }
      synced.current = {
        profile: JSON.stringify(profileWithBrain(nextProfile, nextBrain)),
        brain: JSON.stringify(nextBrain),
      };
      setState('saved');
      return true;
    } catch (err) {
      setState(`Couldn’t save: ${err.message}`);
      return false;
    }
  };
  const submit = async e => { e.preventDefault(); await saveChanges(); };
  const setTag = (id, s) => setBrain(b => ({ ...b, answers: { ...b.answers, [id]: { ...b.answers[id], s } } }));
  const helpFields = step.inputs.filter(f => f.num && (
    !String(values[f.id] ?? '').trim() || brain.answers[f.id]?.s === 'help'
  )).sort((a, b) => Number(brain.answers[b.id]?.s === 'help') - Number(brain.answers[a.id]?.s === 'help'));
  const helpIds = helpFields.map(f => f.id);
  const workOut = async () => {
    if (dirty && !(await saveChanges())) return;
    generate(step, helpPrompt(values, brain, helpIds));
  };

  return (
    <>
      <StepHead step={step} ctx={ctx} />
      <form className="inputs profile" onSubmit={submit}>
        <div className="fields"><Fields
          fields={step.inputs}
          values={values}
          onChange={nextValues => {
            setValues(nextValues);
            for (const field of PROFILE_FIELDS) {
              if (field.num && brain.answers[field.id]?.s === 'help' && String(nextValues[field.id] ?? '').trim()) setTag(field.id, 'estimate');
            }
            setState('idle');
          }}
          after={field => field.num && (
            <button
              type="button"
              className="unsure"
              aria-pressed={brain.answers[field.id]?.s === 'help'}
              onClick={() => setTag(field.id, brain.answers[field.id]?.s === 'help' ? '' : 'help')}
            >Not sure</button>
          )}
        /></div>
        {helpFields.length > 0 && (
          <div className="number-help">
            <p>Don’t know some of these? {agentName} can walk you through each one and fill it in for you to check.</p>
            <button type="button" className="btn" disabled={agent.busy || state === 'saving'} onClick={workOut}>
              Work out {helpFields.length} with {agentName}
            </button>
          </div>
        )}
        <div className="profile-numbers"><BusinessNumbers m={m} /></div>
        <div className="actions">
          <button className="btn primary" disabled={state === 'saving' || !dirty}>Save profile</button>
          {state === 'saved' && <span className="hint ok">Saved. Devin will use this in every step.</span>}
          {state.startsWith('Couldn') && <span className="hint err">{state}</span>}
          {!values.name?.trim() && <span className="hint">Business name is the only required field.</span>}
          {profile?.name && next && <button type="button" className="btn" onClick={() => go(next.id)}>Next: {next.title}</button>}
        </div>
      </form>
    </>
  );
}
