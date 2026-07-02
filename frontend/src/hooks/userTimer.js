//tận dụng cho stopwatch và userTimer sau này
// Tái sử dụng logic.
// Tách biệt logic và giao diện.
// Dễ dàng kiểm tra và bảo trì.
// Quản lý trạng thái hiệu quả.
// Mở rộng tính năng dễ dàng.

//quản lý trạng thái và logic của bộ đếm thời gian
import { useState, useEffect, useRef, useCallback } from 'react';

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
            }, 1000);
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