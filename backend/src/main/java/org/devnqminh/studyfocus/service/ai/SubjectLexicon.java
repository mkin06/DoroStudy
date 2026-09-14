package org.devnqminh.studyfocus.service.ai;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Đoán môn học từ chữ user viết ra.
 *
 * Vì sao là từ khoá chứ không phải AI: việc này phải chạy được cho MỌI phiên, kể cả khi user
 * đã hết quota Gemini và kể cả khi ai-service chết. Một kết luận nhạy cảm như "bạn khai học
 * Toán nhưng thật ra đang học Tiếng Anh" mà lúc có lúc không thì tệ hơn là không có.
 *
 * Đổi lại, phương pháp này thô, nên mọi kết luận đều kèm ngưỡng số lần khớp tối thiểu và
 * khoảng cách tối thiểu với môn đứng nhì — thà im lặng còn hơn tố oan user.
 *
 * Toàn bộ so khớp chạy trên chuỗi đã BỎ DẤU: sinh viên gõ vội thường viết "dao ham",
 * "tu vung" không dấu, và một bộ từ khoá chỉ có dấu sẽ bỏ sót đúng nhóm ghi chú vội vàng
 * nhất — cũng là nhóm phản ánh trung thực nhất họ đang làm gì.
 */
@Component
public class SubjectLexicon {

    /**
     * Từ khoá theo môn. Cố ý chọn từ ĐẶC TRƯNG cho môn: "phương trình" chỉ Toán mới hay
     * dùng, còn "bài tập" thì môn nào cũng có nên không được đưa vào — từ chung chỉ làm
     * mọi môn cùng khớp và phá luôn phép so sánh.
     */
    private static final Map<String, List<String>> KEYWORDS = new LinkedHashMap<>();

    static {
        KEYWORDS.put("Toán", List.of("toan", "dao ham", "tich phan", "phuong trinh", "ham so",
                "hinh hoc", "vecto", "logarit", "xac suat", "ma tran", "gioi han", "bat dang thuc",
                "luong giac", "cap so", "to hop"));
        KEYWORDS.put("Vật lý", List.of("vat ly", "gia toc", "dien tro", "dong dien", "quang hoc",
                "dao dong", "hat nhan", "newton", "tu truong", "dien truong", "cong suat", "ma sat"));
        KEYWORDS.put("Hoá học", List.of("hoa hoc", "phan ung", "nguyen to", "axit", "bazo",
                "oxi hoa", "este", "ankan", "dung dich", "hoa tri", "kim loai kiem", "bang tuan hoan"));
        KEYWORDS.put("Sinh học", List.of("sinh hoc", "te bao", "adn", "di truyen", "protein",
                "quang hop", "nhiem sac the", "enzyme", "kieu gen", "he sinh thai"));
        KEYWORDS.put("Ngữ văn", List.of("ngu van", "tac pham", "nghi luan", "bien phap tu tu",
                "truyen ngan", "nhan vat", "tho", "tac gia", "phan tich doan", "van hoc"));
        KEYWORDS.put("Lịch sử", List.of("lich su", "trieu dai", "chien tranh", "cach mang",
                "hiep dinh", "khoi nghia", "nien dai", "phong trao", "thuc dan"));
        KEYWORDS.put("Địa lý", List.of("dia ly", "khi hau", "dan so", "ban do", "dia hinh",
                "kinh tuyen", "luu vuc", "do thi hoa", "tai nguyen"));
        KEYWORDS.put("Tiếng Anh", List.of("tieng anh", "english", "vocabulary", "grammar",
                "ielts", "toeic", "phrasal verb", "tu vung", "ngu phap", "present perfect",
                "listening", "speaking", "reading", "writing task"));
        KEYWORDS.put("Lập trình", List.of("lap trinh", "java", "python", "javascript", "react",
                "database", "sql", "api", "thuat toan", "debug", "git", "function", "class",
                "backend", "frontend", "compile"));
        KEYWORDS.put("Kinh tế", List.of("kinh te", "cung cau", "lam phat", "gdp", "marketing",
                "doanh thu", "chi phi", "ke toan", "thi truong", "dau tu"));
    }

    /**
     * Đếm số lần khớp từ khoá của từng môn trong một đoạn text.
     *
     * @return môn → số lần khớp (chỉ chứa môn có ít nhất 1 lần khớp)
     */
    public Map<String, Integer> countMatches(String text) {
        Map<String, Integer> hits = new LinkedHashMap<>();
        if (text == null || text.isBlank()) {
            return hits;
        }
        String normalized = normalize(text);
        for (var entry : KEYWORDS.entrySet()) {
            int count = 0;
            for (String keyword : entry.getValue()) {
                count += occurrences(normalized, keyword);
            }
            if (count > 0) {
                hits.put(entry.getKey(), count);
            }
        }
        return hits;
    }

    /**
     * Tên môn chuẩn ứng với chuỗi user tự gõ ("toan 12", "IELTS writing", "OOP java").
     *
     * @return tên chuẩn, hoặc null khi không nhận ra — không nhận ra là chuyện bình thường,
     *         user có quyền đặt tên môn bất kỳ và hệ thống không được ép họ vào danh sách
     */
    public String canonicalize(String freeText) {
        if (freeText == null || freeText.isBlank()) {
            return null;
        }
        Map<String, Integer> hits = countMatches(freeText);
        return hits.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    /**
     * Bỏ dấu tiếng Việt và hạ chữ thường. "Đạo hàm" → "dao ham".
     *
     * Ký tự đ/Đ phải xử lý riêng: nó không phải "d" cộng dấu phụ nên NFD không tách ra được.
     */
    public String normalize(String text) {
        String lower = text.toLowerCase(Locale.ROOT).replace('đ', 'd');
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\s+", " ");
    }

    /** Đếm số lần một từ khoá xuất hiện, không chồng lấn. */
    private int occurrences(String haystack, String needle) {
        int count = 0;
        int from = 0;
        while (true) {
            int at = haystack.indexOf(needle, from);
            if (at < 0) {
                return count;
            }
            count++;
            from = at + needle.length();
        }
    }
}
