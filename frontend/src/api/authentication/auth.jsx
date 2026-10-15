import { captureEvent, identifyUser, resetAnalytics } from '../../lib/analytics';
import { API_URL } from '../config';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

let cachedMe = null;
let cachedMeAt = 0;
let pendingMe = null;
let authGeneration = 0;
const ME_CACHE_MS = 30_000;

export async function login(data) {
  authGeneration += 1;
  cachedMe = null;
  cachedMeAt = 0;
  pendingMe = null;
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Tên đăng nhập/email hoặc mật khẩu không đúng.'));
  const loginResult = await res.json();

  // Xác minh cookie phiên đã được trình duyệt lưu trước khi chuyển sang trang chính.
  // Việc redirect ngay sau POST từng khiến giao diện vào trang chính rồi bị đá ngược
  // về login khi trình duyệt vẫn giữ JSESSIONID cũ từ một container trước đó.
  const sessionCheck = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!sessionCheck.ok) {
    throw new Error('Trình duyệt không lưu được phiên đăng nhập. Hãy bật cookie và thử lại.');
  }
  cachedMe = await sessionCheck.json();
  cachedMeAt = Date.now();
  identifyUser(cachedMe.id);
  captureEvent('auth_login_succeeded', { method: 'password' });
  return loginResult;
}

export async function googleLogin(idToken) {
  authGeneration += 1;
  cachedMe = null;
  cachedMeAt = 0;
  pendingMe = null;
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Đăng nhập Google thất bại.'));
  const result = await res.json();
  const sessionCheck = await fetch(`${API_URL}/auth/me`, { credentials: 'include', cache: 'no-store' });
  if (!sessionCheck.ok) {
    throw new Error('Trình duyệt không lưu được phiên đăng nhập. Hãy bật cookie và thử lại.');
  }
  cachedMe = await sessionCheck.json();
  cachedMeAt = Date.now();
  identifyUser(cachedMe.id);
  captureEvent('auth_login_succeeded', { method: 'google' });
  return result;
}

export async function logout() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Đăng xuất thất bại.'));
  authGeneration += 1;
  captureEvent('auth_logout');
  resetAnalytics();
  cachedMe = null;
  cachedMeAt = 0;
  pendingMe = null;
  return res.json();
}

export async function me() {
  if (cachedMe && Date.now() - cachedMeAt < ME_CACHE_MS) return cachedMe;
  if (pendingMe) return pendingMe;

  const generation = authGeneration;
  const request = fetch(`${API_URL}/auth/me`, { credentials: 'include', cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) {
        if ((res.status === 401 || res.status === 403) && generation === authGeneration) {
          cachedMe = null;
          cachedMeAt = 0;
          resetAnalytics();
        }
        throw new Error('Chưa đăng nhập.');
      }
      const profile = await res.json();
      if (generation === authGeneration) {
        cachedMe = profile;
        cachedMeAt = Date.now();
        identifyUser(profile.id);
      }
      return profile;
    })
    .finally(() => { if (pendingMe === request) pendingMe = null; });
  pendingMe = request;
  return request;
}
