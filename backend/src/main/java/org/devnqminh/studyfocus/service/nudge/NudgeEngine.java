package org.devnqminh.studyfocus.service.nudge;

import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.Nudge;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Quyết định CÓ ĐÁNG làm phiền user lúc này không, và nếu có thì nói câu gì.
 *
 * Nguyên tắc quan trọng nhất, và cũng là thứ khó giữ nhất: IM LẶNG LÀ MẶC ĐỊNH.
 *
 *   Một thông báo không xứng đáng không chỉ vô ích — nó dạy user rằng thông báo của
 *   DoroStudy có thể bỏ qua, và làm hỏng luôn những lần nhắc thật sự quan trọng sau này.
 *   Vì vậy mọi loại nhắc ở đây đều phải có một LÝ DO CỤ THỂ bằng số liệu của chính user
 *   ("chuỗi 5 ngày sắp đứt", "bạn nghỉ 6 ngày trong khi nhịp thường là 1.5 ngày"), không
 *   có loại nào kiểu "đã đến giờ học rồi!".
 *
 * Thuần tính toán, không đụng DB và không gọi AI — chạy được cho hàng nghìn user trong một
 * lượt quét mà không tốn đồng nào.
 */
@Component
public class NudgeEngine {

    /** Buổi tối là lúc còn kịp cứu một chuỗi ngày sắp đứt; nhắc sớm hơn thì user chưa vội. */
    private static final int STREAK_RESCUE_HOUR = 17;

    /** Nhắc mốc mở khoá cũng chỉ từ chiều — sáng ra mà giục học thì phản tác dụng. */
    private static final int UNLOCK_REMINDER_HOUR = 15;

    /** Cần ngần này phiên mới dám nói "khung giờ vàng của bạn là mấy giờ". */
    private static final int MIN_FOR_GOLDEN_HOUR = 5;

    /** Phiên cứu nguy luôn là phiên ngắn: mục tiêu là nối lại mạch, không phải học bù. */
    private static final int RESCUE_DURATION = 15;

