import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionPrompt, followUp, ownerText } from './_lib/prompts.js';

test('chat shows only the owner text, not injected context', () => {
  assert.equal(ownerText(sessionPrompt('CTX with My request: inside', 'write my offer', { skill: 'SKILL' })), 'write my offer');
  assert.equal(ownerText(followUp('SKILL\n\nchanged docs ---', 'shorter please')), 'shorter please');
  assert.equal(ownerText(followUp('', 'plain')), 'plain');
  assert.equal(ownerText('old message, no mark'), 'old message, no mark');
});
