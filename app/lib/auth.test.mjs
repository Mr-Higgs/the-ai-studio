import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from './auth.js';

test('next redirect accepts only local relative paths', () => {
  assert.equal(safeNextPath('/settings'), '/settings');
  assert.equal(safeNextPath('/auth/update-password?done=1'), '/auth/update-password?done=1');
  assert.equal(safeNextPath('//attacker.example/path'), '/');
  assert.equal(safeNextPath('/\\attacker.example/path'), '/');
  assert.equal(safeNextPath('https://attacker.example'), '/');
  assert.equal(safeNextPath(undefined), '/');
});
