package org.devnqminh.studyfocus.dto.response;

public record StatsResponse(
         Double totalStudyTime,
         Long totalSessions,
         Double averageSessionDuration,
         Integer totalPomodoros,
         Integer currentStreak,
         Integer bestStreak,
         Integer thisweekPomodoros
) {
}
