package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.AiCallLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiCallLogRepository extends JpaRepository<AiCallLog, Long> {
}