    /**
     * Nhắc gì cho user này, ngay lúc này. {@link Optional#empty()} nghĩa là không có gì đáng
     * nói — đó là kết quả hợp lệ và phổ biến nhất.
     *
     * @param points  lịch sử đã có reflection, cũ → mới
     * @param profile hồ sơ dựng từ chính lịch sử đó
     */
    public Optional<Nudge> evaluate(List<SessionPoint> points,
                                    FocusProfileResponse profile,
                                    ZoneId zone,
                                    Instant now) {
        if (points == null || points.isEmpty()) {
            return Optional.empty();   // chưa học phiên nào thì chưa có gì để nói riêng với họ
        }

        LocalDate today = now.atZone(zone).toLocalDate();
        int hour = now.atZone(zone).getHour();
        boolean studiedToday = studiedOn(points, zone, today);

        // Đã học hôm nay rồi thì không nhắc gì hết. Người vừa hoàn thành việc mà vẫn bị giục
        // là cách nhanh nhất để họ tắt thông báo vĩnh viễn.
        if (studiedToday) {
            return Optional.empty();
        }

        FocusProfileResponse.ConsistencyStatus consistency = profile.consistency();
        String subject = frequentSubject(points);

        // 1. Chuỗi ngày sắp đứt — thứ duy nhất có hạn chót thật trong ngày hôm nay
        if (consistency != null && consistency.currentStreakDays() >= 2 && hour >= STREAK_RESCUE_HOUR) {
            int hoursLeft = 24 - hour;
            return Optional.of(new Nudge(
                    "STREAK_AT_RISK",
                    "🔥",
                    String.format("Chuỗi %d ngày sắp đứt", consistency.currentStreakDays()),
                    String.format(
                            "Còn %d tiếng nữa là hết hôm nay. Một phiên %d phút là đủ giữ chuỗi%s.",
                            hoursLeft, RESCUE_DURATION,
                            consistency.currentStreakDays() >= consistency.bestStreakDays()
                                    ? " dài nhất từ trước tới nay của bạn" : ""),
                    "Học " + RESCUE_DURATION + " phút",
                    RESCUE_DURATION,
                    subject,
                    90,
                    now));
        }

        // 2. Đang tụt nhịp so với chính mình — nỗi đau "ngày đực ngày cái"
        if (consistency != null && consistency.atRisk()) {
            return Optional.of(new Nudge(
                    "COMEBACK",
                    "🌱",
                    String.format("Bạn đã nghỉ %d ngày", consistency.daysSinceLastSession()),
                    String.format(Locale.US,
                            "Nhịp thường ngày của bạn là %s ngày một lần. Nối lại bằng một phiên "
                                    + "%d phút — ngắn thôi, cốt để mạch không đứt hẳn.",
                            consistency.averageGapDays() == null ? "1" : consistency.averageGapDays(),
                            RESCUE_DURATION),
                    "Học " + RESCUE_DURATION + " phút",
                    RESCUE_DURATION,
                    subject,
                    80,
                    now));
        }

        // 3. Sắp tới khung giờ vàng — nhắc ĐÚNG lúc họ vốn học tốt nhất, không phải lúc rảnh
        Integer golden = goldenHour(points, zone);
        if (golden != null && (hour == golden - 1 || hour == golden)) {
            return Optional.of(new Nudge(
                    "GOLDEN_HOUR",
                    "🌟",
                    String.format("%02d:00 là khung giờ vàng của bạn", golden),
                    subject == null
                            ? "Đây là khung giờ bạn tập trung tốt nhất trong ngày. Đừng để trôi qua."
                            : String.format("Đây là khung giờ bạn tập trung tốt nhất. Mở %s ra học đi.",
                            subject),
                    profile.suggestedDurationMinutes() == null
                            ? "Bắt đầu học"
                            : "Học " + profile.suggestedDurationMinutes() + " phút",
                    profile.suggestedDurationMinutes(),
                    subject,
                    60,
                    now));
        }

        // 4. Mới đúng một phiên rồi dừng — nhóm rơi rụng nhiều nhất, và cũng dễ kéo lại nhất
        if (points.size() == 1 && consistency != null && consistency.daysSinceLastSession() >= 2) {
            return Optional.of(new Nudge(
                    "FIRST_STEP",
                    "🧬",
                    "Phiên thứ 2 mở khoá so sánh",
                    "AI mới có đúng một điểm dữ liệu về bạn. Thêm một phiên nữa là nó bắt đầu "
                            + "so sánh và tìm ra quy luật học của bạn.",
                    "Học phiên thứ 2",
                    RESCUE_DURATION,
                    subject,
                    55,
                    now));
        }

        // 5. Chỉ còn đúng 1 phiên nữa là mở khoá — phần thưởng đã nhìn thấy được
        if (profile.sessionsToNextUnlock() != null && profile.sessionsToNextUnlock() == 1
                && profile.nextUnlockName() != null && hour >= UNLOCK_REMINDER_HOUR) {
            return Optional.of(new Nudge(
                    "UNLOCK_CLOSE",
                    "🔓",
                    "Còn 1 phiên nữa",
                    String.format("Hoàn thành thêm một phiên là mở khoá \"%s\".", profile.nextUnlockName()),
                    "Học ngay",
                    profile.suggestedDurationMinutes(),
                    subject,
                    50,
                    now));
        }

        return Optional.empty();
    }

    // ------------------------------------------------------------------

    private boolean studiedOn(List<SessionPoint> points, ZoneId zone, LocalDate day) {
        return points.stream()
                .filter(p -> p.startedAt() != null)
                .anyMatch(p -> p.startedAt().atZone(zone).toLocalDate().equals(day));
    }

    /**
     * Giờ trong ngày cho điểm trung bình cao nhất, chỉ tính giờ đã học ít nhất 2 lần.
     * Một giờ có đúng một phiên may mắn không phải là "khung giờ vàng".
     */
    private Integer goldenHour(List<SessionPoint> points, ZoneId zone) {
        if (points.size() < MIN_FOR_GOLDEN_HOUR) {
            return null;
        }
        Map<Integer, double[]> byHour = new LinkedHashMap<>();
        for (SessionPoint p : points) {
            if (p.startedAt() == null) {
                continue;
            }
            double[] acc = byHour.computeIfAbsent(p.startedAt().atZone(zone).getHour(), h -> new double[2]);
            acc[0] += p.focusScore();
            acc[1] += 1;
        }
        return byHour.entrySet().stream()
                .filter(e -> e.getValue()[1] >= 2)
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1]))
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    /** Môn user hay học nhất — để lời nhắc gọi đúng tên thứ họ định làm, không nói chung chung. */
    private String frequentSubject(List<SessionPoint> points) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject != null) {
                counts.merge(subject, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }
}
