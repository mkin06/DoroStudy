package org.devnqminh.studyfocus.dto.response;

import java.time.Instant;
import java.util.List;

/**
 * "Đơn thuốc" cho phiên học SẮP TỚI — phần AI chạy TRƯỚC khi user bấm Start.
 *
 * Vì sao đây mới là phần khác biệt thật sự:
 *
 *   Reflection sau phiên chỉ kể lại chuyện đã rồi. User đọc, gật gù, rồi buổi sau vẫn học
 *   y như cũ — đó chính là lý do việc tự đánh giá thành "buổi đực buổi cái". Vòng lặp chỉ
 *   khép lại khi kết luận của AI quay ngược vào thiết lập của phiên kế tiếp: đúng môn,
 *   đúng độ dài, đúng khung giờ, kèm một biện pháp chặn đúng tác nhân hay làm phiền user.
 *
 *   Toàn bộ nội dung ở đây tính cục bộ từ lịch sử của chính user, không gọi Gemini — nên nó
 *   miễn phí, hiện tức thì khi mở app, và không tiêu một lượt quota nào.
 *
 * @param personalized       false khi user chưa đủ dữ liệu — lúc đó đây là gợi ý mặc định,
 *                           và giao diện phải nói rõ như vậy thay vì giả vờ đã hiểu user
 * @param basedOnSessions    số phiên đã dùng để dựng kế hoạch này
 * @param headline           một câu ra lệnh, đọc là làm được: "Học Toán 25 phút ngay bây giờ"
 * @param subject            môn nên học; null khi user chưa từng gắn môn nào
 * @param durationMinutes    độ dài nên đặt cho phiên này
 * @param breakMinutes       độ dài nghỉ đi kèm
 * @param predictedFocusScore điểm AI dự đoán nếu user làm theo kế hoạch
 * @param confidence         0-100, theo cỡ mẫu — hiển thị để user biết nên tin tới đâu
 * @param timingVerdict      GOOD | OK | POOR | UNKNOWN — bây giờ có phải lúc tốt để học không
 * @param timingMessage      giải thích verdict bằng số liệu thật của user
 * @param betterWindowLabel  buổi tốt hơn ("buổi tối"), chỉ có khi verdict = POOR
 * @param betterWindowHour   giờ cụ thể nên học thay vì bây giờ
 * @param guardrail          một thao tác cần làm TRƯỚC khi bấm Start, nhắm đúng tác nhân số 1
 * @param streakMessage      câu nhắc về nhịp học — nhắm vào nỗi đau "ngày đực ngày cái"
 * @param reasons            căn cứ số liệu của kế hoạch; không có căn cứ thì không nói
 * @param accuracy           mô hình đang đoán đúng tới đâu trên chính user này
 */
public record NextSessionPlan(
        boolean personalized,
        int basedOnSessions,
        String headline,
        String subject,
        int durationMinutes,
        int breakMinutes,
        double predictedFocusScore,
        int confidence,
        String timingVerdict,
        String timingMessage,
        String betterWindowLabel,
        Integer betterWindowHour,
        String guardrail,
        String streakMessage,
        List<String> reasons,
        CoachAccuracy accuracy,
        Instant generatedAt
) {

    /**
     * Độ chính xác của chính mô hình dự đoán, đo bằng cách đoán lại các phiên đã qua.
     *
     * Hiển thị con số này là một lựa chọn có chủ đích: nó khiến hệ thống phải chịu trách
     * nhiệm với lời mình nói. Một AI dám công bố sai số của mình đáng tin hơn hẳn một AI
     * chỉ đưa ra lời khuyên chung chung không bao giờ kiểm chứng được.
     *
     * @param sampleSize        số phiên đã chấm; 0 nghĩa là chưa đủ dữ liệu để chấm
     * @param meanAbsoluteError sai số trung bình tính bằng điểm
     * @param accuracyPercent   100 - sai số
     */
    public record CoachAccuracy(int sampleSize, double meanAbsoluteError, int accuracyPercent) {
    }
}
