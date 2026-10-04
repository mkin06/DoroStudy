package org.devnqminh.studyfocus.service.nudge;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/**
 * Sinh cặp khoá VAPID cho một môi trường. Chạy một lần, dán kết quả vào
 * application.properties, rồi quên nó đi.
 *
 * Cố ý KHÔNG để ứng dụng tự sinh khoá lúc khởi động: khoá đổi thì mọi đăng ký nhận thông
 * báo hiện có chết, và không ai hiểu vì sao thông báo im lặng sau một lần restart.
 *
 * Class này cố ý chỉ dùng thư viện chuẩn của Java — không Spring, không logger. Nhờ vậy
 * chạy được bằng đúng một dòng, không cần dựng classpath của cả ứng dụng:
 *
 *   cd backend
 *   mvnw -o compile
 *   java -cp target/classes org.devnqminh.studyfocus.service.nudge.VapidKeyGenerator
 */
public final class VapidKeyGenerator {

    private static final String CURVE = "secp256r1";
    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();

    private VapidKeyGenerator() {
    }

    public static void main(String[] args) throws Exception {
        String[] pair = generateKeyPair();
        System.out.println();
        System.out.println("Dán các dòng sau vào backend/src/main/resources/application.properties:");
        System.out.println();
        System.out.println("nudge.enabled=true");
        System.out.println("nudge.vapid.public-key=" + pair[0]);
        System.out.println("nudge.vapid.private-key=" + pair[1]);
        System.out.println("nudge.vapid.subject=mailto:doi-cua-ban@example.com");
        System.out.println();
        System.out.println("Khoá riêng là bí mật — đừng commit. Khoá công khai frontend tự lấy qua API.");
    }

    /**
     * @return [publicKeyBase64Url (65 byte, dạng điểm không nén), privateKeyBase64Url (32 byte)]
     */
    public static String[] generateKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec(CURVE));
        KeyPair pair = generator.generateKeyPair();

        // Trình duyệt chỉ nhận khoá công khai ở dạng điểm không nén: 0x04 ‖ X ‖ Y.
        ECPublicKey publicKey = (ECPublicKey) pair.getPublic();
        byte[] uncompressed = new byte[65];
        uncompressed[0] = 0x04;
        System.arraycopy(toFixed32(publicKey.getW().getAffineX()), 0, uncompressed, 1, 32);
        System.arraycopy(toFixed32(publicKey.getW().getAffineY()), 0, uncompressed, 33, 32);

        byte[] priv = toFixed32(((ECPrivateKey) pair.getPrivate()).getS());
        return new String[]{B64URL.encodeToString(uncompressed), B64URL.encodeToString(priv)};
    }

    /** BigInteger → đúng 32 byte: bỏ byte dấu 0 ở đầu, đệm 0 khi số ngắn hơn. */
    private static byte[] toFixed32(BigInteger value) {
        byte[] bytes = value.toByteArray();
        byte[] out = new byte[32];
        if (bytes.length >= 32) {
            System.arraycopy(bytes, bytes.length - 32, out, 0, 32);
        } else {
            System.arraycopy(bytes, 0, out, 32 - bytes.length, bytes.length);
        }
        return out;
    }
}
