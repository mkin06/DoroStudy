/* eslint-env serviceworker */

/**
 * Service worker của DoroStudy — chỉ làm đúng một việc: hiện lời nhắc chủ động.
 *
 * Server đẩy push RỖNG (không kèm nội dung), service worker mới tự gọi API lấy lời nhắc.
 * Ba lý do:
 *
 *   1. Nội dung luôn được tính lại tại đúng thời điểm hiện lên. User vừa học xong trong lúc
 *      thông báo còn đang trên đường thì API trả 204 và không có gì bật ra — thay vì giục
 *      một người vừa làm xong việc.
 *   2. Không dữ liệu học tập nào đi qua máy chủ của Google/Mozilla.
 *   3. Server không phải tự mã hoá payload (AES128GCM + HKDF), tức là bớt hẳn một mảng
 *      crypto viết tay dễ sai.
 */

const NUDGE_ENDPOINT = '/api/nudges/current';

self.addEventListener('install', () => {
  // Bản mới thay bản cũ ngay, không chờ tab hiện tại đóng
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(showCurrentNudge());
});

async function showCurrentNudge() {
  try {
    const res = await fetch(NUDGE_ENDPOINT, { credentials: 'include' });

    // 204 = không còn gì đáng nói (thường là user đã học trong lúc thông báo đang bay).
    // Không hiện gì cả. Trình duyệt có thể tự hiện một thông báo chung chung trong trường
    // hợp này — đánh đổi chấp nhận được, vì nó hiếm và vẫn tốt hơn là nhắc sai người.
    if (res.status === 204 || !res.ok) {
      return;
    }

    const nudge = await res.json();
    await self.registration.showNotification(`${nudge.icon} ${nudge.title}`, {
      body: nudge.body,
      // Thẻ cố định: lời nhắc mới thay thế lời nhắc cũ thay vì xếp chồng trên màn hình khoá
      tag: 'dorostudy-nudge',
      renotify: true,
      requireInteraction: false,
      data: { type: nudge.type, minutes: nudge.suggestedDurationMinutes, subject: nudge.subject },
    });
  } catch {
    // Mất mạng hoặc phiên đăng nhập đã hết: im lặng bỏ qua. Một thông báo lỗi ở đây chỉ
    // làm phiền user bằng đúng thứ họ không sửa được.
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { minutes, subject } = event.notification.data || {};

  // Mang theo kế hoạch trên URL để app mở ra là timer đã đặt sẵn — bấm thông báo xong còn
  // phải tự chỉnh lại thời gian thì phần lớn người ta bỏ giữa chừng.
  const params = new URLSearchParams();
  if (minutes) params.set('nudgeMinutes', String(minutes));
  if (subject) params.set('nudgeSubject', subject);
  const target = params.toString() ? `/?${params}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
