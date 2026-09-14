package org.devnqminh.studyfocus.config.nudge;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình nhắc chủ động (Web Push).
 *
 * Mặc định TẮT: thông báo đẩy cần một cặp khoá VAPID mà mỗi môi trường phải tự sinh, và một
 * hệ thống tự bật gửi thông báo khi chưa ai cấu hình gì là hành vi tệ. Chưa cấu hình thì
 * phần nhắc trong app vẫn chạy đầy đủ — chỉ thiếu kênh đẩy.
 *
 *   nudge.enabled=true
 *   nudge.vapid.public-key=...       (65 byte base64url — frontend cũng dùng khoá này)
 *   nudge.vapid.private-key=...      (32 byte base64url — BÍ MẬT, không commit)
 *   nudge.vapid.subject=mailto:you@example.com
 *
 * Sinh khoá: {@code mvnw exec:java -Dexec.mainClass=...VapidKeyGenerator}, hoặc chạy trực
 * tiếp class {@code VapidKeyGenerator} trong IDE.
 */
@ConfigurationProperties(prefix = "nudge")
@Getter
@Setter
public class NudgeProperties {

    /** Bật/tắt toàn bộ kênh đẩy. Tắt thì job quét cũng không chạy. */
    private boolean enabled = false;

    /**
     * Ngưỡng khẩn cấp tối thiểu để một lời nhắc được PHÉP đẩy ra ngoài app.
     *
     * Đây là van an toàn quan trọng nhất của tính năng này: mọi loại nhắc đều hiện trong app
     * khi user tự mở, nhưng chỉ loại thật sự có hạn chót (chuỗi ngày sắp đứt, đã tụt nhịp)
     * mới xứng đáng rung điện thoại của người ta.
     */
    private int pushUrgencyThreshold = 70;

    /** Không đẩy thông báo từ giờ này (bao gồm) tới {@link #quietHoursTo}. */
    private int quietHoursFrom = 22;

    /** Giờ kết thúc khoảng im lặng ban đêm. */
    private int quietHoursTo = 7;

    /** Múi giờ dùng để xác định "hôm nay" và khoảng im lặng. */
    private String zone = "Asia/Ho_Chi_Minh";

    /** Lịch quét, mặc định mỗi giờ đúng phút 0. */
    private String scanCron = "0 0 * * * *";

    private Vapid vapid = new Vapid();

    @Getter
    @Setter
    public static class Vapid {
        private String publicKey;
        private String privateKey;

        /** Địa chỉ liên hệ để push service báo lỗi — RFC 8292 bắt buộc có. */
        private String subject = "mailto:admin@dorostudy.local";
    }
}
