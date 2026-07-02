const API_URL = import.meta.env.VITE_API_URL || '/api';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

export const notesAPI = {
  getNotes: async () => {
    const res = await fetch(`${API_URL}/notes`, { credentials: 'include' });
    if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch notes.'));
    return res.json();
  },

  createNote: async (data) => {
    const res = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Failed to create note.'));
    return res.json();
  },

  updateNote: async (id, data) => {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Failed to update note.'));
    return res.json();
  },

  deleteNote: async (id) => {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Failed to delete note.'));
  },
};
