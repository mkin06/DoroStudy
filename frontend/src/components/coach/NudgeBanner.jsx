import React, { useCallback, useEffect, useState } from 'react';
import './NudgeBanner.css';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentNudge,
  getNudgeConfig,
} from '../../api/nudge';

// Nhắc càng khẩn cấp thì viền càng nóng. Màu chỉ là kênh phụ — icon và chữ luôn mang đủ nghĩa.
const TONES = {
  STREAK_AT_RISK: 'hot',
  COMEBACK: 'warm',
  GOLDEN_HOUR: 'cool',
  UNLOCK_CLOSE: 'cool',
  FIRST_STEP: 'cool',
};

/**
 * Banner nhắc chủ động, hiện ngay khi user mở app.
 *
 * Đây là nửa "trong app" của tính năng nhắc; nửa kia là thông báo đẩy qua service worker.
 * Hai nửa dùng chung một endpoint nên nói cùng một câu, và câu đó luôn được tính lại tại
 * thời điểm hiển thị.
 *
 * Banner tự biến mất khi không có gì đáng nói — và đó là trạng thái phổ biến nhất, đúng
 * như thiết kế của NudgeEngine. Một banner lúc nào cũng hiện thì chỉ sau vài ngày là user
 * ngừng nhìn vào chỗ đó.
 *
 * Props:
 *  - onAct: ({ durationMinutes, subject }) => void — áp lời nhắc vào timer
 *  - refreshKey: đổi để tải lại (sau khi vừa xong một phiên thì lời nhắc thường hết hiệu lực)
 */
export default function NudgeBanner({ onAct, refreshKey }) {
  const [nudge, setNudge] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [pushConfig, setPushConfig] = useState({ enabled: false, subscribed: false });
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentNudge()
      .then((data) => {
        if (cancelled) return;
        setNudge(data);
        setDismissed(false);
      })
      .catch(() => {
        if (!cancelled) setNudge(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    getNudgeConfig()
      .then((config) => {
        if (!cancelled) setPushConfig(config);
      })
      .catch(() => {
        /* môi trường chưa bật push — ẩn hẳn phần này */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePush = useCallback(async () => {
    setBusy(true);
    setPushError(null);
    try {
      if (pushConfig.subscribed) {
        await disablePushNotifications();
        setPushConfig((c) => ({ ...c, subscribed: false }));
      } else {
        await enablePushNotifications();
        setPushConfig((c) => ({ ...c, subscribed: true }));
      }
    } catch (err) {
      setPushError(err.message || 'Không bật được thông báo.');
    } finally {
      setBusy(false);
    }
  }, [pushConfig.subscribed]);

  const handleAct = useCallback(() => {
    if (!nudge) return;
    onAct?.({
      durationMinutes: nudge.suggestedDurationMinutes,
      subject: nudge.subject,
    });
    setDismissed(true);
  }, [nudge, onAct]);

  if (!nudge || dismissed) {
    return null;
  }

  const tone = TONES[nudge.type] || 'cool';

  return (
    <section className={`nudge-banner ${tone}`} role="status">
      <span className="nudge-icon" aria-hidden="true">{nudge.icon}</span>

      <div className="nudge-text">
        <strong className="nudge-title">{nudge.title}</strong>
        <p className="nudge-body">{nudge.body}</p>

        {/* Lời mời bật thông báo chỉ xuất hiện khi user ĐANG đọc một lời nhắc hữu ích —
            đó là khoảnh khắc duy nhất trong app mà xin quyền thông báo có lý do rõ ràng. */}
        {pushConfig.enabled && !pushConfig.subscribed && (
          <button
            type="button"
            className="nudge-push-link"
            onClick={handleTogglePush}
            disabled={busy}
          >
            {busy ? 'Đang bật…' : '🔔 Nhắc tôi cả khi không mở app'}
          </button>
        )}
        {pushConfig.enabled && pushConfig.subscribed && (
          <button
            type="button"
            className="nudge-push-link subscribed"
            onClick={handleTogglePush}
            disabled={busy}
          >
            ✓ Đã bật nhắc nhở · tắt
          </button>
        )}
        {pushError && <span className="nudge-push-error">{pushError}</span>}
      </div>

      <div className="nudge-actions">
        {nudge.actionLabel && (
          <button type="button" className="nudge-act" onClick={handleAct}>
            {nudge.actionLabel}
          </button>
        )}
        <button
          type="button"
          className="nudge-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Bỏ qua lời nhắc"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
