import { API_URL } from './config';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

export const studySessionAPI = {
  getAllSessions: async (days) => {
    const query = days ? `?days=${encodeURIComponent(days)}` : '';
    const res = await fetch(`${API_URL}/study-sessions${query}`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(await parseError(res, 'Không tải được lịch sử phiên học.'));
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
      throw new Error(await parseError(res, 'Không lưu được phiên học.'));
    }
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_URL}/study-sessions/stats`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(await parseError(res, 'Không tải được thống kê.'));
    }
    return res.json();
  },

  deleteSession: async (id) => {
    const res = await fetch(`${API_URL}/study-sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(await parseError(res, 'Không xóa được phiên học.'));
    }
  },
};
