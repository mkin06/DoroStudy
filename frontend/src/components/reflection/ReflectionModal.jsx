import React, { useState, useCallback, useEffect, useRef } from 'react';
import './ReflectionModal.css';
import { reflectionAPI } from '../../api/reflection';
import { adviceIcon } from '../../utils/adviceIcon';
import { SCORE_EXPLAINER, deltaPhrase, scoreBand } from '../../utils/scoreLabel';

const FOCUS_LEVELS = [
  { value: 1, emoji: '😫', label: 'Rất kém' },
  { value: 2, emoji: '😕', label: 'Kém' },
  { value: 3, emoji: '😐', label: 'Tạm được' },
  { value: 4, emoji: '🙂', label: 'Tốt' },
  { value: 5, emoji: '🔥', label: 'Rất tập trung' },
];

// Đúng danh sách trong yêu cầu nghiệp vụ; id là khoá gửi lên backend, label để hiển thị.
const DISTRACTIONS = [
  { id: 'social_media', label: '📱 Mạng xã hội' },
  { id: 'noise', label: '🔊 Tiếng ồn' },
  { id: 'fatigue', label: '😴 Mệt mỏi' },
  { id: 'mind_wandering', label: '💭 Suy nghĩ lan man' },
  { id: 'none', label: '✅ Không xao nhãng' },
];

// Yêu cầu nghiệp vụ: popup chiếm tối đa 15 giây của user.
const COUNTDOWN_SECONDS = 15;

/**
 * Popup reflection sau mỗi phiên Pomodoro.
 *
 * Bốn câu hỏi, tất cả đều là chạm/kéo — không gõ chữ, nên vẫn vừa 15 giây. Câu năng lượng
 * là câu duy nhất được thêm so với bản đầu: nó là biến giải thích cho điểm tập trung
 * (hết pin hay bị xao nhãng?) và là dữ liệu để dựng ngưỡng cạn kiệt năng lượng.
 *
 * Màn hình kết quả cố ý ít chữ: một điểm số lớn, một hành động duy nhất cho phiên sau,
 * và những gì vừa mở khoá. Đoạn văn dài thì user đọc lần 1, lướt lần 2, bỏ qua lần 3.
 *
 * Props:
 *  - sessionId: id của study session vừa lưu
 *  - subject:   môn học/task hiện tại (optional, cho phép tag ngược)
 *  - onAdoptSubject: (subject) => void — dùng môn AI đoán được từ ghi chú cho phiên sau
 *  - onApplyPlan: ({durationMinutes, breakMinutes, subject}) => void — đặt luôn timer phiên sau
 *  - onClose:   đóng popup
 */
