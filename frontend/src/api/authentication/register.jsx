import { captureEvent } from '../../lib/analytics';
import { API_URL } from '../config';

export async function register({ name, username, email, password }) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, email, password }),
  });
  if (!res.ok) {
    try {
      const body = await res.json();
      throw new Error(body.message || 'Không thể đăng ký tài khoản.');
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Không thể đăng ký tài khoản. Vui lòng thử lại.');
      }
      throw error;
    }
  }
  const result = await res.json();
  captureEvent('registration_succeeded');
  return result;
}
