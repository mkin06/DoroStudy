package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.StudyTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.util.List;
import java.sql.Date;
import java.time.Instant;

@Repository
public interface StudyTimeRepository extends JpaRepository<StudyTime, Long> {
    // Tìm sessions theo user, sắp xếp mới nhất trước
    List<StudyTime> findByUserIdOrderByIdDesc(Long userId);

    /**
     * Đọc thẳng DTO cho màn hình lịch sử. Tránh hydrate StudyTime + User rồi mới map lại,
     * và cho phép giới hạn cửa sổ thời gian ngay trong DB.
     */
    @Query("""
        SELECT new org.devnqminh.studyfocus.dto.response.SessionResponse(
            st.id, st.duration, st.breakTime, st.count, st.subject,
            st.startTime, st.createdAt, u.id, u.name)
        FROM StudyTime st JOIN st.user u
        WHERE u.id = :userId AND (:since IS NULL OR st.createdAt >= :since)
        ORDER BY st.id DESC
        """)
    List<org.devnqminh.studyfocus.dto.response.SessionResponse> findSessionResponses(
            @Param("userId") Long userId, @Param("since") Instant since);
    // Tìm ngày học bằng userId
    @Query(value = """
        SELECT DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00')) AS study_day
        FROM times t
        WHERE t.user_id = :userId
        GROUP BY DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00'))
        HAVING SUM(t.`count`) >= 1
        ORDER BY study_day ASC
        """, nativeQuery = true)
List<Date> findActiveStudyDaysByUserId(@Param("userId") Long userId);

    /** Gom bốn phép tổng hợp thành một round-trip SQL. */
    @Query(value = """
        SELECT
            COALESCE(SUM(t.duration), 0) AS totalStudyTime,
            COUNT(*) AS totalSessions,
            COALESCE(SUM(t.`count`), 0) AS totalPomodoros,
            COALESCE(SUM(CASE WHEN t.created_at >= :weekStart AND t.created_at < :weekEnd
                THEN t.`count` ELSE 0 END), 0) AS thisWeekPomodoros
        FROM times t
        WHERE t.user_id = :userId
        """, nativeQuery = true)
    StatsAggregate getStatsAggregate(@Param("userId") Long userId,
                                     @Param("weekStart") Instant weekStart,
                                     @Param("weekEnd") Instant weekEnd);

    interface StatsAggregate {
        Number getTotalStudyTime();
        Number getTotalSessions();
        Number getTotalPomodoros();
        Number getThisWeekPomodoros();
    }
}
