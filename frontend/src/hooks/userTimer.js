//tận dụng cho stopwatch và userTimer sau này
// Tái sử dụng logic.
// Tách biệt logic và giao diện.
// Dễ dàng kiểm tra và bảo trì.
// Quản lý trạng thái hiệu quả.
// Mở rộng tính năng dễ dàng.

//quản lý trạng thái và logic của bộ đếm thời gian
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Nhịp đồng hồ tính bằng ms. Mặc định 1000 = thời gian thật.
 *
 * Khi cần test nhanh luồng "kết thúc phiên -> popup reflection -> feedback AI" mà không
 * phải ngồi chờ đủ 25 phút, đặt VITE_TIMER_TICK_MS trong frontend/.env rồi khởi động lại
 * dev server (Vite chỉ đọc .env lúc start):
 *
 *   VITE_TIMER_TICK_MS=50    -> phiên 25 phút chạy hết trong 75 giây
 *   VITE_TIMER_TICK_MS=20    -> phiên 25 phút chạy hết trong 30 giây
 *
 * Để qua env thay vì sửa thẳng số 1000 ở dưới, vì sửa tay rất dễ lỡ commit một đồng hồ
 * chạy nhanh gấp 20 lần lên production. frontend/.env đã nằm trong .gitignore.
 */
const TICK_MS = Number(import.meta.env.VITE_TIMER_TICK_MS) || 1000;

export default function useTimer(initialMinutes = 25, isCountUp = false) {
    const toSeconds = useCallback((valueInMinutes) => {
        return Math.max(0, Math.round(Number(valueInMinutes || 0) * 60));
    }, []);

    const [totalSeconds, setTotalSeconds] = useState(() => (isCountUp ? 0 : toSeconds(initialMinutes)));
    const [isRunning, setIsRunning] = useState(false);
    
    const isRunningRef = useRef(isRunning);
    const isCountUpRef = useRef(isCountUp);
    const lastTimestampRef = useRef(null);
    const workerRef = useRef(null);
    const intervalFallbackRef = useRef(null);
    const prevCountUpRef = useRef(isCountUp);

    isRunningRef.current = isRunning;
    isCountUpRef.current = isCountUp;

    // Khi chuyển đổi giữa countdown (focus) và countup (stopwatch)
    useEffect(() => {
        if (prevCountUpRef.current !== isCountUp) {
            prevCountUpRef.current = isCountUp;
            setIsRunning(false);
            lastTimestampRef.current = null;
            if (isCountUp) {
                setTotalSeconds(0);
            } else {
                setTotalSeconds(toSeconds(initialMinutes));
            }
        }
    }, [isCountUp, initialMinutes, toSeconds]);

    // Hàm cập nhật thời gian chuẩn xác theo Date.now()
    const tick = useCallback(() => {
        if (!isRunningRef.current || lastTimestampRef.current === null) return;

        const now = Date.now();
        const elapsedMs = now - lastTimestampRef.current;
        if (elapsedMs < TICK_MS) return;

        const elapsedSeconds = Math.floor(elapsedMs / TICK_MS);
        if (elapsedSeconds <= 0) return;

        lastTimestampRef.current += elapsedSeconds * TICK_MS;

        setTotalSeconds((prev) => {
            if (isCountUpRef.current) {
                return prev + elapsedSeconds;
            }
            if (prev <= elapsedSeconds) {
                setIsRunning(false);
                lastTimestampRef.current = null;
                return 0;
            }
            return prev - elapsedSeconds;
        });
    }, []);

    // Khởi tạo Web Worker để tránh việc browser throttle/đóng băng timer khi chuyển sang tab khác
    useEffect(() => {
        const workerScript = `
            let intervalId = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (intervalId) clearInterval(intervalId);
                    intervalId = setInterval(() => {
                        self.postMessage('tick');
                    }, Math.min(250, ${TICK_MS}));
                } else if (e.data === 'stop') {
                    if (intervalId) clearInterval(intervalId);
                    intervalId = null;
                }
            };
        `;

        try {
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            workerRef.current = new Worker(workerUrl);

            workerRef.current.onmessage = () => {
                tick();
            };

            return () => {
                if (workerRef.current) {
                    workerRef.current.terminate();
                    workerRef.current = null;
                }
                URL.revokeObjectURL(workerUrl);
            };
        } catch (e) {
            console.warn('Web Worker not available, falling back to interval:', e);
        }
    }, [tick]);

    // Bắt đầu / dừng worker khi isRunning thay đổi
    useEffect(() => {
        if (isRunning) {
            lastTimestampRef.current = Date.now();
            if (workerRef.current) {
                workerRef.current.postMessage('start');
            } else {
                intervalFallbackRef.current = setInterval(() => {
                    tick();
                }, Math.min(250, TICK_MS));
            }
        } else {
            lastTimestampRef.current = null;
            if (workerRef.current) {
                workerRef.current.postMessage('stop');
            }
            if (intervalFallbackRef.current) {
                clearInterval(intervalFallbackRef.current);
                intervalFallbackRef.current = null;
            }
        }

        return () => {
            if (intervalFallbackRef.current) {
                clearInterval(intervalFallbackRef.current);
                intervalFallbackRef.current = null;
            }
        };
    }, [isRunning, tick]);

    // Lắng nghe khi user quay lại tab (visibilitychange / focus) để đồng bộ thời gian tức thì
    useEffect(() => {
        const handleSync = () => {
            if (isRunningRef.current) {
                tick();
            }
        };

        document.addEventListener('visibilitychange', handleSync);
        window.addEventListener('focus', handleSync);

        return () => {
            document.removeEventListener('visibilitychange', handleSync);
            window.removeEventListener('focus', handleSync);
        };
    }, [tick]);

    const setTime = useCallback((newMinutes) => {
        setTotalSeconds(toSeconds(newMinutes));
        setIsRunning(false);
        lastTimestampRef.current = null;
    }, [toSeconds]);

    const toggleTimer = useCallback(() => {
        setIsRunning((prev) => !prev);
    }, []);

    const resetTimer = useCallback(() => {
        setIsRunning(false);
        setTotalSeconds(isCountUp ? 0 : toSeconds(initialMinutes));
        lastTimestampRef.current = null;
    }, [initialMinutes, isCountUp, toSeconds]);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Cập nhật tab title để người dùng thấy thời gian nhảy liên tục trên thanh tab trình duyệt
    useEffect(() => {
        if (!isRunning) {
            document.title = 'DoroStudy';
            return;
        }

        const timeStr = hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        document.title = `(${timeStr}) ${isCountUp ? 'Stopwatch' : 'Focus'} · DoroStudy`;

        return () => {
            document.title = 'DoroStudy';
        };
    }, [isRunning, totalSeconds, hours, minutes, seconds, isCountUp]);

    return { 
        hours, 
        minutes, 
        totalMinutes,
        seconds, 
        totalSeconds, 
        isRunning, 
        setIsRunning,
        toggleTimer, 
        resetTimer, 
        setTime 
    };
}