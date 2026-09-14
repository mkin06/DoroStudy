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

export default function useTimer(initialMinutes = 25){
    const toSeconds = useCallback((valueInMinutes) => {
        return Math.max(0, Math.round(Number(valueInMinutes || 0) * 60));
    }, []);

    const [totalSeconds, setTotalSeconds] = useState(() => toSeconds(initialMinutes));
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef(null);//lưu trữ id của interval

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setTotalSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, TICK_MS);
        } else {
            clearInterval(intervalRef.current);
        }

        return () => clearInterval(intervalRef.current); // Cleanup
    }, [isRunning]);

    const setTime = useCallback((newMinutes) => {
        setTotalSeconds(toSeconds(newMinutes));
        setIsRunning(false); // Dừng timer khi chuyển preset
    }, [toSeconds]);

    const toggleTimer = () => setIsRunning((prev) => !prev);

    const resetTimer = useCallback(() => {
        setIsRunning(false);
        setTotalSeconds(toSeconds(initialMinutes));
    }, [initialMinutes, toSeconds]);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return { minutes, seconds, isRunning, toggleTimer, resetTimer, setTime };
}