package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.AiReflection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiReflectionRepository extends JpaRepository<AiReflection, Long> {

    Optional<AiReflection> findBySessionId(Long sessionId);

    boolean existsBySessionId(Long sessionId);

    // Lịch sử 7 reflection gần nhất — dùng làm context cho AI
    List<AiReflection> findTop7ByUserIdOrderByIdDesc(Long userId);

    // Cửa sổ phân tích của FocusInsightEngine (mới nhất trước; service tự đảo lại)
    List<AiReflection> findTop60ByUserIdOrderByIdDesc(Long userId);

    long countByUserId(Long userId);

    List<AiReflection> findByUserIdOrderByIdDesc(Long userId);
}
