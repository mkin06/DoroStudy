package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "notes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    // FK -> User (NOT NULL)
    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // FK -> Calendar (có thể NULL nếu note không gắn ngày/lịch)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calendar_id")
    private Calendar calendar;

    // FK -> Type (NOT NULL)
    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "type_id", nullable = false)
    private NoteType type;

    /**
     * Cột đã có sẵn trong database/01_schema.sql nhưng trước đây entity không map.
     *
     * Không có mốc thời gian thì không cách nào biết ghi chú nào thuộc phiên học nào — và
     * đó chính là thứ để AI đối chiếu "môn bạn khai" với "thứ bạn thật sự viết ra".
     */
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /**
     * Sửa note trong lúc học cũng tính là làm việc trong phiên, nên mốc này mới là mốc dùng.
     *
     * Cố ý để nullable ở tầng entity dù schema SQL khai NOT NULL: database đang chạy có sẵn
     * các note cũ chưa có cột này, và bắt Hibernate thêm một cột NOT NULL vào bảng đã có dữ
     * liệu là cách chắc chắn làm hỏng lần khởi động tiếp theo của người khác trong nhóm.
     * Note cũ có mốc null thì đơn giản là không thuộc phiên nào — đúng sự thật.
     */
    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
