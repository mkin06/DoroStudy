import React, { useCallback, useEffect, useRef, useState } from 'react';
import './NextSessionCard.css';
import { reflectionAPI } from '../../api/reflection';
import { adviceIcon } from '../../utils/adviceIcon';
import { scoreBand } from '../../utils/scoreLabel';

// Màu và nhãn cho phán quyết khung giờ. Ba trạng thái thật + một trạng thái "chưa biết" —
// và "chưa biết" phải nhìn khác hẳn ba cái kia, vì nói thẳng là chưa đủ dữ liệu đáng tin
// hơn nhiều so với tô một màu xanh giả vờ mọi thứ đều ổn.
const VERDICTS = {
  GOOD: { icon: '🟢', label: 'Giờ vàng của bạn', className: 'good' },
  OK: { icon: '🟡', label: 'Học được', className: 'ok' },
  POOR: { icon: '🟠', label: 'Khung giờ yếu', className: 'poor' },
  UNKNOWN: { icon: '⚪', label: 'Đang tìm hiểu bạn', className: 'unknown' },
};

/**
 * Thẻ "Phiên tiếp theo" — phần AI chạy TRƯỚC khi user bấm Start.
 *
 * Vì sao nó nằm ngay dưới ô Task chứ không nằm trong một trang thống kê riêng: lời khuyên
 * chỉ có tác dụng ở đúng nơi user ra quyết định. Đặt trong dashboard thì nó thành một biểu
 * đồ đẹp mà không ai đổi hành vi vì nó.
 *
 * Mặc định thu gọn thành một dòng: user vào app để học, không phải để đọc. Dòng thu gọn đã
 * mang đủ ba thứ quan trọng nhất (làm gì, bao lâu, dự đoán bao nhiêu điểm); mở rộng ra mới
 * là căn cứ và biện pháp chặn.
 *
 * Props:
 *  - subject:  môn user đang gõ ở ô Task, dùng để AI dự đoán cho đúng môn đó
 *  - disabled: đang chạy timer thì thẻ tự thu gọn và ngừng gọi lại API
 *  - onApply:  ({ durationMinutes, breakMinutes, subject }) => void — áp kế hoạch vào timer
 *  - refreshKey: đổi giá trị để buộc tải lại (ví dụ sau khi vừa xong một phiên)
 */
export default function NextSessionCard({ subject, disabled, onApply, refreshKey }) {
  const [plan, setPlan] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState(false);

  // Môn user gõ thay đổi liên tục theo từng phím; chỉ gọi lại API khi họ đã dừng gõ.
  const debounceRef = useRef(null);

  useEffect(() => {
    if (disabled) return undefined;

    let cancelled = false;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      reflectionAPI
        .getNextSession(subject || null)
        .then((data) => {
          if (cancelled) return;
          setPlan(data);
          setFailed(false);
        })
        .catch(() => {
          // Thẻ gợi ý hỏng thì im lặng biến mất, không chen một thông báo lỗi vào giữa
          // màn hình của người đang chuẩn bị học.
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, subject ? 500 : 0);

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [subject, disabled, refreshKey]);

  // Kế hoạch mới thì nút "Áp dụng" phải trở lại trạng thái chưa bấm
  useEffect(() => {
    setApplied(false);
  }, [plan?.durationMinutes, plan?.subject]);

  const handleApply = useCallback(() => {
    if (!plan) return;
    onApply?.({
      durationMinutes: plan.durationMinutes,
      breakMinutes: plan.breakMinutes,
      subject: plan.subject,
    });
    setApplied(true);
  }, [plan, onApply]);

  if (failed || loading || !plan || disabled) {
    return null;
  }

  const verdict = VERDICTS[plan.timingVerdict] || VERDICTS.UNKNOWN;
  const accuracy = plan.accuracy;
  // Cùng bộ nhãn với màn hình kết quả: "78" ở đây và "78" ở đó phải nghĩa như nhau
  const band = scoreBand(plan.predictedFocusScore);

  return (
    <section className={`coach-card ${verdict.className} ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="coach-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="coach-verdict" title={verdict.label}>{verdict.icon}</span>
        <span className="coach-headline">{plan.headline}</span>
        <span className="coach-prediction" title={`Dự đoán: ${band.label}`}>
          <span aria-hidden="true">{band.emoji}</span>
          <strong>{Math.round(plan.predictedFocusScore)}</strong>
          <span className="coach-prediction-label">dự đoán · {band.label}</span>
        </span>
        <span className="coach-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="coach-body">
          <p className={`coach-timing ${verdict.className}`}>
            {verdict.icon} {plan.timingMessage}
          </p>

          {plan.guardrail && (
            <p className="coach-guardrail">{adviceIcon(plan.guardrail, '🛡️')} {plan.guardrail}</p>
          )}

          {plan.streakMessage && (
            <p className="coach-streak">🔥 {plan.streakMessage}</p>
          )}

          {plan.reasons?.length > 0 && (
            <ul className="coach-reasons">
              {plan.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          <div className="coach-footer">
            <span className="coach-meta">
              {plan.personalized
                ? `Dựng từ ${plan.basedOnSessions} phiên của bạn · độ tin cậy ${plan.confidence}%`
                : `Gợi ý mặc định — cần thêm ${Math.max(0, 3 - plan.basedOnSessions)} phiên nữa để AI hiểu riêng bạn`}
              {accuracy?.sampleSize > 0
                && ` · AI đang đoán lệch trung bình ${accuracy.meanAbsoluteError} điểm`}
            </span>
            <button
              type="button"
              className="coach-apply"
              onClick={handleApply}
              disabled={applied}
            >
              {applied
                ? '✓ Đã đặt'
                : `Đặt ${plan.durationMinutes}′ ${plan.subject ? `· ${plan.subject}` : ''}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
