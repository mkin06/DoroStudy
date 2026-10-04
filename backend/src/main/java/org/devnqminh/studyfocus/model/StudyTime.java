package org.devnqminh.studyfocus.model;

import java.time.Instant;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(name = "times")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class StudyTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // duration(float)
    @NotNull
    @Column(nullable = false)
    private Double duration;

    // break_time(float)
    @NotNull
    @Column(name = "break_time", nullable = false)
    private Double breakTime;

    // count(int) - số pomodoro / số phiên
    @NotNull
    @Column(nullable = false)
    private Integer count;

    // môn học (optional) - user có thể bỏ qua, phiên sẽ là "untagged"
    @Column(length = 100)
    private String subject;

    /**
     * POMODORO | CUSTOM | STOPWATCH — chuẩn hoá từ `mode` frontend gửi lên.
     * Giữ đúng bộ giá trị của cột ENUM trong database/01_schema.sql.
     */
    @Column(name = "session_type", length = 20)
    private String sessionType;

    /**
     * Thời điểm bắt đầu phiên. Frontend gửi lên khi biết chính xác; nếu không có thì
     * suy ra createdAt - duration. Cần cho Meta-Learning Insights (khung giờ tập trung
     * tốt nhất), nên không thể suy đoán lại mỗi lần đọc.
     */
    @Column(name = "start_time")
    private Instant startTime;

    /** Điểm tập trung do AI chấm sau khi có reflection — không phải user nhập. */
    @Column(name = "focus_score")
    private Double focusScore;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @NotNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (startTime == null && duration != null) {
            startTime = createdAt.minusSeconds(Math.round(duration * 60));
        }
    }
}
