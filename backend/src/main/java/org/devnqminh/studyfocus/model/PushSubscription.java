package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;

/**
 * Đăng ký nhận thông báo đẩy của một trình duyệt cụ thể (Web Push API).
 *
 * Một user có thể có nhiều bản ghi — laptop ở nhà, máy ở trường, điện thoại. Khoá thật của
 * bảng là {@code endpoint}: đó là URL mà push service (FCM, Mozilla, WNS...) cấp riêng cho
 * từng cài đặt trình duyệt, và cũng chính là địa chỉ ta POST tới khi muốn nhắc.
 *
 * {@code p256dh} và {@code auth} là khoá để mã hoá payload. Hiện tại hệ thống gửi push RỖNG
 * (service worker nhận tín hiệu rồi tự gọi API lấy nội dung), nên chưa dùng tới — nhưng vẫn
 * lưu, vì trình duyệt chỉ cấp chúng đúng một lần lúc đăng ký, không xin lại được.
 */
@Entity
@Table(name = "push_subscriptions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** URL push service cấp cho trình duyệt này. Dài, và là định danh duy nhất. */
    @NotBlank
    @Column(nullable = false, unique = true, length = 512)
    private String endpoint;

    @Column(length = 255)
    private String p256dh;

    @Column(length = 255)
    private String auth;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Lần cuối đã đẩy thông báo qua đăng ký này. Dùng để chặn nhắc quá một lần mỗi ngày —
     * giới hạn đó quan trọng ngang phần chọn nội dung: nhắc nhiều làm hỏng cả nhắc đúng.
     */
    @Column(name = "last_nudged_at")
    private Instant lastNudgedAt;

    /** Loại nhắc gần nhất đã gửi, để lần sau không lặp y hệt và để đo loại nào hiệu quả. */
    @Column(name = "last_nudge_type", length = 40)
    private String lastNudgeType;

    /**
     * false khi push service báo đăng ký đã chết (404/410) — giữ lại bản ghi thay vì xoá để
     * còn biết user từng bật thông báo rồi mất, khác hẳn với user chưa bao giờ bật.
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (active == null) {
            active = true;
        }
    }
}
