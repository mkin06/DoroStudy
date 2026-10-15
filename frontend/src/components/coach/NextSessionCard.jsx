import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Clock3, Flame, ShieldCheck } from 'lucide-react';
import './NextSessionCard.css';
import { reflectionAPI } from '../../api/reflection';
import { scoreBand } from '../../utils/scoreLabel';
import { captureEvent } from '../../lib/analytics';

// Màu và nhãn cho phán quyết khung giờ. Ba trạng thái thật + một trạng thái "chưa biết" —
// và "chưa biết" phải nhìn khác hẳn ba cái kia, vì nói thẳng là chưa đủ dữ liệu đáng tin
// hơn nhiều so với tô một màu xanh giả vờ mọi thứ đều ổn.
const VERDICTS = {
  GOOD: { label: 'Giờ vàng của bạn', className: 'good' },
  OK: { label: 'Học được', className: 'ok' },
  POOR: { label: 'Khung giờ yếu', className: 'poor' },
  UNKNOWN: { label: 'Đang tìm hiểu bạn', className: 'unknown' },
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
export default function NextSessionCard({ subject, disabled, onApply, refreshKey, userId }) {
  useLanguage();
  const [plan, setPlan] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState(false);

  // Môn user gõ thay đổi liên tục theo từng phím; chỉ gọi lại API khi họ đã dừng gõ.
  const debounceRef = useRef(null);

  useEffect(() => {
    if (disabled || !userId) return undefined;

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
  }, [subject, disabled, refreshKey, userId]);

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
    captureEvent('ai_plan_applied', { source: 'next_session_card', duration_minutes: plan.durationMinutes });
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
        <span className="coach-intro">
          <span className="coach-eyebrow">
            <span className="coach-verdict" aria-hidden="true" />{t("Gợi ý cho phiên tới")}</span>
          <span className="coach-headline">{t(plan.headline)}</span>
        </span>
        <span className="coach-prediction" title={t("Dự đoán: {0}", [band.label])}
          aria-label={t("Điểm dự kiến {0}: {1}", [Math.round(plan.predictedFocusScore), band.label])}>
          <strong>{Math.round(plan.predictedFocusScore)}</strong>
          <span className="coach-prediction-label">{t("Điểm dự kiến")}<br />{t(band.label)}</span>
        </span>
        <ChevronDown className="coach-chevron" size={17} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="coach-body">
          <p className={`coach-timing ${verdict.className}`}>
            <Clock3 size={17} aria-hidden="true" />
            <span><strong>{t(verdict.label)}</strong>{t(plan.timingMessage)}</span>
          </p>

          {plan.guardrail && (
            <p className="coach-guardrail"><ShieldCheck size={17} aria-hidden="true" /><span>{t(plan.guardrail)}</span></p>
          )}

          {plan.streakMessage && (
            <p className="coach-streak"><Flame size={17} aria-hidden="true" /><span>{t(plan.streakMessage)}</span></p>
          )}

          {plan.reasons?.length > 0 && (
            <ul className="coach-reasons">
              {plan.reasons.map((reason) => (
                <li key={reason}>{t(reason)}</li>
              ))}
            </ul>
          )}

          <div className="coach-footer">
            <span className="coach-meta">
              {plan.personalized
                ? t("Dựa trên {0} phiên của bạn · độ tin cậy {1}%", [plan.basedOnSessions, plan.confidence])
                : t("Gợi ý mặc định — cần thêm {0} phiên nữa để AI hiểu riêng bạn", [Math.max(0, 3 - plan.basedOnSessions)])}
              {accuracy?.sampleSize > 0
                && t(" · AI đang đoán lệch trung bình {0} điểm", [accuracy.meanAbsoluteError])}
            </span>
            <button
              type="button"
              className="coach-apply"
              onClick={handleApply}
              disabled={applied}
            >
              {applied
                ? <><Check size={16} aria-hidden="true" />{t("Đã đặt")}</>
                : <>{t("Đặt")}{plan.durationMinutes}{t("phút")}{plan.subject ? `· ${plan.subject}` : ''}<ArrowRight size={16} aria-hidden="true" /></>}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
