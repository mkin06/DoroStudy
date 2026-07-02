const API_URL = import.meta.env.VITE_API_URL || '/api';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

function handleUnauthorized(res) {
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login';
  }
}

export const studySessionAPI = {
  getAllSessions: async () => {
    const res = await fetch(`${API_URL}/study-sessions`, { credentials: 'include' });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Failed to fetch sessions.'));
    }
    return res.json();
  },

  createSession: async (sessionData) => {
    const res = await fetch(`${API_URL}/study-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(sessionData),
    });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Failed to save session.'));
    }
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_URL}/study-sessions/stats`, { credentials: 'include' });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Failed to fetch stats.'));
    }
    return res.json();
  },

  deleteSession: async (id) => {
    const res = await fetch(`${API_URL}/study-sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      handleUnauthorized(res);
      throw new Error(await parseError(res, 'Failed to delete session.'));
    }
  },
};
