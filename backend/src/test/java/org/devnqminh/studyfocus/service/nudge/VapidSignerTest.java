package org.devnqminh.studyfocus.service.nudge;

import org.devnqminh.studyfocus.config.nudge.NudgeProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phần crypto viết tay là chỗ dễ sai nhất trong tính năng này, và khi sai thì push service
 * chỉ trả 401 trống không — không có cách nào lần ra nguyên nhân từ log production.
 *
 * Vì vậy test ở đây kiểm đúng thứ dễ hỏng: chữ ký ECDSA của Java ở dạng DER có được chuyển
 * sang R‖S 64 byte của JOSE đúng hay không, kể cả trong những lần ký mà r hoặc s ngắn hơn
 * 32 byte (xảy ra ngẫu nhiên, khoảng 1/256 mỗi lần) — nên phải ký lặp nhiều lần chứ không
 * chỉ một lần lấy may.
 */
class VapidSignerTest {

    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    private VapidSigner signerWith(String publicKey, String privateKey) {
        NudgeProperties properties = new NudgeProperties();
        properties.getVapid().setPublicKey(publicKey);
        properties.getVapid().setPrivateKey(privateKey);
        properties.getVapid().setSubject("mailto:test@dorostudy.local");
        return new VapidSigner(properties);
    }

    @Test
    @DisplayName("Chưa cấu hình khoá: không ném lỗi, chỉ báo chưa sẵn sàng")
    void reportsNotConfiguredInsteadOfCrashing() {
        VapidSigner signer = signerWith(null, null);

        assertThat(signer.isConfigured()).isFalse();
    }

    @Test
    @DisplayName("Khoá riêng rác: tắt push chứ không làm sập ứng dụng lúc khởi động")
    void survivesInvalidPrivateKey() {
        VapidSigner signer = signerWith("abc", "khong-phai-base64-hop-le!!!");

        assertThat(signer.isConfigured()).isFalse();
    }

    @Test
    @DisplayName("Token ký ra phải verify được bằng chính khoá công khai, lặp lại nhiều lần")
    void producesVerifiableTokens() throws Exception {
        String[] pair = VapidKeyGenerator.generateKeyPair();
        VapidSigner signer = signerWith(pair[0], pair[1]);
        PublicKey publicKey = decodePublicKey(pair[0]);

        assertThat(signer.isConfigured()).isTrue();

        // Ký nhiều lần: mỗi chữ ký ECDSA dùng một số ngẫu nhiên khác nhau, nên độ dài r và s
        // trong DER thay đổi giữa các lần. Một lần chạy đơn lẻ có thể không chạm tới nhánh
        // cần cắt/đệm byte trong derToJose.
        for (int i = 0; i < 50; i++) {
            String token = signer.createToken("https://fcm.googleapis.com/fcm/send/abc123");
            String[] parts = token.split("\\.");
            assertThat(parts).hasSize(3);

            byte[] rawSignature = B64URL.decode(parts[2]);
            assertThat(rawSignature).hasSize(64);

            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            assertThat(verifier.verify(joseToDer(rawSignature)))
                    .as("chữ ký lần thứ %d phải hợp lệ", i)
                    .isTrue();
        }
    }

    @Test
    @DisplayName("Audience của token là origin của push endpoint, không phải cả URL")
    void audienceIsTheEndpointOrigin() throws Exception {
        String[] pair = VapidKeyGenerator.generateKeyPair();
        VapidSigner signer = signerWith(pair[0], pair[1]);

        String token = signer.createToken("https://updates.push.services.mozilla.com/wpush/v2/xyz");
        String payload = new String(B64URL.decode(token.split("\\.")[1]), StandardCharsets.UTF_8);

        assertThat(payload).contains("\"aud\":\"https://updates.push.services.mozilla.com\"");
        assertThat(payload).contains("\"sub\":\"mailto:test@dorostudy.local\"");
        assertThat(payload).doesNotContain("/wpush/");
    }

    @Test
    @DisplayName("Khoá công khai sinh ra đúng 65 byte, dạng điểm không nén mà trình duyệt cần")
    void publicKeyIsUncompressedPoint() throws Exception {
        String[] pair = VapidKeyGenerator.generateKeyPair();

        byte[] publicKey = B64URL.decode(pair[0]);
        assertThat(publicKey).hasSize(65);
        assertThat(publicKey[0]).isEqualTo((byte) 0x04);
        assertThat(B64URL.decode(pair[1])).hasSize(32);
    }

    // ------------------------------------------------------------------

    private PublicKey decodePublicKey(String base64Url) throws Exception {
        byte[] raw = B64URL.decode(base64Url);
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 33, 65));
        return KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), VapidSigner.p256Params()));
    }

    /** Phép nghịch của derToJose, chỉ dùng trong test để verify lại chữ ký. */
    private byte[] joseToDer(byte[] jose) {
        byte[] r = trimLeadingZeros(Arrays.copyOfRange(jose, 0, 32));
        byte[] s = trimLeadingZeros(Arrays.copyOfRange(jose, 32, 64));
        byte[] rDer = withSignByte(r);
        byte[] sDer = withSignByte(s);

        byte[] der = new byte[6 + rDer.length + sDer.length];
        int i = 0;
        der[i++] = 0x30;
        der[i++] = (byte) (4 + rDer.length + sDer.length);
        der[i++] = 0x02;
        der[i++] = (byte) rDer.length;
        System.arraycopy(rDer, 0, der, i, rDer.length);
        i += rDer.length;
        der[i++] = 0x02;
        der[i++] = (byte) sDer.length;
        System.arraycopy(sDer, 0, der, i, sDer.length);
        return der;
    }

    private byte[] trimLeadingZeros(byte[] value) {
        int start = 0;
        while (start < value.length - 1 && value[start] == 0) {
            start++;
        }
        return Arrays.copyOfRange(value, start, value.length);
    }

    /** DER coi số là có dấu, nên số có bit cao nhất bật phải thêm một byte 0 ở đầu. */
    private byte[] withSignByte(byte[] value) {
        if ((value[0] & 0x80) == 0) {
            return value;
        }
        byte[] out = new byte[value.length + 1];
        System.arraycopy(value, 0, out, 1, value.length);
        return out;
    }
}
