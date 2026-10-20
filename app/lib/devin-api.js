const API_BASE = 'https://api.devin.ai/v3/organizations';

export function maxAcuLimit(profile) {
  return Number.isInteger(profile?.devin_max_acu) ? profile.devin_max_acu : 5;
}

export function createDevinApi({ apiKey, orgId, fetchImpl = fetch }) {
  const organizationUrl = `${API_BASE}/${encodeURIComponent(orgId)}`;

  async function request(path, init = {}) {
    const response = await fetchImpl(`${organizationUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(`Devin API request failed with status ${response.status}`);
      error.status = 502;
      throw error;
    }
    return payload;
  }

  async function createSession({ prompt, maxAcu, sessionToken, title }) {
    return request('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_acu_limit: maxAcu,
        session_secrets: [{ key: 'STUDIO_TOKEN', value: sessionToken, sensitive: true }],
        title,
      }),
    });
  }

  function getSession(sessionId) {
    return request(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  async function listMessages(sessionId) {
    const items = [];
    let after;
    do {
      const params = new URLSearchParams({ first: '200' });
      if (after) params.set('after', after);
      const page = await request(`/sessions/${encodeURIComponent(sessionId)}/messages?${params}`);
      items.push(...(Array.isArray(page?.items) ? page.items : []));
      after = page?.has_next_page ? page?.end_cursor : null;
    } while (after);
    return { items };
  }

  function sendMessage(sessionId, message) {
    return request(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  }

  return { createSession, getSession, listMessages, sendMessage };
}

export function mapDevinMessages(items = []) {
  return items.map(({ source, message, created_at }) => ({
    role: source === 'user' ? 'user' : 'devin',
    text: message,
    created_at,
  }));
}

export function publicConversation(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    url: conversation.url,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
  };
}
