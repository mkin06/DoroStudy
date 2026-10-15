import { useLanguage } from '../../hooks/useLanguage';
import { translate as t } from '../../lib/locale';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { getTourLayout } from './tourLayout';
import { captureEvent } from '../../lib/analytics';
import './OnboardingGuide.css';

const STEPS = [
  {
    id: 'task', target: 'task', interactive: true,
    title: 'Một phiên học, một việc rõ ràng',
    text: 'Ghi môn học hoặc việc bạn muốn hoàn thành vào đây. Bạn có thể thử nhập ngay, ví dụ “Ôn chương 2 môn Toán”.',
    hint: 'Nội dung bạn nhập sẽ được giữ lại sau hướng dẫn.',
  },
  {
    id: 'modes', target: 'modes',
    title: 'Học và nghỉ theo nhịp của bạn',
    text: 'Chọn Tập trung để học, Nghỉ ngắn để nghỉ giữa các phiên hoặc Nghỉ dài khi cần hồi sức. Thời gian của từng phần có thể thay đổi trong cài đặt.',
  },
  {
    id: 'settings', target: 'settings', interactive: true,
    title: 'Chọn bộ thời gian phù hợp',
    text: 'Bấm nút cài đặt đang được đánh dấu để chọn bộ thời gian có sẵn hoặc tạo bộ riêng cho cách học của bạn.',
    action: 'Mở cài đặt',
  },
  {
    id: 'start', target: 'start',
    title: 'Sẵn sàng thì bắt đầu',
    text: 'Nút này bắt đầu hoặc tạm dừng đồng hồ. Khi chuyển sang tab khác, thời gian vẫn được tính. Hết phiên học, giờ nghỉ sẽ bắt đầu.',
    hint: 'Bạn sẽ bắt đầu phiên học sau khi kết thúc hướng dẫn.',
  },
  {
    id: 'reflection', target: 'notifications',
    title: 'Hết giờ, dành một chút để nhìn lại',
    text: 'Chuông và tiêu đề tab báo khi có khảo sát sau phiên học. Trả lời ngắn về mức tập trung và năng lượng để nhận gợi ý từ AI cho lần học tiếp theo.',
    hint: 'Cho phép thông báo khi bắt đầu học để được nhắc ở tab khác.',
  },
  {
    id: 'space', target: 'tools',
    title: 'Sắp xếp góc học của bạn',
    text: 'Nhạc, hình nền và ghi chú nằm ở đây. Chọn không gian dễ tập trung và ghi lại những ý cần nhớ trong lúc học.',
  },
  {
    id: 'progress', target: 'progress',
    title: 'Nhìn lại nhịp học của mình',
    text: 'Mở hồ sơ tập trung để xem các phiên đã học và gợi ý cá nhân. Bạn luôn có thể xem lại hướng dẫn bằng nút dấu hỏi trên màn hình.',
  },
];

export const ONBOARDING_KEY = 'dorostudy.onboarding.v2';
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';

