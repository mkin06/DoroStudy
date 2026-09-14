package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Nhật ký từng lượt gọi AI — input, output, thời gian phản hồi, có lỗi hay không.
 * Dùng để tính lại COGS thực tế so với dự toán trong financial plan, nên mỗi lượt
 * gọi (kể cả lượt rơi vào fallback) đều phải có đúng một dòng ở đây.
 *
 * Ghi log không bao giờ được làm hỏng luồng của user: lỗi khi ghi chỉ warn rồi bỏ qua.
 */
@Entity
@Table(name = "ai_call_logs", indexes = {
        @Index(name = "idx_ai_call_logs_user_created", columnList = "user_id, created_at"),
        @Index(name = "idx_ai_call_logs_created", columnList = "created_at")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class AiCallLog {

    /** Kết quả cuối cùng user nhận được cho lượt gọi này. */
    public enum Outcome {
        /** Gemini trả lời thật — lượt này tốn tiền. */
        GEMINI,
        /** ai-service trả lời bằng rule-based (thiếu API key hoặc Gemini lỗi). */
        FALLBACK_SERVICE,
        /** Không gọi được ai-service (timeout/chết) — Spring tự sinh feedback mặc định. */
        FALLBACK_LOCAL,
        /** Bị chặn bởi rate limit, không phát sinh chi phí. */
        RATE_LIMITED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Phiên học liên quan; null với các lượt không gắn phiên (ví dụ meta-insights). */
    @Column(name = "session_id")
    private Long sessionId;

    /** "REFLECTION" | "INSIGHTS" — để tách chi phí theo tính năng. */
    @Column(nullable = false, length = 40)
    private String operation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Outcome outcome;

    @Column(name = "request_payload", columnDefinition = "TEXT")
    private String requestPayload;

    @Column(name = "response_payload", columnDefinition = "TEXT")
    private String responsePayload;

    /** Kích thước input/output — xấp xỉ token để ước lượng chi phí mà không cần gọi tokenizer. */
    @Column(name = "request_chars")
    private Integer requestChars;

    @Column(name = "response_chars")
    private Integer responseChars;

    @Column(name = "latency_ms", nullable = false)
    private Long latencyMs;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
