import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { siteSkill } from './_lib/prompts.js';

test('siteSkill inlines both skill files under their .devin paths', () => {
  const text = siteSkill(f => `<contents of ${f}>`);
  assert.ok(text.includes('### .devin/skills/site-build/SKILL.md'));
  assert.ok(text.includes('### .devin/skills/anti-generic-audit/SKILL.md'));
  assert.ok(text.includes('### .devin/skills/seo-ai-search/SKILL.md'));
  assert.ok(text.includes('GitHub Pages'));
  assert.ok(text.includes('<contents of site-build/SKILL.md>'));
  assert.ok(text.includes('<contents of anti-generic-audit/SKILL.md>'));
  assert.ok(text.includes('<contents of seo-ai-search/SKILL.md>'));
});

test('siteSkill reads the real skill files', () => {
  const text = siteSkill(f => fs.readFileSync(path.join(process.cwd(), '.devin/skills', f), 'utf8'));
  assert.ok(text.includes('anti-generic-audit'));
  assert.ok(text.includes('### .devin/skills/seo-ai-search/SKILL.md'));
  assert.ok(text.includes('llms.txt'));
});
