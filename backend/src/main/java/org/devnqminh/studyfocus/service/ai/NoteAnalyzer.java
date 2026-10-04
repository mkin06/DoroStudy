package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.response.NoteInsight;
import org.devnqminh.studyfocus.model.Note;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Đối chiếu môn user KHAI với thứ user THẬT SỰ viết trong phiên.
 *
 * Nguyên tắc: chỉ nói khi chắc.
 *
 *   Câu "bạn khai học Toán nhưng thật ra đang học Tiếng Anh" rất mạnh — đúng thì user thấy
 *   hệ thống hiểu mình đến mức đáng sợ, sai thì họ thấy bị vu oan và không tin gì nữa. Vì
 *   vậy nó chỉ được phát ra khi môn đoán được khớp nhiều gấp {@link #MISMATCH_RATIO} lần môn
 *   đã khai, và vượt ngưỡng số lần khớp tối thiểu.
 *
 * Không có ghi chú thì trả về rỗng — im lặng, không đoán bừa về một phiên mình không có
 * bằng chứng gì.
 */
@Component
@RequiredArgsConstructor
public class NoteAnalyzer {

    /** Ít hơn ngần này lần khớp thì chỉ là trùng chữ ngẫu nhiên, không phải dấu hiệu môn học. */
    private static final int MIN_HITS_TO_DETECT = 2;

    /** Môn thắng phải bỏ xa môn nhì bấy nhiêu lần, nếu không thì ghi chú là hỗn hợp. */
    private static final double DOMINANCE_RATIO = 2.0;

    /** Muốn kết luận "khai một đằng làm một nẻo" thì bằng chứng phải áp đảo hơn nữa. */
    private static final double MISMATCH_RATIO = 3.0;

    /** Ghi chú quá ngắn không đủ căn cứ đoán môn — vài từ thì trùng gì cũng có thể. */
    private static final int MIN_WORDS_TO_DETECT = 8;

    /** Dưới ngần này ký tự thì không đủ cơ sở phán ghi chú có đọc được hay không. */
    private static final int MIN_CHARS_TO_JUDGE_QUALITY = 6;

    /** Dưới tỉ lệ này token trông giống chữ thật thì coi như ghi chú không đọc được. */
    private static final double MIN_READABLE_RATIO = 0.5;

    /** Từ tiếng Việt/tiếng Anh dài hơn ngần này gần như chắc chắn là gõ bừa. */
    private static final int MAX_WORD_LENGTH = 14;

    /** "ngh" là cụm phụ âm dài nhất của tiếng Việt; dài hơn nữa thì không phải chữ. */
    private static final int MAX_CONSONANT_RUN = 3;

    /** Số dài quá mức không phải ghi chú học tập, chỉ là gõ bừa lên bàn phím số. */
    private static final int MAX_PLAIN_NUMBER_LENGTH = 4;

    private final SubjectLexicon lexicon;

    /**
     * @param notes           ghi chú user chạm vào trong phiên
     * @param declaredSubject môn user gõ ở ô Task (có thể null)
     */
    public Optional<NoteInsight> analyze(List<Note> notes, String declaredSubject) {
        if (notes == null || notes.isEmpty()) {
            return Optional.empty();
        }

        StringBuilder text = new StringBuilder();
        for (Note note : notes) {
            if (note.getTitle() != null) {
                text.append(note.getTitle()).append(' ');
            }
            if (note.getContent() != null) {
                text.append(note.getContent()).append(' ');
            }
        }
        String combined = text.toString().trim();
        int wordCount = combined.isEmpty() ? 0 : combined.split("\\s+").length;
        if (wordCount == 0) {
            return Optional.empty();
        }

        String declared = declaredSubject == null || declaredSubject.isBlank()
                ? null : declaredSubject.trim();

        // Kiểm tra chất lượng TRƯỚC khi đoán môn: ghi chú gõ bừa mà vẫn được khen "bạn đã
        // viết 21 từ" là hệ thống tự dạy user rằng gõ gì cũng được. Nó cũng làm hỏng chính
        // tính năng đối chiếu môn — thứ chỉ có giá trị khi ghi chú là chữ thật.
        if (isUnreadable(lexicon.normalize(combined))) {
            return Optional.of(new NoteInsight(
                    "UNREADABLE", "🤔",
                    "Ghi chú chưa có nội dung đọc được — viết vài ý chính để AI kiểm chứng bạn học gì.",
                    declared, null, notes.size(), wordCount, 0));
        }

        Map<String, Integer> hits = lexicon.countMatches(combined);
        Detection detection = detect(hits, wordCount);
        String declaredCanonical = declared == null ? null : lexicon.canonicalize(declared);

        // 1. Khai một đằng, viết một nẻo
        if (declared != null && detection != null && !detection.subject().equals(declaredCanonical)) {
            int declaredHits = declaredCanonical == null ? 0 : hits.getOrDefault(declaredCanonical, 0);
            if (detection.hits() >= declaredHits * MISMATCH_RATIO && detection.hits() >= MIN_HITS_TO_DETECT + 1) {
                return Optional.of(new NoteInsight(
                        "MISMATCH", "⚠️",
                        String.format("Bạn đặt \"%s\" nhưng ghi chú nghiêng hẳn về %s.",
                                declared, detection.subject()),
                        declared, detection.subject(), notes.size(), wordCount, detection.confidence()));
            }
        }

        // 2. Chưa gắn môn nhưng ghi chú đã nói rõ đang học gì
        if (declared == null && detection != null) {
            return Optional.of(new NoteInsight(
                    "SUBJECT_DETECTED", "🏷️",
                    String.format("Ghi chú của bạn trông giống môn %s — gắn môn để AI theo dõi riêng.",
                            detection.subject()),
                    null, detection.subject(), notes.size(), wordCount, detection.confidence()));
        }

        // 3. Khai gì viết nấy — xác nhận ngắn gọn, vì user cũng cần biết hệ thống có đọc
        if (declared != null && detection != null && detection.subject().equals(declaredCanonical)) {
            return Optional.of(new NoteInsight(
                    "ON_TRACK", "✅",
                    String.format("Ghi chú khớp môn %s — bạn bám đúng việc đã đặt ra.", declared),
                    declared, detection.subject(), notes.size(), wordCount, detection.confidence()));
        }

        // 4. Có viết nhưng không đoán được môn: vẫn ghi nhận công sức, không phán đoán gì thêm
        return Optional.of(new NoteInsight(
                "NOTED_ONLY", "📝",
                String.format("Bạn viết %d từ trong phiên này.", wordCount),
                declared, null, notes.size(), wordCount, 0));
    }

    // ------------------------------------------------------------------

    /**
     * Ghi chú có phải chữ thật không.
     *
     * Không cần từ điển: chỉ cần loại những thứ chắc chắn KHÔNG phải chữ — token dài bất
     * thường, chuỗi số dài, cụm phụ âm không đọc nổi, token không có nguyên âm. Cách này
     * bỏ sót được (một từ bịa 8 chữ cái đọc được vẫn lọt), nhưng nó không bao giờ tố oan
     * một ghi chú thật, và đó mới là hướng sai duy nhất chấp nhận được ở đây.
     */
    private boolean isUnreadable(String normalized) {
        String text = normalized.trim();
        if (text.length() < MIN_CHARS_TO_JUDGE_QUALITY) {
            return false;   // quá ngắn để phán xét
        }

        int readable = 0;
        int judged = 0;
        for (String raw : text.split("\\s+")) {
            String token = raw.replaceAll("^[^a-z0-9]+|[^a-z0-9]+$", "");
            if (token.isEmpty()) {
                continue;
            }
            if (token.chars().allMatch(Character::isDigit)) {
                // Số ngắn là bình thường trong ghi chú ("chương 3", "unit 5"); số dài thì không
                if (token.length() > MAX_PLAIN_NUMBER_LENGTH) {
                    judged++;
                }
                continue;
            }
            judged++;
            if (looksLikeWord(token)) {
                readable++;
            }
        }
        return judged > 0 && readable / (double) judged < MIN_READABLE_RATIO;
    }

    /** Một token trông giống chữ: đủ ngắn, có nguyên âm, không có cụm phụ âm bất khả đọc. */
    private boolean looksLikeWord(String token) {
        if (token.length() > MAX_WORD_LENGTH) {
            return false;
        }
        int consonantRun = 0;
        boolean hasVowel = false;
        for (char c : token.toCharArray()) {
            // y tính là nguyên âm: tiếng Việt bỏ dấu có "quy", "ky", "my"...
            if ("aeiouy".indexOf(c) >= 0) {
                hasVowel = true;
                consonantRun = 0;
            } else if (Character.isDigit(c)) {
                consonantRun = 0;
            } else {
                consonantRun++;
                if (consonantRun > MAX_CONSONANT_RUN) {
                    return false;
                }
            }
        }
        return hasVowel;
    }

    private record Detection(String subject, int hits, int confidence) {
    }

    /**
     * Môn khớp nhiều nhất, với điều kiện nó thật sự nổi trội. Ghi chú trộn hai môn ngang
     * nhau thì trả null: đó là một buổi học trộn, không phải một môn.
     */
    private Detection detect(Map<String, Integer> hits, int wordCount) {
        if (hits.isEmpty() || wordCount < MIN_WORDS_TO_DETECT) {
            return null;
        }
        List<Map.Entry<String, Integer>> ranked = hits.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
                .toList();

        int top = ranked.get(0).getValue();
        if (top < MIN_HITS_TO_DETECT) {
            return null;
        }
        int runnerUp = ranked.size() > 1 ? ranked.get(1).getValue() : 0;
        if (runnerUp > 0 && top < runnerUp * DOMINANCE_RATIO) {
            return null;
        }
        return new Detection(ranked.get(0).getKey(), top, Math.min(90, 40 + top * 12));
    }
}
