const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * API cho lời nhắc chủ động + đăng ký thông báo đẩy.
 *
 * Khác với các api khác trong dự án: các hàm ở đây KHÔNG đá user về /login khi gặp 401.
 * Nhắc nhở là tính năng phụ chạy nền lúc app vừa mở; đá người ta ra khỏi màn hình đang
 * dùng chỉ vì một lời nhắc không lấy được là đánh đổi sai.
 */

/** Lời nhắc hiện tại, hoặc null khi không có gì đáng nói (backend trả 204). */
export async function getCurrentNudge() {
  const res = await fetch(`${API_URL}/nudges/current`, { credentials: 'include' });
  if (res.status === 204 || !res.ok) {
    return null;
  }
  return res.json();
}

/** Khoá công khai VAPID + môi trường có bật push không + user đã đăng ký chưa. */
export async function getNudgeConfig() {
  const res = await fetch(`${API_URL}/nudges/config`, { credentials: 'include' });
  if (!res.ok) {
    return { enabled: false, publicKey: '', subscribed: false };
  }
  return res.json();
}

/**
 * Xin quyền thông báo, đăng ký service worker và lưu đăng ký lên server.
 *
 * @returns {Promise<boolean>} true khi đã bật thành công
 */
export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Trình duyệt này không hỗ trợ thông báo đẩy.');
  }

  const config = await getNudgeConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error('Máy chủ chưa bật thông báo đẩy.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    // Bị từ chối một lần là trình duyệt nhớ mãi, xin lại cũng không hiện hộp thoại nữa
    throw new Error('Bạn đã từ chối quyền thông báo. Bật lại trong cài đặt trình duyệt.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Đăng ký cũ có thể gắn với khoá VAPID cũ (server đổi khoá) — huỷ rồi đăng ký lại,
  // vì subscribe() với applicationServerKey khác sẽ lỗi chứ không tự ghi đè.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
  });

  const json = subscription.toJSON();
  const res = await fetch(`${API_URL}/nudges/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh || null,
      auth: json.keys?.auth || null,
    }),
  });
  if (!res.ok) {
    throw new Error('Không lưu được đăng ký thông báo.');
  }
  return true;
}

/** Tắt thông báo đẩy trên trình duyệt hiện tại. */
export async function disablePushNotifications() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${API_URL}/nudges/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await subscription.unsubscribe();
}

/**
 * Khoá VAPID đi qua mạng dưới dạng base64url, còn pushManager.subscribe() cần Uint8Array
 * base64 chuẩn — thiếu bước đổi này thì trình duyệt báo lỗi khoá không hợp lệ.
 */
function urlBase64ToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