export default function OnboardingGuide({ onClose, settingsOpen, onOpenSettings, onCloseSettings }) {
  useLanguage();
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState(null);
  const cardRef = useRef(null);
  const nextButtonRef = useRef(null);
  const targetRef = useRef(null);
  const initialFocusRef = useRef(document.activeElement);
  const analyticsStartedRef = useRef(false);
  const analyticsStepRef = useRef(null);
  const analyticsFinishedRef = useRef(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const inSettings = current.id === 'settings' && settingsOpen;
  const targetName = inSettings ? 'custom-preset' : current.target;

  useEffect(() => {
    if (!analyticsStartedRef.current) {
      analyticsStartedRef.current = true;
      captureEvent('onboarding_started');
    }
    if (analyticsStepRef.current !== current.id) {
      analyticsStepRef.current = current.id;
      captureEvent('onboarding_step_viewed', { step_id: current.id, step_number: step + 1 });
    }
  }, [current.id, step]);

  const finish = useCallback((outcome = 'skipped') => {
    if (!analyticsFinishedRef.current) {
      analyticsFinishedRef.current = true;
      captureEvent(outcome === 'completed' ? 'onboarding_completed' : 'onboarding_skipped', {
        last_step: current.id,
      });
    }
    try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch { /* Tour also works without storage. */ }
    onCloseSettings?.();
    onClose?.();
  }, [current.id, onClose, onCloseSettings]);

  const goToStep = useCallback((next) => {
    onCloseSettings?.();
    setStep(next);
  }, [onCloseSettings]);

  useLayoutEffect(() => {
    let frame;
    let observedTarget;
    const updateLayout = () => {
      const target = document.querySelector(`[data-tour="${targetName}"]`);
      targetRef.current = target;
      const card = cardRef.current;
      if (!card) return;
      if (target !== observedTarget) {
        if (observedTarget) resizeObserver.unobserve(observedTarget);
        observedTarget = target;
        if (target) resizeObserver.observe(target);
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
      const visibleViewport = window.visualViewport;
      const viewport = {
        width: visibleViewport?.width ?? window.innerWidth,
        height: visibleViewport?.height ?? window.innerHeight,
        left: visibleViewport?.offsetLeft ?? 0,
        top: visibleViewport?.offsetTop ?? 0,
      };
      const editingPreset = target?.tagName === 'FORM';
      const settingsBackdrop = document.querySelector('.timer-settings-backdrop');
      if (settingsBackdrop) {
        settingsBackdrop.style.setProperty('--tour-viewport-height', `${viewport.height}px`);
        settingsBackdrop.style.setProperty('--tour-panel-offset', `${Math.min(210, viewport.height * .42)}px`);
      }
      let rect = target?.getBoundingClientRect();
      // A long form is clipped by its scrolling panel. Reveal its visible part,
      // so every visible field can be clicked without a shade intercepting it.
      if (rect) {
        rect = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
        for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (/auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)) {
            const clip = parent.getBoundingClientRect();
            rect.top = Math.max(rect.top, clip.top);
            rect.bottom = Math.min(rect.bottom, clip.bottom);
            rect.height = Math.max(0, rect.bottom - rect.top);
          }
        }
      }
      const next = getTourLayout(
        rect?.width && rect?.height ? rect : null,
        viewport,
        { width: card.offsetWidth, height: card.offsetHeight },
      );
      next.editingPreset = editingPreset;
      setLayout((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateLayout);
    };
    const resizeObserver = new ResizeObserver(schedule);
    if (cardRef.current) resizeObserver.observe(cardRef.current);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.getElementById('root'), { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('focusin', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    updateLayout();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      document.removeEventListener('focusin', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [targetName]);

  useEffect(() => {
    nextButtonRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key !== 'Tab') return;
      const target = current.interactive ? targetRef.current : null;
      const controls = [
        ...(target?.matches(FOCUSABLE) ? [target] : []),
        ...Array.from(target?.querySelectorAll(FOCUSABLE) || []),
        ...Array.from(cardRef.current?.querySelectorAll(FOCUSABLE) || []),
      ].filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return;
      event.preventDefault();
      const index = controls.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (index <= 0 ? controls.length - 1 : index - 1)
        : (index + 1) % controls.length;
      controls[nextIndex].focus();
    };
    const containFocus = (event) => {
      if (cardRef.current?.contains(event.target)) return;
      if (current.interactive && document.querySelector(`[data-tour="${targetName}"]`)?.contains(event.target)) return;
      nextButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', containFocus);
    };
  }, [current, finish, targetName]);

  useEffect(() => () => {
    const initial = initialFocusRef.current;
    if (initial?.isConnected && initial !== document.body) initial.focus({ preventScroll: true });
    else document.querySelector('[data-tour="help"]')?.focus({ preventScroll: true });
  }, []);

  const spotlight = layout?.spotlight;
  const arrowPosition = layout?.arrow ? {
    left: ['top', 'bottom'].includes(layout.side) ? layout.card.left + layout.arrow.left
      : layout.side === 'right' ? layout.card.left - 7 : layout.card.left + layout.card.width - 7,
    top: ['left', 'right'].includes(layout.side) ? layout.card.top + layout.arrow.top
      : layout.side === 'bottom' ? layout.card.top - 7 : layout.card.top + layout.card.height - 7,
  } : null;
  const editingPreset = inSettings && layout?.editingPreset;
  const title = editingPreset ? t("Thử bộ thời gian của bạn") : inSettings ? t("Tạo bộ thời gian riêng ngay tại đây") : current.title;
  const text = editingPreset ? t("Nhập tên và số phút, rồi chọn “Lưu và sử dụng”. Bạn có thể bấm hoặc dùng Tab để chuyển ô.") : inSettings
    ? t("Bấm “Tạo bộ thời gian riêng”, đặt tên rồi nhập số phút học và nghỉ. Lưu để sử dụng ngay; bạn cũng có thể tiếp tục hướng dẫn mà chưa cần tạo.")
    : current.text;

  return createPortal(
    <div className="onboarding-tour" data-step={current.id}>
      {spotlight ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: spotlight.top }} />
          <div className="tour-shade" style={{ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.height }} />
          <div className="tour-shade" style={{ top: spotlight.top, left: spotlight.right, right: 0, height: spotlight.height }} />
          <div className="tour-shade" style={{ top: spotlight.bottom, bottom: 0, left: 0, right: 0 }} />
          <div className="tour-spotlight" aria-hidden="true" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />
          {!current.interactive && <div className="tour-target-shield" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />}
        </>
      ) : <div className="tour-shade" style={{ inset: 0 }} />}

      <section ref={cardRef} className={`tour-card ${editingPreset ? 'editing-preset' : ''}`} role="dialog"
        aria-modal={!current.interactive} aria-labelledby="onboarding-title" aria-describedby="onboarding-description"
        style={{ left: layout?.card.left ?? 12, top: layout?.card.top ?? 12, maxHeight: layout?.card.maxHeight, visibility: layout ? 'visible' : 'hidden' }}>
        <div className="tour-card-topline">
          <span className="tour-step-count">{t("Hướng dẫn ·")}{step + 1}/{STEPS.length}</span>
          <button type="button" className="tour-dismiss" onClick={finish} aria-label={t("Bỏ qua hướng dẫn")} title={t("Bỏ qua hướng dẫn (Esc)")}><X size={16} /></button>
        </div>
        <div className="tour-progress" aria-label={t("Bước {0} trên {1}", [step + 1, STEPS.length])}>
          {STEPS.map((item, index) => <span key={item.id} className={index <= step ? 'active' : ''} />)}
        </div>
        <h2 id="onboarding-title">{t(title)}</h2>
        <p id="onboarding-description">{t(text)}</p>
        {current.hint && !inSettings && <p className="tour-hint">{t(current.hint)}</p>}
        {current.action && !inSettings && <button type="button" className="tour-try" onClick={onOpenSettings}>{t(current.action)}<ArrowRight size={15} /></button>}
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finish}>{t("Bỏ qua")}</button>
          <div className="tour-navigation">
            {step > 0 && <button type="button" className="tour-back" onClick={() => goToStep(step - 1)} aria-label={t("Bước trước")}><ArrowLeft size={16} /></button>}
            <button type="button" className="tour-next" ref={nextButtonRef} onClick={() => isLast ? finish('completed') : goToStep(step + 1)}>
              {isLast ? t("Bắt đầu học") : t("Tiếp theo")}{isLast ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </section>
      {arrowPosition && <span className={`tour-arrow ${layout.side}`} aria-hidden="true" style={arrowPosition} />}
    </div>, document.body,
  );
}
