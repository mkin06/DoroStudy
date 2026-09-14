package org.devnqminh.studyfocus.service.nudge;

import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.Nudge;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.devnqminh.studyfocus.service.ai.FocusScoreCalculator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nửa quan trọng nhất của bộ test này là các trường hợp engine phải IM LẶNG.
 *
 * Nhắc sai một lần thì user tắt quyền thông báo, và ta mất kênh đó với người đó vĩnh viễn —
 * hậu quả nặng hơn nhiều so với việc bỏ lỡ một lần nhắc đúng. Vì vậy "không nhắc" được test
 * kỹ ngang với "nhắc gì".
 *
 * Lịch sử trong test dựng tương đối so với hôm nay, vì phần phân tích tính kiên trì so mọi
 * thứ với {@code LocalDate.now()}.
 */
class NudgeEngineTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FocusInsightEngine insightEngine = new FocusInsightEngine();
    private final FocusScoreCalculator scorer = new FocusScoreCalculator();
    private final NudgeEngine engine = new NudgeEngine();

    // ------------------------------------------------------------------

    private SessionPoint sessionDaysAgo(long id, int daysAgo, int hour, String subject, int focus) {
        LocalDate day = LocalDate.now(ZONE).minusDays(daysAgo);
        return new SessionPoint(
                id, subject, 25,
                LocalDateTime.of(day, LocalTime.of(hour, 0)).atZone(ZONE).toInstant(),
                80, focus, 4, List.of(),
                scorer.calculate(80, focus, 4));
    }

    private Instant todayAt(int hour) {
        return LocalDateTime.of(LocalDate.now(ZONE), LocalTime.of(hour, 0)).atZone(ZONE).toInstant();
    }

    private Optional<Nudge> evaluate(List<SessionPoint> points, int hour) {
        FocusProfileResponse profile = insightEngine.analyze(points, ZONE);
        return engine.evaluate(points, profile, ZONE, todayAt(hour));
    }

    // ------------------------------------------------------------------
    // Phải im lặng
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Chưa học phiên nào: không nhắc gì — chưa biết gì về họ thì không có gì để nói")
    void silentWithoutHistory() {
        assertThat(evaluate(List.of(), 20)).isEmpty();
    }

    @Test
    @DisplayName("Đã học hôm nay: tuyệt đối không nhắc, dù chuỗi ngày có dài tới đâu")
    void silentAfterStudyingToday() {
        List<SessionPoint> points = new ArrayList<>();
        for (int i = 4; i >= 0; i--) {
            points.add(sessionDaysAgo(i + 1, i, 20, "Toán", 4));   // gồm cả hôm nay
        }
        assertThat(evaluate(points, 21)).isEmpty();
    }

    @Test
    @DisplayName("Chuỗi đang chạy nhưng còn sớm: chưa nhắc, vì hôm nay vẫn còn cả ngày")
    void silentAboutStreakInTheMorning() {
        List<SessionPoint> points = List.of(
                sessionDaysAgo(1, 2, 20, "Toán", 4),
                sessionDaysAgo(2, 1, 20, "Toán", 4));

        Optional<Nudge> nudge = evaluate(points, 9);

        assertThat(nudge).isEmpty();
    }

    // ------------------------------------------------------------------
    // Phải nhắc, và nhắc đúng loại
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Chuỗi 2 ngày, tối nay chưa học: nhắc cứu chuỗi với mức khẩn cấp cao nhất")
    void warnsWhenStreakIsAboutToBreak() {
        List<SessionPoint> points = List.of(
                sessionDaysAgo(1, 2, 20, "Toán", 4),
                sessionDaysAgo(2, 1, 20, "Toán", 4));

        Nudge nudge = evaluate(points, 20).orElseThrow();

        assertThat(nudge.type()).isEqualTo("STREAK_AT_RISK");
        assertThat(nudge.urgency()).isEqualTo(90);
        assertThat(nudge.title()).contains("2 ngày");
        assertThat(nudge.body()).contains("4 tiếng");
        assertThat(nudge.subject()).isEqualTo("Toán");
        assertThat(nudge.suggestedDurationMinutes()).isEqualTo(15);
    }

    @Test
    @DisplayName("Nghỉ lâu hơn nhịp thường ngày: nhắc quay lại, kèm chính nhịp đó làm bằng chứng")
    void callsBackUsersWhoDriftedAway() {
        List<SessionPoint> points = List.of(
                sessionDaysAgo(1, 10, 20, "Toán", 4),
                sessionDaysAgo(2, 9, 20, "Toán", 4),
                sessionDaysAgo(3, 8, 20, "Toán", 4));

        Nudge nudge = evaluate(points, 19).orElseThrow();

        assertThat(nudge.type()).isEqualTo("COMEBACK");
        assertThat(nudge.urgency()).isEqualTo(80);
        assertThat(nudge.title()).contains("8 ngày");
    }

    @Test
    @DisplayName("Sắp tới khung giờ vàng: nhắc đúng một tiếng trước, gọi tên môn hay học")
    void remindsJustBeforeGoldenHour() {
        List<SessionPoint> points = new ArrayList<>();
        // Học cách ngày lúc 20h — nhịp đều nên không bị coi là tụt nhịp, chuỗi cũng chỉ 1
        for (int i = 0; i < 5; i++) {
            points.add(sessionDaysAgo(i + 1, 9 - i * 2, 20, "Toán", 5));
        }

        Nudge nudge = evaluate(points, 19).orElseThrow();

        assertThat(nudge.type()).isEqualTo("GOLDEN_HOUR");
        assertThat(nudge.title()).contains("20:00");
        assertThat(nudge.body()).contains("Toán");
        assertThat(nudge.urgency()).isLessThan(70);   // đủ để hiện trong app, chưa đủ để đẩy
    }

    @Test
    @DisplayName("Mới đúng 1 phiên rồi bỏ: nhắc bằng thứ họ sắp mở khoá, không giục chung chung")
    void pullsBackOneSessionUsers() {
        List<SessionPoint> points = List.of(sessionDaysAgo(1, 3, 20, "Toán", 4));

        Nudge nudge = evaluate(points, 16).orElseThrow();

        assertThat(nudge.type()).isEqualTo("FIRST_STEP");
        assertThat(nudge.body()).contains("quy luật");
    }

    // ------------------------------------------------------------------
    // Ngưỡng đẩy
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Chỉ nhắc có hạn chót thật mới vượt ngưỡng được phép đẩy ra ngoài app")
    void onlyDeadlineDrivenNudgesEarnAPush() {
        int pushThreshold = 70;   // khớp mặc định của NudgeProperties

        Nudge streak = evaluate(List.of(
                sessionDaysAgo(1, 2, 20, "Toán", 4),
                sessionDaysAgo(2, 1, 20, "Toán", 4)), 20).orElseThrow();
        Nudge firstStep = evaluate(List.of(sessionDaysAgo(1, 3, 20, "Toán", 4)), 16).orElseThrow();

        assertThat(streak.urgency()).isGreaterThanOrEqualTo(pushThreshold);
        assertThat(firstStep.urgency()).isLessThan(pushThreshold);
    }
}
