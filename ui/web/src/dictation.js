import { useEffect, useRef, useState } from 'react';
import { toast } from './api.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canDictate = !!SR;

// Browser speech-to-text for the composer (Chrome, Edge, Safari; Firefox has no SpeechRecognition).
export function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null), cb = useRef(onText);
  cb.current = onText;
  const start = prefix => {
    if (!SR || rec.current) return;
    const r = Object.assign(new SR(), { continuous: true, interimResults: true, lang: navigator.language || 'en-US' });
    r.onresult = e => cb.current(prefix + Array.from(e.results, x => x[0].transcript.trim()).filter(Boolean).join(' '));
    r.onerror = e => {
      if (['not-allowed', 'service-not-allowed'].includes(e.error)) toast('Studio can’t use your microphone. Allow it for this site in your browser (the padlock next to the address) and try again.');
      else if (e.error === 'network') toast('Dictation needs an internet connection.');
    };
    r.onend = () => { rec.current = null; setListening(false); };
    r.start(); rec.current = r; setListening(true);
  };
  // stop() keeps the last words; stop(true) throws them away (the text was just sent, or the owner started typing).
  const stop = (discard = false) => { const r = rec.current; if (!r) return; if (discard) r.onresult = null; discard ? r.abort() : r.stop(); };
  useEffect(() => () => stop(true), []);
  return { listening, start, stop };
}
