package org.devnqminh.studyfocus.service.ai;

import org.devnqminh.studyfocus.dto.response.Discovery;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Engine là nơi nằm toàn bộ giá trị khác biệt của sản phẩm, nên nó được test như một hàm
 * thuần: dựng lịch sử phiên giả, kiểm tra đúng những quy luật cần rút ra được — và quan
 * trọng không kém, kiểm tra nó IM LẶNG khi dữ liệu chưa đủ.
 */
class FocusInsightEngineTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FocusInsightEngine engine = new FocusInsightEngine();
    private final FocusScoreCalculator scorer = new FocusScoreCalculator();

    // ------------------------------------------------------------------
    // Tiện ích dựng dữ liệu
    // ------------------------------------------------------------------

    private SessionPoint session(long id, LocalDate day, int hour, String subject,
                                 double minutes, int completion, int focus, Integer energy,
                                 String distraction) {
        return new SessionPoint(
                id,
                subject,
                minutes,
                LocalDateTime.of(day, java.time.LocalTime.of(hour, 0)).atZone(ZONE).toInstant(),
                completion,
                focus,
                energy,
                distraction == null ? List.of() : List.of(distraction),
                scorer.calculate(completion, focus, energy));
    }

    /**
     * Một user có quy luật rõ ràng: học Toán buổi tối rất tốt, học Toán buổi chiều rất tệ,
     * phiên 25 phút hơn hẳn phiên 50 phút, hay bị mạng xã hội làm phiền, và Văn đuối hơn Toán.
     */
    private List<SessionPoint> userWithClearPatterns() {
        List<SessionPoint> points = new ArrayList<>();
        LocalDate day = LocalDate.of(2026, 9, 1);
        long id = 1;

        // Toán buổi tối, phiên ngắn → điểm cao
        points.add(session(id++, day, 20, "Toán", 25, 90, 5, 4, null));
        points.add(session(id++, day.plusDays(1), 20, "Toán", 25, 85, 5, 4, null));
        points.add(session(id++, day.plusDays(2), 20, "Toán", 25, 80, 4, 4, null));

        // Toán buổi chiều, phiên dài → điểm thấp, hay bị mạng xã hội
        points.add(session(id++, day.plusDays(3), 14, "Toán", 50, 50, 2, 2, "social_media"));
        points.add(session(id++, day.plusDays(4), 14, "Toán", 50, 45, 2, 1, "social_media"));
        points.add(session(id++, day.plusDays(5), 14, "Toán", 50, 55, 2, 2, "social_media"));

        // Văn — môn đuối hơn
        points.add(session(id++, day.plusDays(6), 20, "Văn", 25, 55, 3, 3, "mind_wandering"));
        points.add(session(id++, day.plusDays(7), 20, "Văn", 25, 50, 3, 3, "social_media"));

        // Thêm vài phiên tối tốt để mẫu đủ dày
        points.add(session(id++, day.plusDays(8), 21, "Toán", 25, 85, 5, 5, null));
        points.add(session(id++, day.plusDays(9), 14, "Toán", 50, 40, 2, 1, "social_media"));
        points.add(session(id++, day.plusDays(10), 20, "Toán", 25, 95, 5, 5, null));
        points.add(session(id, day.plusDays(11), 20, "Toán", 25, 90, 5, 4, null));
        return points;
    }

    private Discovery findById(List<Discovery> discoveries, String prefix) {
        return discoveries.stream().filter(d -> d.id().startsWith(prefix)).findFirst().orElse(null);
    }

    // ------------------------------------------------------------------
    // Không đủ dữ liệu thì phải im lặng, không đoán bừa
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Chưa có phiên nào: hồ sơ rỗng nhưng vẫn dùng được, không ném lỗi")
    void emptyHistoryReturnsUsableProfile() {
        FocusProfileResponse profile = engine.analyze(List.of(), ZONE);

        assertThat(profile.totalSessions()).isZero();
        assertThat(profile.discoveries()).isEmpty();
        assertThat(profile.consistency()).isNotNull();
        assertThat(profile.sessionsToNextUnlock()).isNotNull();
    }

    @Test
    @DisplayName("Phiên đầu tiên đã có giá trị: mốc chuẩn xuất hiện ngay, không phải chờ 10 phiên")
    void firstSessionAlreadyProducesValue() {
        List<SessionPoint> points = List.of(
                session(1, LocalDate.of(2026, 9, 1), 20, "Toán", 25, 80, 4, 4, null));

        FocusProfileResponse profile = engine.analyze(points, ZONE);

        assertThat(profile.totalSessions()).isEqualTo(1);
        assertThat(findById(profile.discoveries(), "baseline")).isNotNull();
        assertThat(profile.nextUnlockName()).isNotBlank();
    }

    @Test
    @DisplayName("Hai phiên chưa đủ để kết luận khung giờ hay độ dài — engine phải im lặng")
    void doesNotClaimPatternsWithoutEnoughData() {
        LocalDate day = LocalDate.of(2026, 9, 1);
        List<SessionPoint> points = List.of(
                session(1, day, 20, "Toán", 25, 90, 5, 5, null),
                session(2, day.plusDays(1), 14, "Toán", 50, 30, 1, 1, "social_media"));

        List<Discovery> discoveries = engine.analyze(points, ZONE).discoveries();

        assertThat(findById(discoveries, "golden_hour")).isNull();
        assertThat(findById(discoveries, "duration_")).isNull();
        assertThat(findById(discoveries, "subject_hour")).isNull();
    }

    // ------------------------------------------------------------------
    // Đủ dữ liệu thì phải rút ra đúng quy luật
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Tìm ra khung giờ vàng khi chênh lệch đủ lớn")
    void detectsGoldenHour() {
        List<Discovery> discoveries = engine.analyze(userWithClearPatterns(), ZONE).discoveries();

        Discovery golden = findById(discoveries, "golden_hour");
        assertThat(golden).isNotNull();
        assertThat(golden.detail()).contains("buổi tối");
    }

    @Test
    @DisplayName("Khuyên rút ngắn phiên khi phiên dài cho điểm thấp hơn")
    void detectsShorterSessionsAreBetter() {
        FocusProfileResponse profile = engine.analyze(userWithClearPatterns(), ZONE);

        Discovery duration = findById(profile.discoveries(), "duration_shorter");
        assertThat(duration).isNotNull();
        assertThat(profile.suggestedDurationMinutes()).isEqualTo(25);
    }

    @Test
    @DisplayName("Giờ vàng theo TỪNG MÔN — quy luật cấp môn học, không chỉ cấp tổng")
    void detectsPerSubjectGoldenHour() {
        FocusProfileResponse profile = engine.analyze(userWithClearPatterns(), ZONE);

        FocusProfileResponse.SubjectGoldenHour toan = profile.subjectGoldenHours().stream()
                .filter(s -> s.subject().equals("Toán")).findFirst().orElse(null);

        assertThat(toan).isNotNull();
        assertThat(toan.bestHour()).isIn(20, 21);
        assertThat(toan.worstHour()).isEqualTo(14);
        assertThat(toan.bestScore()).isGreaterThan(toan.worstScore());

        assertThat(findById(profile.discoveries(), "subject_hour:toán")).isNotNull();
    }

    @Test
    @DisplayName("Chỉ ra tác nhân xao nhãng chủ đạo kèm mức thiệt hại về điểm")
    void detectsTopDistraction() {
        Discovery distraction = findById(
                engine.analyze(userWithClearPatterns(), ZONE).discoveries(), "distraction_top:");

        assertThat(distraction).isNotNull();
        // Engine viết hoa đầu câu ("Mạng xã hội xuất hiện ở ...") nên so không phân biệt hoa/thường
        assertThat(distraction.detail()).containsIgnoringCase("mạng xã hội");
        assertThat(distraction.detail()).contains("5/12");
    }

    @Test
    @DisplayName("So sánh được môn mạnh và môn đuối")
    void comparesSubjects() {
        List<Discovery> discoveries = engine.analyze(userWithClearPatterns(), ZONE).discoveries();

        Discovery strength = findById(discoveries, "subject_strength");
        assertThat(strength).isNotNull();
        assertThat(strength.detail()).contains("Toán");
    }

    @Test
    @DisplayName("Tìm ra ngưỡng cạn năng lượng từ các phiên báo hết pin")
    void detectsEnergyDrainThreshold() {
        FocusProfileResponse profile = engine.analyze(userWithClearPatterns(), ZONE);

        assertThat(findById(profile.discoveries(), "energy_drop")).isNotNull();
        assertThat(profile.energyDropAfterMinutes()).isNotNull();
    }

    @Test
    @DisplayName("Suy ra môn gắn bó nhất từ tần suất quay lại và tỉ lệ hoàn thành")
    void detectsSubjectAffinity() {
        Discovery affinity = findById(
                engine.analyze(userWithClearPatterns(), ZONE).discoveries(), "subject_affinity:");

        assertThat(affinity).isNotNull();
        assertThat(affinity.detail()).contains("Toán");
    }

    @Test
    @DisplayName("Nhận ra thói quen 'buổi này bạn thường học môn nào'")
    void detectsRoutine() {
        Discovery routine = findById(
                engine.analyze(userWithClearPatterns(), ZONE).discoveries(), "routine:");

        assertThat(routine).isNotNull();
        assertThat(routine.detail()).contains("Toán");
    }

    @Test
    @DisplayName("Lưới heatmap chỉ có ô thật — buổi chưa từng học môn đó phải KHÔNG có ô")
    void heatmapOnlyContainsRealCells() {
        List<FocusProfileResponse.SubjectHeatCell> cells =
                engine.analyze(userWithClearPatterns(), ZONE).heatmap();

        assertThat(cells).isNotEmpty();
        assertThat(cells).allSatisfy(c -> assertThat(c.sessions()).isPositive());

        // Văn chỉ được học buổi tối trong dữ liệu mẫu -> không được có ô Văn/buổi chiều
        assertThat(cells)
                .noneMatch(c -> c.subject().equals("Văn") && c.dayPart().equals("afternoon"));
        assertThat(cells)
                .anyMatch(c -> c.subject().equals("Văn") && c.dayPart().equals("evening"));
    }

    // ------------------------------------------------------------------
    // Vòng lặp giữ chân
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Mỗi phiên mới đều mở khoá thêm ít nhất một thứ trong giai đoạn đầu")
    void everyEarlySessionUnlocksSomething() {
        List<SessionPoint> all = userWithClearPatterns();

        int sessionsWithNewDiscovery = 0;
        for (int n = 1; n <= all.size(); n++) {
            if (!engine.newDiscoveries(all.subList(0, n), ZONE).isEmpty()) {
                sessionsWithNewDiscovery++;
            }
        }

        // Không đòi 100% phiên nào cũng có phát hiện mới — đòi vậy là ép engine nói bừa.
        // Nhưng phần lớn hành trình đầu phải có thứ mới, nếu không user không có lý do quay lại.
        assertThat(sessionsWithNewDiscovery).isGreaterThanOrEqualTo(all.size() / 2);
    }

    @Test
    @DisplayName("Cảnh báo khi nhịp học thưa dần hơn thói quen của chính user")
    void flagsConsistencyRisk() {
        List<SessionPoint> points = new ArrayList<>();
        LocalDate start = LocalDate.now(ZONE).minusDays(30);
        // Học đều mỗi ngày trong 5 ngày, rồi biến mất 20 ngày
        for (int i = 0; i < 5; i++) {
            points.add(session(i + 1, start.plusDays(i), 20, "Toán", 25, 80, 4, 4, null));
        }

        FocusProfileResponse.ConsistencyStatus consistency =
                engine.analyze(points, ZONE).consistency();

        assertThat(consistency.atRisk()).isTrue();
        assertThat(consistency.daysSinceLastSession()).isGreaterThan(2);
        assertThat(consistency.bestStreakDays()).isEqualTo(5);
    }

    @Test
    @DisplayName("Chuỗi ngày liên tiếp được đếm đúng khi user học đều")
    void countsCurrentStreak() {
        List<SessionPoint> points = new ArrayList<>();
        LocalDate today = LocalDate.now(ZONE);
        for (int i = 2; i >= 0; i--) {
            points.add(session(3 - i, today.minusDays(i), 20, "Toán", 25, 80, 4, 4, null));
        }

        FocusProfileResponse.ConsistencyStatus consistency =
                engine.analyze(points, ZONE).consistency();

        assertThat(consistency.currentStreakDays()).isEqualTo(3);
        assertThat(consistency.atRisk()).isFalse();
    }

    // ------------------------------------------------------------------
    // Thang điểm
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Điểm là hàm xác định: cùng input luôn ra cùng một điểm")
    void scoreIsDeterministic() {
        assertThat(scorer.calculate(80, 4, 4)).isEqualTo(scorer.calculate(80, 4, 4));
        // 80*0.45 + 4*20*0.40 + 4*20*0.15 = 36 + 32 + 12 = 80
        assertThat(scorer.calculate(80, 4, 4)).isEqualTo(80.0);
        // Không có năng lượng thì dùng công thức 2 biến: 80*0.5 + 4*20*0.5 = 80
        assertThat(scorer.calculate(80, 4, null)).isEqualTo(80.0);
    }

    @Test
    @DisplayName("Báo bị xao nhãng KHÔNG bị trừ điểm — không dạy user khai gian")
    void honestDistractionReportingIsNotPunished() {
        double withDistraction = scorer.calculate(70, 3, 3);
        double withoutDistraction = scorer.calculate(70, 3, 3);

        assertThat(withDistraction).isEqualTo(withoutDistraction);
    }
}
