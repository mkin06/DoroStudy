package org.devnqminh.studyfocus.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Đăng ký nhận thông báo mà trình duyệt trả về từ {@code pushManager.subscribe()}.
 *
 * Ba trường này do chính trình duyệt sinh ra, frontend chỉ chuyển tiếp nguyên vẹn.
 *
 * @param endpoint URL push service cấp riêng cho cài đặt trình duyệt này
 * @param p256dh   khoá công khai của trình duyệt (chỉ cần khi gửi push có payload)
 * @param auth     secret xác thực của trình duyệt
 */
public record PushSubscriptionRequest(

        @NotBlank(message = "endpoint không được để trống")
        String endpoint,

        String p256dh,

        String auth
) {
}
