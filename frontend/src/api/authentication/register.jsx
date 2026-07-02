export async function register({ name, username, password }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Register failed');
  }
  return await res.text(); 
}