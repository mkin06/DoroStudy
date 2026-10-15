import { useCallback, useEffect, useRef, useState } from 'react';

// Production luôn chạy theo thời gian thật. Dev có thể tăng tốc để kiểm thử luồng kết thúc phiên.
const TICK_MS = import.meta.env.DEV
  ? (Number(import.meta.env.VITE_TIMER_TICK_MS) || 1000)
  : 1000;

/**
 * Đồng hồ đếm ngược dựa trên một mốc kết thúc tuyệt đối.
 *
 * Trình duyệt thường làm chậm setInterval ở tab nền. Nếu trừ từng giây theo mỗi callback,
 * đồng hồ sẽ đứng hoặc nhảy ngược khi người dùng quay lại. Hook này chỉ dùng interval để
 * cập nhật giao diện; thời gian còn lại luôn được tính từ Date.now().
 */
export default function useTimer(initialMinutes = 25) {
  const toSeconds = useCallback(
    (minutes) => Math.max(0, Math.round(Number(minutes || 0) * 60)),
    [],
  );

  const initialSeconds = toSeconds(initialMinutes);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const remainingRef = useRef(initialSeconds);
  const deadlineRef = useRef(null);
  const intervalRef = useRef(null);

  const updateRemaining = useCallback((next) => {
    remainingRef.current = next;
    setTotalSeconds(next);
  }, []);

  const syncWithClock = useCallback(() => {
    if (deadlineRef.current == null) return;

    const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    updateRemaining(remaining);
    if (remaining === 0) {
      deadlineRef.current = null;
      setIsRunning(false);
    }
  }, [updateRemaining]);

  useEffect(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current);
      return undefined;
    }

    syncWithClock();
    intervalRef.current = setInterval(syncWithClock, TICK_MS);
    document.addEventListener('visibilitychange', syncWithClock);
    window.addEventListener('focus', syncWithClock);
    window.addEventListener('pageshow', syncWithClock);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', syncWithClock);
      window.removeEventListener('focus', syncWithClock);
      window.removeEventListener('pageshow', syncWithClock);
    };
  }, [isRunning, syncWithClock]);

  const setTime = useCallback((newMinutes, startImmediately = false) => {
    const nextSeconds = toSeconds(newMinutes);
    updateRemaining(nextSeconds);

    if (startImmediately && nextSeconds > 0) {
      deadlineRef.current = Date.now() + nextSeconds * 1000;
      setIsRunning(true);
    } else {
      deadlineRef.current = null;
      setIsRunning(false);
    }
  }, [toSeconds, updateRemaining]);

  const toggleTimer = useCallback(() => {
    setIsRunning((running) => {
      if (running) {
        if (deadlineRef.current != null) {
          const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
          updateRemaining(remaining);
        }
        deadlineRef.current = null;
        return false;
      }

      if (remainingRef.current <= 0) return false;
      deadlineRef.current = Date.now() + remainingRef.current * 1000;
      return true;
    });
  }, [updateRemaining]);

  const resetTimer = useCallback(() => {
    deadlineRef.current = null;
    setIsRunning(false);
    updateRemaining(toSeconds(initialMinutes));
  }, [initialMinutes, toSeconds, updateRemaining]);

  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    isRunning,
    toggleTimer,
    resetTimer,
    setTime,
  };
}
