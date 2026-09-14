package org.devnqminh.studyfocus.dto.response;

import java.time.Instant;

/**
 * Một lời nhắc chủ động — thứ duy nhất trong sản phẩm được phép đi tìm user thay vì chờ
 * user tìm đến.
 *
 * Vì sao cần tồn tại: {@link FocusProfileResponse.ConsistencyStatus} đã biết khi nào một
 * user đang tụt nhịp, nhưng cảnh báo đó chỉ hiện khi họ mở app — mà người sắp bỏ học thì
 * chính là người không mở app. Toàn bộ phần phân tích phía trước sẽ vô nghĩa với đúng nhóm
 * user cần nó nhất nếu không có kênh chạm ngược lại.
 *
 * @param type       STREAK_AT_RISK | COMEBACK | GOLDEN_HOUR | UNLOCK_CLOSE | FIRST_STEP
 * @param icon       emoji, dùng cho cả banner trong app lẫn notification
 * @param title      tiêu đề ngắn — đây là dòng người ta đọc trên màn hình khoá
 * @param body       1-2 câu, luôn kèm số liệu thật của chính user
 * @param actionLabel nhãn nút hành động, ví dụ "Học 15 phút"
 * @param suggestedDurationMinutes độ dài phiên đề xuất kèm theo, để bấm một nút là chạy
 * @param subject    môn học đề xuất, null nếu chưa đủ dữ liệu
 * @param urgency    0-100. Không phải để xếp hạng cho vui: chỉ nhắc đẩy (push) khi vượt
 *                   ngưỡng, còn dưới ngưỡng thì chỉ hiện trong app lúc user tự mở
 */
public record Nudge(
        String type,
        String icon,
        String title,
        String body,
        String actionLabel,
        Integer suggestedDurationMinutes,
        String subject,
        int urgency,
        Instant generatedAt
) {
}
