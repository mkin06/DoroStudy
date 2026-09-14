package org.devnqminh.studyfocus.service.nudge;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Gửi một thông báo đẩy RỖNG tới push service của trình duyệt.
 *
 * "Rỗng" là lựa chọn thiết kế, không phải thiếu sót:
 *
 *   Push có payload phải được mã hoá đầu-cuối bằng khoá của trình duyệt (AES128GCM + HKDF).
 *   Thay vào đó ta chỉ đánh thức service worker, để nó gọi {@code GET /api/nudges/current}
 *   bằng cookie phiên của user rồi tự dựng nội dung. Đổi lại ba điều đáng giá: không phải
 *   tự viết crypto dễ sai, nội dung luôn là MỚI NHẤT tại thời điểm hiện lên (user vừa học
 *   xong thì thông báo cũ không còn bật ra nữa), và không có dữ liệu học tập nào đi qua
 *   máy chủ của Google hay Mozilla.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebPushSender {

    /** Push service giữ thông báo tối đa 6 tiếng — quá đó thì lời nhắc cũng hết ý nghĩa. */
    private static final int TTL_SECONDS = 6 * 3600;

    private final VapidSigner vapidSigner;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /**
     * @return kết quả gửi; caller dùng nó để biết có phải tắt đăng ký đã chết hay không
     */
    public Result send(String endpoint) {
        if (!vapidSigner.isConfigured()) {
            return Result.SKIPPED;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .header("Authorization",
                            "vapid t=" + vapidSigner.createToken(endpoint) + ", k=" + vapidSigner.publicKey())
                    .header("TTL", String.valueOf(TTL_SECONDS))
                    .header("Urgency", "normal")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();

            if (status >= 200 && status < 300) {
                return Result.SENT;
            }
            // 404/410 = trình duyệt đã gỡ đăng ký này. Không phải lỗi của ta, và thử lại
            // mãi chỉ tốn request — đánh dấu chết rồi thôi.
            if (status == 404 || status == 410) {
                log.info("Đăng ký push đã hết hiệu lực (HTTP {}), tắt bản ghi", status);
                return Result.GONE;
            }
            log.warn("Push service trả HTTP {}: {}", status, truncate(response.body()));
            return Result.FAILED;
        } catch (Exception e) {
            log.warn("Không gửi được push tới {}: {}", truncate(endpoint), e.getMessage());
            return Result.FAILED;
        }
    }

    public enum Result {
        /** Đã đẩy thành công. */
        SENT,
        /** Chưa cấu hình VAPID nên bỏ qua — không phải lỗi. */
        SKIPPED,
        /** Đăng ký đã chết, cần đánh dấu inactive. */
        GONE,
        /** Lỗi tạm thời; lần quét sau thử lại. */
        FAILED
    }

    private String truncate(String text) {
        if (text == null) {
            return "";
        }
        return text.length() > 200 ? text.substring(0, 200) : text;
    }
}
