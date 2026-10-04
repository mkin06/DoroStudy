package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByUser_Id(Long userId);

    /**
     * Ghi chú user chạm vào trong một khoảng thời gian — dùng để lấy đúng những note thuộc
     * về một phiên học vừa kết thúc.
     *
     * Lọc theo updatedAt chứ không phải createdAt: phần lớn user giữ một note dài rồi viết
     * thêm vào mỗi buổi, nên ngày tạo là ngày họ mở note lần đầu và nói rất ít về hôm nay.
     */
    List<Note> findByUser_IdAndUpdatedAtBetween(Long userId, Instant from, Instant to);
}
