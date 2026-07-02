async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function login(data) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Username or password is incorrect.'));
  return res.json();
}

export async function logout() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Logout failed.'));
  return res.json();
}

export async function me() {
  const res = await fetch('/api/auth/me', {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Unauthenticated');
  return res.json();
}
