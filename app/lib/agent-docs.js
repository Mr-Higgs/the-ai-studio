import { BUSINESS_DOCS } from './business.js';

export function getAgentDocTarget(file) {
  if (file === 'profile.json') return { kind: 'profile' };
  if (!file?.endsWith('.md')) return null;
  const id = file.slice(0, -3);
  return BUSINESS_DOCS.includes(id) ? { kind: 'document', id } : null;
}