export default function ReflectionModal({
  sessionId, subject, onAdoptSubject, onApplyPlan, onClose,
}) {
  // step: 'questions' → 'loading' → 'feedback'
  const [step, setStep] = useState('questions');
  const [completionPercent, setCompletionPercent] = useState(70);
  const [focusLevel, setFocusLevel] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);
  const [distraction, setDistraction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [quotaNotice, setQuotaNotice] = useState(null);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  // Màn hình kết quả mặc định thu gọn. Người ta vừa học xong và đang muốn nghỉ, không phải
  // đang muốn đọc báo cáo — ai cần chi tiết thì bấm một cái là có.
  const [showDetails, setShowDetails] = useState(false);
  const [subjectAdopted, setSubjectAdopted] = useState(false);
  const [showScoreHelp, setShowScoreHelp] = useState(false);
  const [planApplied, setPlanApplied] = useState(false);

  // Bộ đếm chỉ phụ thuộc vào `step`. Handler và lựa chọn hiện tại đi qua ref để việc user
  // đổi slider/emoji không reset lại đồng hồ 15 giây.
  const submitRef = useRef(null);
  const closeRef = useRef(onClose);
  const focusLevelRef = useRef(focusLevel);

  const handleSubmit = useCallback(async () => {
    if (focusLevel === 0 || step !== 'questions') return;
    setStep('loading');
    setError(null);
    try {
      const result = await reflectionAPI.createReflection({
        sessionId,
        completionPercent,
        focusLevel,
        energyLevel: energyLevel || null,
        distractionReasons: distraction ? [distraction] : [],
        subject: subject || null,
      });
      setFeedback(result);
      setStep('feedback');
    } catch (err) {
      if (err.quotaExceeded) {
        // Hết lượt AI: reflection vẫn được lưu, điểm và phát hiện vẫn tính được
        setQuotaNotice(err.message);
        setFeedback(err.reflection || null);
        setStep('feedback');
        return;
      }
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      setStep('questions');
    }
  }, [sessionId, completionPercent, focusLevel, energyLevel, distraction, subject, step]);

  useEffect(() => {
    submitRef.current = handleSubmit;
    closeRef.current = onClose;
    focusLevelRef.current = focusLevel;
  }, [handleSubmit, onClose, focusLevel]);

  // Bộ đếm 15 giây, chỉ chạy ở bước trả lời câu hỏi
  useEffect(() => {
    if (step !== 'questions') return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        clearInterval(interval);
        // Đã chọn đủ thì gửi luôn, chưa chọn gì thì đóng — không chặn màn hình user
        if (focusLevelRef.current > 0) {
          submitRef.current?.();
        } else {
          closeRef.current?.();
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const countdownPercent = Math.round((secondsLeft / COUNTDOWN_SECONDS) * 100);
  const reward = feedback?.reward;
  const noteInsight = feedback?.noteInsight;
  const band = scoreBand(feedback?.focusScore);
  const delta = deltaPhrase(reward?.scoreDelta);
  const plan = feedback?.nextPlan;
  // Việc cụ thể phải làm ở phiên sau. Biện pháp chặn nhắm đúng thủ phạm số 1 nên nó thắng;
  // câu khuyên của AI là phương án dự phòng khi user chưa đủ dữ liệu để có biện pháp riêng.
  const action = plan?.guardrail || feedback?.recommendation;

  // "Vì sao" tối đa 2 dòng: một câu chẩn đoán của AI, một dòng thủ phạm rút thẳng từ
  // câu trả lời của user. Nhiều hơn hai dòng là quay lại đúng cái bệnh đọc mệt.
  const causes = [];
  if (feedback?.summary) {
    causes.push({ icon: '📋', text: feedback.summary });
  }
  const mainDistraction = DISTRACTIONS.find(
    (d) => d.id !== 'none' && feedback?.distractionReasons?.includes(d.id)
  );
  if (mainDistraction) {
    causes.push({ icon: mainDistraction.label.split(' ')[0], text: `${mainDistraction.label.split(' ').slice(1).join(' ')} là thứ kéo bạn ra khỏi phiên này` });
  } else if (feedback?.energyLevel != null && feedback.energyLevel <= 2) {
    causes.push({ icon: '🔋', text: 'Bạn kết thúc phiên trong tình trạng cạn năng lượng' });
  }

  // "Đang thấy ở bạn" — quy luật dài hơi, thứ khiến user quay lại chứ không phải điểm phiên này
  const strategy = [];
  if (feedback?.comparison) {
    strategy.push({ icon: '📈', text: feedback.comparison });
  }
  if (plan?.timingVerdict === 'POOR' && plan.betterWindowLabel) {
    strategy.push({
      icon: '🌟',
      text: `Bạn học ${plan.betterWindowLabel} hiệu quả hơn khung giờ vừa rồi`,
    });
  }

  const hasDetails = Boolean(
    reward?.newDiscoveries?.length || plan?.timingMessage
      || reward?.coachAccuracyPercent > 0 || feedback?.aiCallsRemaining != null
  );

  return (
    <div className="reflection-backdrop" role="dialog" aria-modal="true">
      <div className="reflection-modal">
        <button className="reflection-close" onClick={onClose} aria-label="Đóng">✕</button>

        {step === 'questions' && (
          <>
            <h2 className="reflection-title">Hoàn thành phiên học! 🎉</h2>
            <p className="reflection-subtitle">
              15 giây để AI hiểu phiên học của bạn — còn {secondsLeft}s
            </p>
            <div className="reflection-countdown" aria-hidden="true">
              <div className="reflection-countdown-bar" style={{ width: `${countdownPercent}%` }} />
            </div>

            {error && <div className="reflection-error">{error}</div>}

            <div className="reflection-question">
              <label htmlFor="reflection-completion">
                Bạn hoàn thành bao nhiêu % mục tiêu?
              </label>
              <div className="reflection-slider-row">
                <input
                  id="reflection-completion"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={completionPercent}
                  onChange={(e) => setCompletionPercent(Number(e.target.value))}
                />
                <span className="reflection-slider-value">{completionPercent}%</span>
              </div>
            </div>

            <div className="reflection-question">
              <span className="reflection-label">Mức độ tập trung của bạn?</span>
              <div className="reflection-emoji-row" role="radiogroup" aria-label="Mức độ tập trung">
                {FOCUS_LEVELS.map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={focusLevel === value}
                    className={`reflection-emoji ${focusLevel === value ? 'selected' : ''}`}
                    onClick={() => setFocusLevel(value)}
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="reflection-question">
              <span className="reflection-label">Năng lượng còn lại của bạn?</span>
              <div className="reflection-energy-row" role="radiogroup" aria-label="Mức năng lượng">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={energyLevel === value}
                    className={`reflection-energy ${energyLevel >= value ? 'filled' : ''}`}
                    onClick={() => setEnergyLevel(value)}
                    title={`${value}/5`}
                  >
                    ⚡
                  </button>
                ))}
              </div>
            </div>

            <div className="reflection-question">
              <span className="reflection-label">Tác nhân xao nhãng chính?</span>
              <div className="reflection-chips" role="radiogroup" aria-label="Tác nhân xao nhãng">
                {DISTRACTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={distraction === id}
                    className={`reflection-chip ${distraction === id ? 'selected' : ''}`}
                    onClick={() => setDistraction((prev) => (prev === id ? null : id))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="reflection-actions">
              <button className="reflection-skip" onClick={onClose}>Bỏ qua</button>
              <button
                className="reflection-submit"
                onClick={handleSubmit}
                disabled={focusLevel === 0}
                title={focusLevel === 0 ? 'Chọn mức độ tập trung trước' : ''}
              >
                Xem kết quả
              </button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="reflection-loading">
            <div className="reflection-spinner" aria-hidden="true" />
            <p>Đang phân tích phiên học của bạn…</p>
          </div>
        )}

        {step === 'feedback' && feedback && (
          <div className="reflection-result">
            {/* Đọc TỪ trước, số sau. Người vừa học xong không nên phải tự dịch "78" thành
                "tốt hay tệ" — đó là việc của app. Con số vẫn giữ vì mọi phần khác dựa vào nó. */}
            <div className={`reflection-score ${band.className}`}>
              <span className="reflection-score-emoji" aria-hidden="true">{band.emoji}</span>
              <span className="reflection-score-band">{band.label}</span>
              {delta && (
                <span className={`reflection-delta ${delta.direction}`}>{delta.text}</span>
              )}
              <button
                type="button"
                className="reflection-score-meta"
                onClick={() => setShowScoreHelp((v) => !v)}
                aria-expanded={showScoreHelp}
                title="Điểm này tính kiểu gì?"
              >
                {Math.round(feedback.focusScore ?? 0)}/100
                {reward?.sessionNumber ? ` · phiên #${reward.sessionNumber}` : ''} ⓘ
              </button>
              {showScoreHelp && <p className="reflection-score-help">{SCORE_EXPLAINER}</p>}
            </div>

            {/* Huy hiệu chỉ còn icon + một hai chữ: dòng này để liếc, không để đọc */}
            <div className="reflection-badges">
              {reward?.personalBest && <span className="reflection-badge best">⭐ Kỷ lục</span>}
              {reward?.currentStreakDays > 1 && (
                <span className="reflection-badge streak">🔥 {reward.currentStreakDays} ngày</span>
              )}
              {reward?.predictedFocusScore != null && (
                <span className="reflection-badge predict" title="Điểm AI đoán trước khi bạn học">
                  🔮 đoán {Math.round(reward.predictedFocusScore)}
                  {' · lệch '}{Math.round(reward.predictionErrorPoints ?? 0)}
                </span>
              )}
            </div>

            {quotaNotice && <div className="reflection-error">{quotaNotice}</div>}

            {!quotaNotice && !feedback.aiAvailable && (
              <p className="reflection-unavailable">
                ⚙️ AI đang bận — điểm và phát hiện vẫn được tính đầy đủ.
              </p>
            )}

            {/* Điều AI đọc được từ ghi chú: nguồn dữ liệu duy nhất không phải lời tự khai */}
            {noteInsight && (
              <div className={`reflection-note-insight ${noteInsight.verdict.toLowerCase()}`}>
                <span className="reflection-note-icon" aria-hidden="true">{noteInsight.icon}</span>
                <span className="reflection-note-text">{noteInsight.message}</span>
                {noteInsight.detectedSubject && onAdoptSubject && (
                  <button
                    type="button"
                    className="reflection-note-adopt"
                    onClick={() => {
                      onAdoptSubject(noteInsight.detectedSubject);
                      setSubjectAdopted(true);
                    }}
                    disabled={subjectAdopted}
                  >
                    {subjectAdopted ? '✓' : `Dùng ${noteInsight.detectedSubject}`}
                  </button>
                )}
              </div>
            )}

            {/* ===== VÌ SAO ===== Một dòng chẩn đoán, một dòng thủ phạm. Không có phần này
                thì lời khuyên bên dưới trở thành mệnh lệnh không rõ lý do. */}
            {causes.length > 0 && (
              <section className="reflection-block">
                <span className="reflection-block-label">Vì sao</span>
                {causes.map((c) => (
                  <p key={c.text} className="reflection-line">
                    <span aria-hidden="true">{c.icon}</span> {c.text}
                  </p>
                ))}
              </section>
            )}

            {/* ===== PHIÊN SAU ===== Phần quan trọng nhất màn hình.
                Ba con số dạng chip thay cho một câu văn: user cần biết ĐẶT BAO NHIÊU PHÚT,
                HỌC MÔN GÌ, LÚC MẤY GIỜ — và bấm một cái là timer tự đặt xong. */}
            <section className="reflection-block plan">
              <span className="reflection-block-label">Phiên sau</span>

              {plan ? (
                <>
                  <div className="reflection-plan-chips">
                    <span className="reflection-plan-chip">⏱️ {plan.durationMinutes} phút</span>
                    {plan.subject && (
                      <span className="reflection-plan-chip">📚 {plan.subject}</span>
                    )}
                    {plan.betterWindowHour != null && (
                      <span className="reflection-plan-chip">
                        🕗 {String(plan.betterWindowHour).padStart(2, '0')}:00
                      </span>
                    )}
                    {onApplyPlan && (
                      <button
                        type="button"
                        className="reflection-plan-apply"
                        onClick={() => {
                          onApplyPlan({
                            durationMinutes: plan.durationMinutes,
                            breakMinutes: plan.breakMinutes,
                            subject: plan.subject,
                          });
                          setPlanApplied(true);
                        }}
                        disabled={planApplied}
                      >
                        {planApplied ? '✓ Đã đặt' : 'Áp dụng'}
                      </button>
                    )}
                  </div>

                  {/* Ưu tiên biện pháp chặn (nhắm đúng thủ phạm số 1 của user); không có
                      thì dùng câu khuyên của AI. Khối này phải LUÔN có một việc để làm —
                      ba con số mà không kèm hành động thì user vẫn không biết bắt đầu từ đâu. */}
                  {action && (
                    <p className="reflection-line action">
                      <span aria-hidden="true">{adviceIcon(action, '🛡️')}</span> {action}
                    </p>
                  )}
                </>
              ) : (
                action && (
                  <p className="reflection-line action">
                    <span aria-hidden="true">{adviceIcon(action)}</span> {action}
                  </p>
                )
              )}
            </section>

            {/* ===== ĐANG THẤY ===== Chiến lược dài hơi: quy luật hệ thống đã xác minh.
                Hiện mặc định chứ không giấu — đây là lý do user quay lại, không phải phần phụ. */}
            {(strategy.length > 0 || reward?.newDiscoveries?.length > 0) && (
              <section className="reflection-block">
                <span className="reflection-block-label">Đang thấy ở bạn</span>
                {strategy.map((line) => (
                  <p key={line.text} className="reflection-line">
                    <span aria-hidden="true">{line.icon}</span> {line.text}
                  </p>
                ))}
                {reward?.newDiscoveries?.length > 0 && (
                  <div className="reflection-unlocked-row">
                    {reward.newDiscoveries.map((d) => (
                      <span key={d.id} className="reflection-unlocked-chip" title={d.detail}>
                        {d.icon} {d.title} · mới
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Phần còn lại — bằng chứng chi tiết, độ chính xác, quota — nằm sau một cú bấm */}
            {hasDetails && (
              <button
                type="button"
                className="reflection-details-toggle"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
              >
                {showDetails ? 'Ẩn chi tiết ▲' : 'Xem chi tiết ▼'}
              </button>
            )}

            {showDetails && (
              <div className="reflection-details">
                {reward?.newDiscoveries?.map((d) => (
                  <div key={d.id} className="reflection-discovery">
                    <span className="reflection-discovery-icon">{d.icon}</span>
                    <div>
                      <strong>{d.title}</strong>
                      <p>{d.detail}</p>
                      <span className="reflection-discovery-evidence">
                        {d.evidence} · độ tin cậy {d.confidence}%
                      </span>
                    </div>
                  </div>
                ))}

                {plan?.timingMessage && (
                  <p className="reflection-detail-line">🕗 {plan.timingMessage}</p>
                )}
                {reward?.coachAccuracyPercent > 0 && (
                  <p className="reflection-detail-line muted">
                    🎯 Độ chính xác dự đoán của AI trên hồ sơ của bạn: {reward.coachAccuracyPercent}%
                  </p>
                )}
                {feedback.aiCallsRemaining != null && (
                  <p className="reflection-detail-line muted">
                    ⚡ Còn {feedback.aiCallsRemaining} lượt phân tích AI hôm nay.
                  </p>
                )}
              </div>
            )}

            {/* Móc kéo user quay lại: cho họ thấy chính xác cái gì đang chờ ở phiên sau */}
            {reward?.nextUnlockName && reward?.sessionsToNextUnlock > 0 && (
              <div className="reflection-unlock">
                🔓 Còn <strong>{reward.sessionsToNextUnlock} phiên</strong> nữa:
                {' '}<strong>{reward.nextUnlockName}</strong>
              </div>
            )}

            <div className="reflection-actions">
              <button className="reflection-submit" onClick={onClose}>Xong</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
