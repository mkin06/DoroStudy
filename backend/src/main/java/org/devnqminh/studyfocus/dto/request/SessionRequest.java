package org.devnqminh.studyfocus.dto.request;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record SessionRequest(

        @NotNull(message = "Duration không được để trống")
        Double duration,        // Thời gian học (phút)

        @NotNull(message = "Break time không được để trống")
        Double breakTime,       // Thời gian nghỉ (phút)

        @NotNull(message = "Count không được để trống")
        Integer count,          // Số pomodoros hoàn thành

        String mode,             // "pomodoro", "stopwatch", "countdown"

        String subject,         // Môn học (optional, có thể null)

        Instant startTime       // Thời điểm bắt đầu phiên (optional; thiếu thì suy ra từ duration)

) {
}
