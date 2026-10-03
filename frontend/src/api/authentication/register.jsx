export async function register({ name, username, email, password }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, email, password }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Register failed');
  }
  return await res.text(); 
}