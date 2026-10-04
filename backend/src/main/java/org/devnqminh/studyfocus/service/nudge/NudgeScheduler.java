package org.devnqminh.studyfocus.service.nudge;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Chạy lượt quét nhắc nhở theo lịch.
 *
 * Mỗi giờ một lần là đủ: các lời nhắc đều gắn với khung giờ trong ngày ("chuỗi sắp đứt sau
 * 4 tiếng", "20h là giờ vàng của bạn"), không có loại nào cần độ chính xác tới phút. Quét
 * dày hơn chỉ tốn query mà không đổi được thời điểm user nhận thông báo.
 *
 * Bean chỉ tồn tại khi {@code nudge.enabled=true} — môi trường chưa cấu hình VAPID thì
 * không có job nền nào chạy cả, thay vì chạy rồi im lặng thất bại mỗi giờ.
 */
@Component
@ConditionalOnProperty(prefix = "nudge", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class NudgeScheduler {

    private final NudgeService nudgeService;

    @Scheduled(cron = "${nudge.scan-cron:0 0 * * * *}", zone = "${nudge.zone:Asia/Ho_Chi_Minh}")
    public void scan() {
        try {
            nudgeService.sendDueNudges();
        } catch (Exception e) {
            // Job nền chết lặng lẽ là lỗi khó phát hiện nhất; luôn phải để lại dấu vết
            log.error("Lượt quét nhắc nhở thất bại: {}", e.getMessage(), e);
        }
    }
}
