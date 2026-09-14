package org.devnqminh.studyfocus.service.ai;

import org.devnqminh.studyfocus.dto.response.NoteInsight;
import org.devnqminh.studyfocus.model.Note;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kết luận nặng nhất mà hệ thống dám nói ra là "bạn khai học môn này nhưng thật ra đang học
 * môn khác". Đúng thì user thấy được hiểu; sai thì họ thấy bị vu oan và không tin gì nữa.
 *
 * Nên bộ test này dành phần lớn cho các trường hợp phải IM LẶNG hoặc phải hạ giọng: ghi chú
 * quá ngắn, ghi chú trộn hai môn, ghi chú không nhận ra môn nào.
 */
class NoteAnalyzerTest {

    private final SubjectLexicon lexicon = new SubjectLexicon();
    private final NoteAnalyzer analyzer = new NoteAnalyzer(lexicon);

    private Note note(String title, String content) {
        return Note.builder().title(title).content(content).build();
    }

    // ------------------------------------------------------------------
    // Không có bằng chứng thì không nói
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Không ghi chú gì: không đưa ra kết luận nào cả")
    void silentWithoutNotes() {
        assertThat(analyzer.analyze(List.of(), "Toán")).isEmpty();
        assertThat(analyzer.analyze(null, "Toán")).isEmpty();
    }

    @Test
    @DisplayName("Ghi chú rỗng chữ: coi như không có ghi chú")
    void silentOnBlankNotes() {
        assertThat(analyzer.analyze(List.of(note("", "")), "Toán")).isEmpty();
    }

    @Test
    @DisplayName("Ghi chú quá ngắn: ghi nhận có viết, nhưng không dám đoán môn")
    void doesNotGuessFromTooFewWords() {
        NoteInsight insight = analyzer.analyze(List.of(note("dao ham", "")), "Toán").orElseThrow();

        assertThat(insight.verdict()).isEqualTo("NOTED_ONLY");
        assertThat(insight.detectedSubject()).isNull();
    }

    @Test
    @DisplayName("Ghi chú trộn hai môn ngang nhau: không kết luận môn nào cả")
    void staysSilentOnMixedNotes() {
        NoteInsight insight = analyzer.analyze(List.of(note("Ôn thi",
                "Đạo hàm và tích phân chương 1. Sau đó học vocabulary và grammar tiếng Anh unit 5.")),
                null).orElseThrow();

        assertThat(insight.verdict()).isEqualTo("NOTED_ONLY");
        assertThat(insight.detectedSubject()).isNull();
    }

