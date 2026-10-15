import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import { useEffect, useRef, useState } from 'react';
import { Check, MessageSquareText, X } from 'lucide-react';
import { feedbackLifecycle, latestFeedbackReflection, newFeedbackSubmission, sendFeedback } from '../../lib/feedback';
import { ACTIONABILITY, AREAS, COMMENT_LIMIT, COMMON_ACTIONS, COPING_ACTIONS, DISTRACTIONS, ISSUE_TYPES, OUTCOMES, SUPPORTS } from '../../lib/feedbackSchema';
import './FeedbackDialog.css';

const EMPTY_AI = { usefulness: 0, actionability: '', comment: '', distraction: '', coping_action: '', outcome: '', requested_support: '' };
const EMPTY_UX = { comment: '', area: '', issue_type: '' };

function SelectQuestion({ id, label, options, value, onChange }) {
  useLanguage();
  return <label className="df-select" htmlFor={id}>
    <span>{t(label)}</span>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} required>
      <option value="">{t("Chọn câu trả lời")}</option>
      {options.map(([code, text]) => <option key={code} value={code}>{t(text)}</option>)}
    </select>
  </label>;
}

export default function FeedbackDialog({ initialKind = 'ux', initialReflection = null, userId, entryPoint = 'feedback_button', onClose }) {
  const { language } = useLanguage();
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const submissionRef = useRef(null);
  const shownKinds = useRef(new Set());
  const sentKinds = useRef(new Set());
  const [kind, setKind] = useState(initialKind);
  const [drafts, setDrafts] = useState({ ai: EMPTY_AI, ux: EMPTY_UX });
  const [incidentEnabled, setIncidentEnabled] = useState(false);
  const [reflection, setReflection] = useState(initialReflection);
  const [loading, setLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(Boolean(initialReflection));
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [lookupError, setLookupError] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const answers = drafts[kind];

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);

  // Reuse the existing, bounded history API only when someone asks to rate AI.
  useEffect(() => {
    if (kind !== 'ai' || initialReflection || !userId || lookupDone) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setLookupError(null);
    latestFeedbackReflection(controller.signal)
      .then(result => { if (!controller.signal.aborted) { setReflection(result); setLoading(false); setLookupDone(true); } })
      .catch(err => { if (!controller.signal.aborted) { setLookupError(err.message); setLoading(false); setLookupDone(true); } });
    return () => controller.abort();
  }, [kind, initialReflection, userId, lookupDone, lookupAttempt]);

  useEffect(() => {
    const eligible = kind === 'ux' || Boolean(reflection?.id);
    if (eligible && !shownKinds.current.has(kind)) {
      shownKinds.current.add(kind);
      feedbackLifecycle(kind, 'shown', entryPoint);
    }
  }, [kind, reflection, entryPoint]);

  useEffect(() => {
    if (error) dialogRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  function close() {
    for (const shown of shownKinds.current) {
      if (!sentKinds.current.has(shown)) feedbackLifecycle(shown, 'dismissed', entryPoint);
    }
    onClose();
  }

  function change(key, value) {
    setDrafts(previous => ({ ...previous, [kind]: { ...previous[kind], [key]: value } }));
  }

  const hasIncident = incidentEnabled && answers.distraction && answers.distraction !== 'none';
  const incidentComplete = !incidentEnabled || (answers.distraction && (!hasIncident || (answers.coping_action && answers.outcome && answers.requested_support)));
  const valid = kind === 'ux'
    ? answers.comment.trim().length >= 3 && answers.area && answers.issue_type
    : reflection?.id && answers.usefulness && answers.actionability && incidentComplete;

  async function submit(event) {
    event.preventDefault();
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSending(true); setError(null);
    const values = { ...answers };
    if (kind === 'ai' && !incidentEnabled) {
      for (const key of ['distraction', 'coping_action', 'outcome', 'requested_support']) delete values[key];
    }
    const fingerprint = JSON.stringify({ kind, values, reflectionId: kind === 'ai' ? reflection?.id : null });
    if (submissionRef.current?.fingerprint !== fingerprint) submissionRef.current = { fingerprint, submission: newFeedbackSubmission() };
    try {
      await sendFeedback({ kind, values, reflection, entryPoint, submission: submissionRef.current.submission });
      sentKinds.current.add(kind);
      setSent(true);
    } catch (err) {
      setError(['TypeError', 'TimeoutError', 'AbortError'].includes(err.name)
        ? t("Chưa gửi được góp ý. Hãy kiểm tra mạng hoặc trình chặn nội dung; câu trả lời vẫn còn để bạn thử lại.")
        : err.message);
    } finally { submittingRef.current = false; setSending(false); }
  }

  function downloadComment() {
    const text = `DoroStudy — ${kind === 'ai' ? 'AI Reflection' : t("Giao diện & trải nghiệm")}\n\n${answers.comment}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'dorostudy-gop-y.txt';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const showForm = kind === 'ux' || Boolean(reflection?.id);
  return <dialog className="df-dialog ph-no-capture" ref={dialogRef} aria-labelledby="df-title" lang={language} onCancel={close}>
    <header className="df-header">
      <div><span className="df-eyebrow"><MessageSquareText size={14} aria-hidden="true" />{t("DOROSTUDY / LẮNG NGHE BẠN")}</span>
        <h2 id="df-title">{sent ? t("Cảm ơn bạn đã chia sẻ!") : t("Góp ý để mỗi phiên học tốt hơn")}</h2>
      </div>
      <button className="df-close" type="button" onClick={close} aria-label={t("Đóng góp ý")}><X size={19} /></button>
    </header>
    {sent ? <div className="df-state" role="status">
      <span className="df-success"><Check size={26} /></span>
      <p>{t("Góp ý của bạn đã được gửi tới nhóm.")}</p>
      <p className="df-muted">{t("Nhóm sẽ đọc nhận xét cùng số liệu sử dụng để ưu tiên cải thiện sản phẩm.")}</p>
      <button type="button" className="df-primary" onClick={close}>{t("Quay lại học")}</button>
    </div> : <>
      <p className="df-intro">{t("Chia sẻ điều chưa thuận tiện, điều có ích hoặc cách bạn muốn app hỗ trợ. Bạn có thể bỏ qua bất cứ lúc nào.")}</p>
      <div className="df-kind" role="group" aria-label={t("Loại góp ý")}>
        <button type="button" aria-pressed={kind === 'ai'} disabled={sending} onClick={() => { setKind('ai'); setError(null); }}>AI Reflection</button>
        <button type="button" aria-pressed={kind === 'ux'} disabled={sending} onClick={() => { setKind('ux'); setError(null); }}>{t("Giao diện & trải nghiệm")}</button>
      </div>
      {error && <div className="df-error" role="alert"><p>{t(error)}</p>{answers.comment.trim() && <button type="button" onClick={downloadComment}>{t("Tải nội dung nhận xét về máy")}</button>}</div>}
      {!showForm && (loading || (userId && !lookupDone)) ? <p className="df-state" role="status">{t("Đang mở phản hồi phiên học gần nhất…")}</p>
        : !showForm ? <div className="df-state">
          <p>{lookupError || (userId ? t("Bạn chưa có phản hồi sau phiên học để đánh giá.") : t("Hãy đăng nhập và trải nghiệm AI Reflection trước khi đánh giá."))}</p>
          <p className="df-muted">{t("Bạn vẫn có thể viết góp ý về giao diện và trải nghiệm ngay bây giờ, không cần đăng nhập.")}</p>
          {lookupError && <button type="button" className="df-secondary" onClick={() => { setLookupDone(false); setLookupAttempt(n => n + 1); }}>{t("Thử tải lại")}</button>}
          <button type="button" className="df-primary" onClick={() => setKind('ux')}>{t("Viết góp ý UX/UI")}</button>
        </div>
        : <form onSubmit={submit}>
          <fieldset className="df-fields" disabled={sending}>
            {kind === 'ai' && <>
              <div className="df-context"><span>{t("Phản hồi bạn đang đánh giá")}</span><p>{t(reflection.nextPlan?.guardrail || reflection.recommendation || reflection.summary)}</p>
                {!reflection.aiAvailable && <small>{t("Đây là phản hồi dự phòng. Bạn vẫn có thể góp ý về nội dung và cách trình bày.")}</small>}
              </div>
              <fieldset className="df-question">
                <legend>{t("1. Phản hồi này hữu ích với bạn ở mức nào?")}</legend>
                <div className="df-rating">{[1, 2, 3, 4, 5].map(value => <label key={value} className={answers.usefulness === value ? 'selected' : ''}>
                  <input type="radio" name="usefulness" checked={answers.usefulness === value} value={value} onChange={() => change('usefulness', value)} required /><span>{value}</span>
                </label>)}</div>
                <div className="df-scale"><span>{t("1 · Không hữu ích")}</span><span>{t("5 · Rất hữu ích")}</span></div>
              </fieldset>
              <fieldset className="df-question"><legend>{t("2. Bạn có biết cần làm gì ở phiên tiếp theo không?")}</legend>
                <div className="df-choices">{ACTIONABILITY.map(([code, text]) => <label key={code} className={answers.actionability === code ? 'selected' : ''}>
                  <input type="radio" name="actionability" value={code} checked={answers.actionability === code} onChange={() => change('actionability', code)} required /><span>{t(text)}</span>
                </label>)}</div>
              </fieldset>
            </>}

            <label className="df-comment" htmlFor="df-comment">{kind === 'ux' ? t("Bạn muốn nhóm cải thiện điều gì?") : t("Điều gì trong phản hồi AI cần cải thiện?")} <span>{kind === 'ux' ? t("(bắt buộc)") : t("(tùy chọn)")}</span>
              <textarea id="df-comment" className="ph-no-capture" maxLength={COMMENT_LIMIT} minLength={kind === 'ux' ? 3 : undefined} required={kind === 'ux'} rows={4} value={answers.comment} onChange={event => change('comment', event.target.value)}
                placeholder={kind === 'ux' ? t("Ví dụ: Khi muốn tạm dừng vì tiếng ồn, tôi không tìm thấy nút ngay. Tôi mong nút tạm dừng dễ nhận ra hơn…") : t("Ví dụ: Lời khuyên nhắc lại việc tôi đã biết. Tôi cần cách xử lý tiếng ồn phù hợp với việc học ở phòng trọ…")} />
            </label>
            <div className="df-comment-hint"><span>{t("Hãy kể bạn đang làm gì, vướng ở đâu và mong điều gì thay đổi.")}</span><span>{answers.comment.length}/{COMMENT_LIMIT}</span></div>

            {kind === 'ux' ? <div className="df-ux-selects">
              <SelectQuestion id="df-area" label={t("Góp ý này thuộc phần nào?")} options={AREAS} value={answers.area} onChange={value => change('area', value)} />
              <SelectQuestion id="df-issue" label={t("Điều bạn muốn chia sẻ là gì?")} options={ISSUE_TYPES} value={answers.issue_type} onChange={value => change('issue_type', value)} />
            </div> : <div className="df-optional">
              <button className="df-expand" type="button" aria-expanded={incidentEnabled} aria-controls="df-incident" onClick={() => setIncidentEnabled(!incidentEnabled)}>
                <span><strong>{t("Kể thêm cách bạn xử lý xao nhãng")}</strong><small>{t("Tùy chọn · Giúp lời khuyên sát thực tế hơn")}</small></span><span aria-hidden="true">{incidentEnabled ? '−' : '+'}</span>
              </button>
              {incidentEnabled && <div id="df-incident" className="df-incident">
                <p className="df-muted">{t("Chỉ nói về phiên vừa được phản hồi. Nếu có nhiều tác nhân, chọn tác nhân ảnh hưởng nhất.")}</p>
                <SelectQuestion id="df-distraction" label={t("Điều gì khiến bạn xao nhãng nhất?")} options={DISTRACTIONS} value={answers.distraction} onChange={value => setDrafts(previous => ({ ...previous, ai: { ...previous.ai, distraction: value, coping_action: '', outcome: '', requested_support: '' } }))} />
                {hasIncident && <>
                  <SelectQuestion id="df-action" label={t("Bạn đã xử lý thế nào? Chọn cách chính đã dùng.")} options={[...(COPING_ACTIONS[answers.distraction] || []), ...COMMON_ACTIONS]} value={answers.coping_action} onChange={value => change('coping_action', value)} />
                  <SelectQuestion id="df-outcome" label={t("Sau đó, bạn có quay lại học được không?")} options={OUTCOMES} value={answers.outcome} onChange={value => change('outcome', value)} />
                  <SelectQuestion id="df-support" label={t("Trong tình huống này, bạn muốn app hỗ trợ điều gì nhất?")} options={SUPPORTS} value={answers.requested_support} onChange={value => change('requested_support', value)} />
                </>}
              </div>}
            </div>}
          </fieldset>
          <p className="df-privacy">{t("Khi bấm gửi, nhận xét và lựa chọn của bạn được gửi đến PostHog cùng mã khách/tài khoản để nhóm cải thiện sản phẩm. Không nhập mật khẩu, email hoặc thông tin riêng tư. Nội dung đang gõ không được gửi tự động.")}</p>
          <div className="df-actions"><button type="button" className="df-secondary" onClick={close}>{t("Để sau")}</button><button type="submit" className="df-primary" disabled={sending || !valid}>{sending ? t("Đang gửi…") : t("Gửi góp ý")}</button></div>
        </form>}
    </>}
  </dialog>;
}
