package org.devnqminh.studyfocus.service.ai;

import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.NextSessionPlan;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phần AI chạy TRƯỚC phiên học là thứ thay đổi hành vi, nên nó được test kỹ ở hai mặt:
 * nói đúng khi đã có quy luật, và KHÔNG khẳng định gì khi chưa có dữ liệu.
 */
class NextSessionPlannerTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FocusInsightEngine engine = new FocusInsightEngine();
    private final FocusScoreCalculator scorer = new FocusScoreCalculator();
    private final FocusScorePredictor predictor = new FocusScorePredictor();
    private final NextSessionPlanner planner = new NextSessionPlanner(predictor);

    // ------------------------------------------------------------------

    private SessionPoint session(long id, LocalDate day, int hour, String subject,
                                 double minutes, int completion, int focus, Integer energy,
                                 String distraction) {
        return new SessionPoint(
                id, subject, minutes,
                LocalDateTime.of(day, LocalTime.of(hour, 0)).atZone(ZONE).toInstant(),
                completion, focus, energy,
                distraction == null ? List.of() : List.of(distraction),
                scorer.calculate(completion, focus, energy));
    }

    /** Toán buổi tối 25 phút rất tốt; Toán buổi chiều 50 phút rất tệ và hay bị mạng xã hội. */
    private List<SessionPoint> userWithClearPatterns() {
        List<SessionPoint> points = new ArrayList<>();
        LocalDate day = LocalDate.of(2026, 9, 1);
        long id = 1;
        points.add(session(id++, day, 20, "Toán", 25, 90, 5, 4, null));
        points.add(session(id++, day.plusDays(1), 20, "Toán", 25, 85, 5, 4, null));
        points.add(session(id++, day.plusDays(2), 20, "Toán", 25, 80, 4, 4, null));
        points.add(session(id++, day.plusDays(3), 14, "Toán", 50, 50, 2, 2, "social_media"));
        points.add(session(id++, day.plusDays(4), 14, "Toán", 50, 45, 2, 1, "social_media"));
        points.add(session(id++, day.plusDays(5), 14, "Toán", 50, 55, 2, 2, "social_media"));
        points.add(session(id++, day.plusDays(6), 20, "Văn", 25, 55, 3, 3, "mind_wandering"));
        points.add(session(id++, day.plusDays(7), 20, "Văn", 25, 50, 3, 3, "social_media"));
        points.add(session(id++, day.plusDays(8), 21, "Toán", 25, 85, 5, 5, null));
        points.add(session(id++, day.plusDays(9), 14, "Toán", 50, 40, 2, 1, "social_media"));
        points.add(session(id++, day.plusDays(10), 20, "Toán", 25, 95, 5, 5, null));
        points.add(session(id, day.plusDays(11), 20, "Toán", 25, 90, 5, 4, null));
        return points;
    }

    private NextSessionPlan planAt(List<SessionPoint> points, int hour, String subjectHint) {
        FocusProfileResponse profile = engine.analyze(points, ZONE);
        Instant now = LocalDateTime.of(LocalDate.of(2026, 9, 14), LocalTime.of(hour, 0))
                .atZone(ZONE).toInstant();
        return planner.plan(points, profile, ZONE, now, subjectHint);
    }

    // ------------------------------------------------------------------
    // Chưa có dữ liệu: vẫn dùng được, nhưng không được giả vờ đã hiểu user
    // ------------------------------------------------------------------

    @Test
    @DisplayName("User mới: vẫn có kế hoạch mặc định nhưng đánh dấu chưa cá nhân hoá")
    void coldStartStillReturnsUsablePlan() {
        NextSessionPlan plan = planAt(List.of(), 20, null);

        assertThat(plan.personalized()).isFalse();
        assertThat(plan.basedOnSessions()).isZero();
        assertThat(plan.durationMinutes()).isEqualTo(25);
        assertThat(plan.headline()).isNotBlank();
        assertThat(plan.timingVerdict()).isEqualTo("UNKNOWN");
        assertThat(plan.subject()).isNull();
        assertThat(plan.accuracy().sampleSize()).isZero();
    }

    @Test
    @DisplayName("Ít phiên: không phán xét khung giờ, chỉ mời user học thêm để có dữ liệu")
    void staysSilentAboutTimingWithoutEnoughSessions() {
        List<SessionPoint> points = List.of(
                session(1, LocalDate.of(2026, 9, 1), 20, "Toán", 25, 80, 4, 4, null),
                session(2, LocalDate.of(2026, 9, 2), 20, "Toán", 25, 75, 4, 4, null));

        NextSessionPlan plan = planAt(points, 14, null);

        assertThat(plan.timingVerdict()).isEqualTo("UNKNOWN");
        assertThat(plan.betterWindowHour()).isNull();
    }

    // ------------------------------------------------------------------
    // Đã có quy luật: phải nói đúng và nói cụ thể
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Đúng khung giờ vàng: verdict GOOD và chọn môn user học tốt nhất lúc đó")
    void recommendsBestSubjectInGoldenHour() {
        NextSessionPlan plan = planAt(userWithClearPatterns(), 20, null);

        assertThat(plan.personalized()).isTrue();
        assertThat(plan.timingVerdict()).isEqualTo("GOOD");
        assertThat(plan.subject()).isEqualTo("Toán");
        assertThat(plan.predictedFocusScore()).isGreaterThan(70);
        assertThat(plan.headline()).contains("Toán");
    }

    @Test
    @DisplayName("Khung giờ kém: cảnh báo bằng số liệu và chỉ ra giờ nên học thay thế")
    void warnsAboutWeakTimeWindow() {
        NextSessionPlan plan = planAt(userWithClearPatterns(), 14, null);

        assertThat(plan.timingVerdict()).isEqualTo("POOR");
        assertThat(plan.betterWindowLabel()).isEqualTo("buổi tối");
        assertThat(plan.betterWindowHour()).isEqualTo(20);
        assertThat(plan.timingMessage()).contains("chênh");
    }

    @Test
    @DisplayName("User tự chọn môn: AI tôn trọng lựa chọn, chỉ đổi dự đoán chứ không ép môn khác")
    void respectsUserSubjectChoice() {
        NextSessionPlan withHint = planAt(userWithClearPatterns(), 20, "Văn");
        NextSessionPlan without = planAt(userWithClearPatterns(), 20, null);

        assertThat(withHint.subject()).isEqualTo("Văn");
        assertThat(without.subject()).isEqualTo("Toán");
        // Văn là môn đuối hơn nên dự đoán phải thấp hơn Toán ở cùng khung giờ
        assertThat(withHint.predictedFocusScore()).isLessThan(without.predictedFocusScore());
    }

    @Test
    @DisplayName("Hay bị mạng xã hội: kế hoạch kèm thao tác chặn trước khi bấm Start")
    void attachesGuardrailForTopDistraction() {
        NextSessionPlan plan = planAt(userWithClearPatterns(), 20, null);

        assertThat(plan.guardrail()).isNotNull();
        assertThat(plan.guardrail()).contains("điện thoại");
    }

    @Test
    @DisplayName("Cạn năng lượng sớm: AI chủ động khuyên rút NGẮN phiên, kèm lý do bằng số")
    void shortensSessionWhenEnergyDropsEarly() {
        // User luôn học 45 phút và luôn báo cạn năng lượng — độ dài tối ưu phải bị cắt xuống
        List<SessionPoint> points = new ArrayList<>();
        LocalDate day = LocalDate.of(2026, 9, 1);
        for (int i = 0; i < 6; i++) {
            points.add(session(i + 1, day.plusDays(i), 20, "Toán", 45, 60, 3, 2, "fatigue"));
        }
        NextSessionPlan plan = planAt(points, 20, null);

        assertThat(plan.durationMinutes()).isLessThan(45);
        assertThat(plan.reasons()).anyMatch(r -> r.contains("năng lượng"));
    }

    @Test
    @DisplayName("Thời lượng nghỉ luôn nằm trong khoảng dùng được")
    void breakLengthStaysReasonable() {
        NextSessionPlan plan = planAt(userWithClearPatterns(), 20, null);

        assertThat(plan.breakMinutes()).isBetween(5, 15);
    }

    // ------------------------------------------------------------------
    // Mô hình dự đoán
    // ------------------------------------------------------------------

    @Test
    @DisplayName("User có quy luật rõ: mô hình tự chấm phải đạt độ chính xác cao")
    void predictorScoresItselfHonestly() {
        FocusScorePredictor.Accuracy accuracy = predictor.backtest(userWithClearPatterns(), ZONE);

        assertThat(accuracy.sampleSize()).isGreaterThan(0);
        assertThat(accuracy.accuracyPercent()).isGreaterThan(70);
        assertThat(accuracy.meanAbsoluteError()).isLessThan(30);
    }

    @Test
    @DisplayName("Một phiên lạc loài không được kéo dự đoán đi xa — cỡ mẫu nhỏ thì co về trung bình")
    void shrinksEffectOfTinySamples() {
        List<SessionPoint> points = new ArrayList<>();
        LocalDate day = LocalDate.of(2026, 9, 1);
        for (int i = 0; i < 8; i++) {
            points.add(session(i + 1, day.plusDays(i), 20, "Toán", 25, 80, 4, 4, null));
        }
        // Đúng MỘT phiên môn Lý điểm rất thấp
        points.add(session(9, day.plusDays(8), 20, "Lý", 25, 10, 1, 1, "fatigue"));

        double base = predictor.predict(points,
                new FocusScorePredictor.Context("Toán", 20, 25.0), ZONE).score();
        double outlier = predictor.predict(points,
                new FocusScorePredictor.Context("Lý", 20, 25.0), ZONE).score();

        // Có kéo xuống, nhưng không được rơi thẳng về mức của phiên lạc loài
        assertThat(outlier).isLessThan(base);
        assertThat(outlier).isGreaterThan(50);
    }

    @Test
    @DisplayName("Chưa có lịch sử: dự đoán phải tự khai là chưa cá nhân hoá, độ tin cậy thấp")
    void coldStartPredictionAdmitsItKnowsNothing() {
        FocusScorePredictor.Prediction prediction = predictor.predict(
                List.of(), new FocusScorePredictor.Context("Toán", 20, 25.0), ZONE);

        assertThat(prediction.confidence()).isLessThan(30);
        assertThat(prediction.drivers()).isNotEmpty();
        assertThat(prediction.drivers().get(0)).contains("Chưa có phiên nào");
    }
}
