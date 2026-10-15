import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('linkedin MCP lists its tools and errors cleanly without a token', async () => {
  const p = spawn(process.execPath, [new URL('./linkedin.mjs', import.meta.url).pathname], { env: { ...process.env, LINKEDIN_ACCESS_TOKEN: 'your_api_key_here' } });
  const replies = new Map(); let buf = '';
  p.stdout.on('data', d => { buf += d; for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) { const m = JSON.parse(buf.slice(0, i)); replies.set(m.id, m); } });
  const send = m => p.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  send({ method: 'notifications/initialized' });
  send({ id: 2, method: 'tools/list' });
  send({ id: 3, method: 'tools/call', params: { name: 'linkedin_post', arguments: { text: 'hi' } } });
  send({ id: 4, method: 'nope' });
  while (replies.size < 4) await new Promise(r => setTimeout(r, 20));
  p.kill();
  assert.equal(replies.get(1).result.serverInfo.name, 'linkedin');
  assert.deepEqual(replies.get(2).result.tools.map(t => t.name), ['linkedin_whoami', 'linkedin_post']);
  assert.ok(replies.get(3).result.isError && /No LinkedIn token/.test(replies.get(3).result.content[0].text));
  assert.equal(replies.get(4).error.code, -32601);
});
