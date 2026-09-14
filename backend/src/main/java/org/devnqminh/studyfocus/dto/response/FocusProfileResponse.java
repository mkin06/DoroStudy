package org.devnqminh.studyfocus.dto.response;

import java.time.Instant;
import java.util.List;

/**
 * "Focus DNA" — hồ sơ tập trung cá nhân của user.
 *
 * Khác với bản Meta-Learning cũ (chỉ có sau 10 phiên): hồ sơ này luôn trả về được, chỉ là
 * càng nhiều phiên thì càng mở khoá thêm phát hiện. Phiên đầu tiên đã có mốc chuẩn và
 * một đơn thuốc cho phiên sau, nên user không phải học 10 buổi mới thấy AI làm được gì.
 */
public record FocusProfileResponse(
        int totalSessions,

        /** 0=Khởi động, 1=Đang dò, 2=Đã thấy quy luật, 3=Hồ sơ đầy đủ. */
        int tier,
        String tierName,

        /** Tên phát hiện sắp mở khoá và còn thiếu bao nhiêu phiên — đây là móc kéo user quay lại. */
        String nextUnlockName,
        Integer sessionsToNextUnlock,

        Double averageFocusScore,
        Double bestFocusScore,

        /** Phát hiện đã mở khoá, sắp xếp theo mức hữu ích. */
        List<Discovery> discoveries,

        /** Khung giờ tốt nhất theo từng môn — phần không app Pomodoro nào khác có. */
        List<SubjectGoldenHour> subjectGoldenHours,

        /**
         * Lưới môn x buổi để vẽ "bản đồ giờ vàng". Chỉ chứa ô có dữ liệu thật —
         * ô thiếu dữ liệu phải hiện trống, không được vẽ thành điểm 0.
         */
        List<SubjectHeatCell> heatmap,

        /** Độ dài phiên cho điểm cao nhất, và số phút trước khi năng lượng tụt. */
        Integer suggestedDurationMinutes,
        Integer energyDropAfterMinutes,

        ConsistencyStatus consistency,

        Instant generatedAt
) {

    /**
     * @param subject     tên môn
     * @param bestHour    giờ bắt đầu tốt nhất (0-23)
     * @param bestScore   điểm trung bình ở khung giờ đó
     * @param worstHour   giờ kém nhất, null khi chưa đủ dữ liệu để so
     * @param worstScore  điểm trung bình khung giờ kém nhất
     * @param sampleSize  số phiên của môn này
     */
    public record SubjectGoldenHour(
            String subject,
            int bestHour,
            double bestScore,
            Integer worstHour,
            Double worstScore,
            int sampleSize
    ) {
    }

    /**
     * Một ô của bản đồ giờ vàng.
     *
     * Gộp theo buổi (4 cột) thay vì theo từng giờ (24 cột): với vài chục phiên thì lưới
     * 24 cột gần như trống, và một ô có đúng 1 phiên trông y như một quy luật.
     *
     * @param avgScore  điểm trung bình của môn này trong buổi này
     * @param sessions  số phiên tạo ra ô này — để user biết ô nào đáng tin
     */
    public record SubjectHeatCell(
            String subject,
            String dayPart,
            String dayPartLabel,
            double avgScore,
            int sessions
    ) {
    }

    /**
     * Tình trạng duy trì thói quen — nhắm thẳng vào nỗi đau "ngày đực ngày cái".
     *
     * @param currentStreakDays chuỗi ngày học liên tiếp tính tới hôm nay
     * @param bestStreakDays    chuỗi dài nhất từng đạt
     * @param daysSinceLastSession số ngày kể từ phiên gần nhất
     * @param averageGapDays    khoảng cách trung bình giữa các ngày học
     * @param atRisk            true khi nhịp học đang thưa dần so với chính user trước đó
     * @param message           câu nhắc ngắn, đã có sẵn để hiển thị
     */
    public record ConsistencyStatus(
            int currentStreakDays,
            int bestStreakDays,
            int daysSinceLastSession,
            Double averageGapDays,
            boolean atRisk,
            String message
    ) {
    }
}
