package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.devnqminh.studyfocus.model.converter.StringListJsonConverter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Reflection sau mỗi phiên Pomodoro (3 câu hỏi) + feedback do AI sinh ra.
 * Mỗi phiên (StudyTime) chỉ có tối đa 1 reflection.
 */
@Entity
@Table(name = "ai_reflections",
        uniqueConstraints = @UniqueConstraint(name = "uk_ai_reflection_session", columnNames = "session_id"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class AiReflection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private StudyTime session;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Câu 1: hoàn thành bao nhiêu % mục tiêu (slider 0-100)
    @NotNull
    @Min(0) @Max(100)
    @Column(name = "q_completion_percent", nullable = false)
    private Integer completionPercent;

    // Câu 2: mức độ tập trung (emoji scale 1-5)
    @NotNull
    @Min(1) @Max(5)
    @Column(name = "q_focus_level", nullable = false)
    private Integer focusLevel;

    /**
     * Câu 3: năng lượng còn lại sau phiên (1-5).
     *
     * Đây là biến giải thích, không phải biến mô tả: nó cho biết TẠI SAO điểm tập trung
     * tụt (hết pin hay bị xao nhãng), và cho phép dựng đường cong cạn kiệt năng lượng
     * theo độ dài phiên — thứ mà completion% và focusLevel một mình không nói ra được.
     * Nullable vì các reflection lưu trước khi có câu hỏi này.
     */
    @Min(1) @Max(5)
    @Column(name = "q_energy_level")
    private Integer energyLevel;

    // Câu 4: nguyên nhân mất tập trung, lưu dạng JSON ["phone","noise"]
    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "q_distraction_reasons", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> distractionReasons = new ArrayList<>();

    // --- Kết quả AI trả về (null nếu AI service không khả dụng lúc tạo) ---

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    // null khi user chưa đủ lịch sử để so sánh
    @Column(name = "ai_comparison", columnDefinition = "TEXT")
    private String aiComparison;

    @Column(name = "ai_recommendation", columnDefinition = "TEXT")
    private String aiRecommendation;

    @Column(name = "focus_score")
    private Double focusScore;

    /**
     * Nguồn thật của feedback: "gemini" (tốn tiền), "fallback" (rule-based trong ai-service),
     * "unavailable" (ai-service không phản hồi, Spring tự sinh). Cần cho đối chiếu COGS —
     * trước đây trường source do ai-service trả về bị bỏ đi.
     */
    @Column(name = "ai_source", length = 30)
    private String aiSource;

    @NotNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
