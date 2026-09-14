package org.devnqminh.studyfocus.service.nudge;

import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.config.nudge.NudgeProperties;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPrivateKeySpec;
import java.time.Instant;
import java.util.Base64;

/**
 * Ký JWT theo chuẩn VAPID (RFC 8292) để push service tin rằng thông báo đúng là do server
 * của DoroStudy gửi.
 *
 * Cố ý viết tay thay vì thêm thư viện web-push:
 *
 *   Hệ thống chỉ gửi push RỖNG (service worker tự gọi API lấy nội dung), nên phần khó nhất
 *   của thư viện — mã hoá payload bằng AES128GCM + HKDF — hoàn toàn không cần tới. Thứ thật
 *   sự cần chỉ là một JWT ES256, mà JDK làm được sẵn. Đổi lại là project không phải kéo thêm
 *   một dependency (và cả chuỗi phụ thuộc của nó) chỉ để dùng 5% chức năng.
 *
 * Một chi tiết dễ sai: {@link Signature} của Java trả chữ ký ECDSA ở dạng DER, còn JWS ES256
 * yêu cầu R‖S thô đúng 64 byte. Không chuyển đổi thì push service trả 401 mà không nói lý do.
 */
@Component
@Slf4j
public class VapidSigner {

    private static final String CURVE = "secp256r1";

    /** Token sống 12 tiếng — dưới trần 24 tiếng của RFC 8292, và đủ dài để cache lại. */
    private static final long TOKEN_TTL_SECONDS = 12 * 3600;

    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64URL_DEC = Base64.getUrlDecoder();

    private final NudgeProperties properties;
    private final PrivateKey privateKey;

    public VapidSigner(NudgeProperties properties) {
        this.properties = properties;
        this.privateKey = loadPrivateKey(properties.getVapid().getPrivateKey());
    }

    /** true khi đã cấu hình đủ khoá để thật sự gửi được push. */
    public boolean isConfigured() {
        return privateKey != null
                && properties.getVapid().getPublicKey() != null
                && !properties.getVapid().getPublicKey().isBlank();
    }

    public String publicKey() {
        return properties.getVapid().getPublicKey();
    }

    /**
     * JWT cho một push endpoint cụ thể.
     *
     * @param endpoint URL push service; audience của token là origin của URL này — token ký
     *                 cho Firebase không dùng lại được cho Mozilla, đó là chủ đích của chuẩn
     */
    public String createToken(String endpoint) {
        URI uri = URI.create(endpoint);
        String audience = uri.getScheme() + "://" + uri.getHost()
                + (uri.getPort() == -1 ? "" : ":" + uri.getPort());

        String header = B64URL.encodeToString(
                "{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String payload = B64URL.encodeToString(String.format(
                "{\"aud\":\"%s\",\"exp\":%d,\"sub\":\"%s\"}",
                audience,
                Instant.now().getEpochSecond() + TOKEN_TTL_SECONDS,
                properties.getVapid().getSubject()).getBytes(StandardCharsets.UTF_8));

        String signingInput = header + "." + payload;
        try {
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(privateKey);
            signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            return signingInput + "." + B64URL.encodeToString(derToJose(signature.sign()));
        } catch (Exception e) {
            throw new IllegalStateException("Không ký được VAPID token: " + e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------

    /**
     * Nạp khoá riêng từ 32 byte base64url — đúng định dạng mà mọi công cụ sinh khoá VAPID
     * (web-push CLI, {@link VapidKeyGenerator}) xuất ra.
     */
    private PrivateKey loadPrivateKey(String base64Url) {
        if (base64Url == null || base64Url.isBlank()) {
            log.info("Chưa cấu hình nudge.vapid.private-key — thông báo đẩy tắt, "
                    + "phần nhắc trong app vẫn chạy bình thường.");
            return null;
        }
        try {
            byte[] raw = B64URL_DEC.decode(base64Url.trim());
            ECPrivateKeySpec spec = new ECPrivateKeySpec(new BigInteger(1, raw), p256Params());
            return KeyFactory.getInstance("EC").generatePrivate(spec);
        } catch (Exception e) {
            log.error("nudge.vapid.private-key không hợp lệ, thông báo đẩy sẽ tắt: {}", e.getMessage());
            return null;
        }
    }

    static ECParameterSpec p256Params() throws Exception {
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec(CURVE));
        return params.getParameterSpec(ECParameterSpec.class);
    }

    /**
     * DER {@code SEQUENCE { INTEGER r, INTEGER s }} → R‖S thô, mỗi số đúng 32 byte.
     *
     * DER cắt byte 0 ở đầu và thêm byte 0 đệm khi bit cao nhất bật, nên độ dài r và s thay
     * đổi giữa các lần ký; JOSE thì yêu cầu cố định. Phải canh phải vào ô 32 byte.
     */
    static byte[] derToJose(byte[] der) {
        int offset = 3;
        if (der[1] == (byte) 0x81) {
            offset = 4;   // dạng độ dài dài (hiếm với P-256, nhưng đúng chuẩn thì phải xử lý)
        }
        int rLength = der[offset] & 0xFF;
        int sOffset = offset + rLength + 2;
        int sLength = der[sOffset] & 0xFF;

        byte[] out = new byte[64];
        copyRightAligned(der, offset + 1, rLength, out, 0);
        copyRightAligned(der, sOffset + 1, sLength, out, 32);
        return out;
    }

    /** Chép một số nguyên DER vào ô 32 byte, bỏ byte đệm 0 ở đầu nếu có. */
    private static void copyRightAligned(byte[] src, int srcPos, int length, byte[] dest, int destOffset) {
        int from = srcPos;
        int len = length;
        while (len > 32 && src[from] == 0) {
            from++;
            len--;
        }
        System.arraycopy(src, from, dest, destOffset + (32 - len), len);
    }

}