    // ------------------------------------------------------------------
    // Gõ bừa thì không được khen là đã làm việc
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Gõ bừa chữ cái: nói thẳng là chưa đọc được, không khen \"bạn đã viết N từ\"")
    void refusesToPraiseKeyboardMash() {
        NoteInsight insight = analyzer
                .analyze(List.of(note("shgiuyitgyygasgbwg", "kjdhfgkjsdhfgkjshdfg")), "Toán")
                .orElseThrow();

        assertThat(insight.verdict()).isEqualTo("UNREADABLE");
        assertThat(insight.message()).doesNotContain("từ trong phiên");
        assertThat(insight.detectedSubject()).isNull();
    }

    @Test
    @DisplayName("Gõ bừa số: cũng không tính là ghi chú")
    void refusesToPraiseRandomDigits() {
        NoteInsight insight = analyzer
                .analyze(List.of(note("475082789430759832752", "99999999999999")), "Toán")
                .orElseThrow();

        assertThat(insight.verdict()).isEqualTo("UNREADABLE");
    }

    @Test
    @DisplayName("Ghi chú thật có kèm số trang, số chương: KHÔNG được coi là rác")
    void realNotesWithNumbersStayReadable() {
        NoteInsight insight = analyzer.analyze(List.of(note("Chương 3",
                "Bài 5 trang 42: giải phương trình bậc hai, tính đạo hàm hàm số 2024.")),
                "Toán").orElseThrow();

        assertThat(insight.verdict()).isNotEqualTo("UNREADABLE");
    }

    @Test
    @DisplayName("Từ tiếng Anh dài như apprehensive vẫn phải được coi là chữ thật")
    void longEnglishWordsStayReadable() {
        NoteInsight insight = analyzer.analyze(List.of(note("Unit 5",
                "vocabulary: apprehensive, meticulous, unprecedented. grammar present perfect.")),
                null).orElseThrow();

        assertThat(insight.verdict()).isNotEqualTo("UNREADABLE");
    }

    @Test
    @DisplayName("Vài chữ rác lẫn trong ghi chú thật: vẫn tính là đọc được")
    void toleratesSomeNoiseInsideRealNotes() {
        NoteInsight insight = analyzer.analyze(List.of(note("Ôn tập",
                "Giải phương trình bậc hai, tính đạo hàm hàm số, khảo sát đồ thị. asdkjhqwe")),
                "Toán").orElseThrow();

        assertThat(insight.verdict()).isNotEqualTo("UNREADABLE");
    }

    // ------------------------------------------------------------------
    // Có bằng chứng rõ thì phải nói
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Khai Toán nhưng ghi toàn từ vựng tiếng Anh: nói thẳng là lệch")
    void detectsSubjectMismatch() {
        NoteInsight insight = analyzer.analyze(List.of(note("Unit 5",
                "vocabulary: meticulous, apprehensive. grammar: present perfect. "
                        + "Luyện ielts listening và speaking mỗi ngày.")),
                "Toán").orElseThrow();

        assertThat(insight.verdict()).isEqualTo("MISMATCH");
        assertThat(insight.declaredSubject()).isEqualTo("Toán");
        assertThat(insight.detectedSubject()).isEqualTo("Tiếng Anh");
        assertThat(insight.message()).contains("Toán").contains("Tiếng Anh");
    }

    @Test
    @DisplayName("Chưa gắn môn: đoán môn từ ghi chú và mời gắn")
    void suggestsSubjectWhenUntagged() {
        NoteInsight insight = analyzer.analyze(List.of(note("Bài tập",
                "Giải phương trình bậc hai, tính đạo hàm của hàm số, ôn lại logarit.")),
                null).orElseThrow();

        assertThat(insight.verdict()).isEqualTo("SUBJECT_DETECTED");
        assertThat(insight.detectedSubject()).isEqualTo("Toán");
        assertThat(insight.declaredSubject()).isNull();
        assertThat(insight.confidence()).isGreaterThan(50);
    }

    @Test
    @DisplayName("Khai gì viết nấy: xác nhận ngắn gọn để user biết hệ thống có đọc")
    void confirmsWhenNotesMatchSubject() {
        NoteInsight insight = analyzer.analyze(List.of(note("Chương 2",
                "Đạo hàm hàm hợp, tích phân từng phần, khảo sát hàm số và vẽ đồ thị.")),
                "Toán 12").orElseThrow();

        assertThat(insight.verdict()).isEqualTo("ON_TRACK");
        assertThat(insight.detectedSubject()).isEqualTo("Toán");
    }

    @Test
    @DisplayName("Gõ không dấu vẫn nhận ra được — đó mới là kiểu ghi chú vội thường gặp")
    void handlesTextWithoutDiacritics() {
        NoteInsight insight = analyzer.analyze(List.of(note("Lap trinh",
                "Viet function tinh tong, fix bug trong database, hoc them api va thuat toan sap xep.")),
                null).orElseThrow();

        assertThat(insight.verdict()).isEqualTo("SUBJECT_DETECTED");
        assertThat(insight.detectedSubject()).isEqualTo("Lập trình");
    }

    @Test
    @DisplayName("Đếm đúng số ghi chú và số từ — bằng chứng khách quan về công sức bỏ ra")
    void countsNotesAndWords() {
        NoteInsight insight = analyzer.analyze(List.of(
                note("A", "Giải phương trình bậc hai và tính đạo hàm hàm số"),
                note("B", "Ôn logarit, tích phân từng phần, khảo sát đồ thị")),
                "Toán").orElseThrow();

        assertThat(insight.noteCount()).isEqualTo(2);
        assertThat(insight.wordCount()).isGreaterThan(15);
    }

    // ------------------------------------------------------------------
    // Bộ từ khoá
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Nhận ra tên môn từ chuỗi user tự gõ, kể cả khi kèm số hay chữ thừa")
    void canonicalizesFreeTextSubject() {
        assertThat(lexicon.canonicalize("Toán 12")).isEqualTo("Toán");
        assertThat(lexicon.canonicalize("IELTS writing task 2")).isEqualTo("Tiếng Anh");
        assertThat(lexicon.canonicalize("java oop")).isEqualTo("Lập trình");
        assertThat(lexicon.canonicalize("Môn tự chọn của riêng tôi")).isNull();
    }

    @Test
    @DisplayName("Bỏ dấu đúng, gồm cả chữ đ")
    void normalizesVietnameseText() {
        assertThat(lexicon.normalize("Đạo hàm")).isEqualTo("dao ham");
        assertThat(lexicon.normalize("Từ vựng Tiếng Anh")).isEqualTo("tu vung tieng anh");
    }
}
