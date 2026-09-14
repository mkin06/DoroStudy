package org.devnqminh.studyfocus.service.Impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.SessionRequest;
import org.devnqminh.studyfocus.dto.response.SessionResponse;
import org.devnqminh.studyfocus.dto.response.StatsResponse;
import org.devnqminh.studyfocus.model.StudyTime;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.StudyTimeRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.IStudyTimeService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudyTimeServiceImpl  implements IStudyTimeService {
    private final StudyTimeRepository studyTimeRepository;
    private final UserRepository userRepository;
    private static final ZoneId STREAK_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Lưu một study session
     */
    @Transactional
    @Override
    public SessionResponse saveSession(SessionRequest request, Long userId) {
        //find user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        StudyTime studyTime = StudyTime.builder()
                .duration(request.duration())
                .breakTime(request.breakTime())
                .count(request.count())
                .subject(normalizeSubject(request.subject()))
                .sessionType(normalizeMode(request.mode()))
                .startTime(request.startTime())
                .user(user)
                .build();
        //save to db
        StudyTime savedStudyTime = studyTimeRepository.save(studyTime);
        return toSessionResponse(savedStudyTime);
    }

    /**
     * Lấy tất cả sessions của user
     */
    @Override
    public List<SessionResponse> getUserSessions(Long userId) {
        List<StudyTime> sessions = studyTimeRepository.findByUserIdOrderByIdDesc(userId);
        return sessions.stream()
                .map(this::toSessionResponse)
                .collect(Collectors.toList());
    }

    @Override
    public SessionResponse getSessionById(Long id, Long userId) {
        StudyTime session = studyTimeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        //kiem tra ownership (session co thuoc ve user nay khong)

        if(!session.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to this user");
        }
        return toSessionResponse(session);
    }

    /**
     * Xóa session
     */
    @Override
    public void deleteSession(Long id, Long userId) {
        StudyTime session = studyTimeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        //check ownership
        if(!session.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session does not belong to this user");
        }
        studyTimeRepository.delete(session);
    }


    /**
     * Lấy statistics của user
     */
    @Override
    public StatsResponse getUserStats(Long userId) {
        Double totalTime = studyTimeRepository.getTotalStudyTimeByUserId(userId);
        Long totalSessions = studyTimeRepository.countByUserId(userId);
        Integer totalPomodoros = studyTimeRepository.getTotalPomodorosByUserId(userId);
        //tinh trung binh
        Double avgDuration = totalSessions > 0 ? (totalTime / totalSessions) : 0.0;
        
        List<LocalDate> activeDays = studyTimeRepository.findActiveStudyDaysByUserId(userId)
            .stream()
            .map(Date::toLocalDate)
            .collect(Collectors.toList());
        //tính chuỗi
        StreakResult streak = calculateStreak(activeDays, LocalDate.now(STREAK_ZONE));
        // tính pomodoros tuần này
        Integer thisWeekPomodoros = Optional
            .ofNullable(studyTimeRepository.getThisWeekPomodorosByUserId(userId))
            .orElse(0);
        return new StatsResponse(
                totalTime,
                totalSessions,
                avgDuration,
                totalPomodoros,
                streak.currentStreak(),
                streak.bestStreak(),
                thisWeekPomodoros
        );
    }
    private StreakResult calculateStreak(List<LocalDate> orderedActiveDays, LocalDate today) {
    if (orderedActiveDays == null || orderedActiveDays.isEmpty()) {
        return new StreakResult(0, 0);
    }

    int bestStreak = 1;
    int running = 1;

    for (int i = 1; i < orderedActiveDays.size(); i++) {
        LocalDate prev = orderedActiveDays.get(i - 1);
        LocalDate curr = orderedActiveDays.get(i);

        if (curr.equals(prev.plusDays(1))) {
            running++;
        } else {
            running = 1;
        }
        bestStreak = Math.max(bestStreak, running);
    }

    Set<LocalDate> daySet = new HashSet<>(orderedActiveDays);

    LocalDate cursor = null;
    if (daySet.contains(today)) {
        cursor = today;
    } else if (daySet.contains(today.minusDays(1))) {
        cursor = today.minusDays(1);
    }

    int currentStreak = 0;
    while (cursor != null && daySet.contains(cursor)) {
        currentStreak++;
        cursor = cursor.minusDays(1);
    }

    return new StreakResult(currentStreak, bestStreak);
}

    private record StreakResult(int currentStreak, int bestStreak) {}

    /** Bỏ khoảng trắng thừa; chuỗi rỗng coi như không tag môn học. */
    private String normalizeSubject(String subject) {
        if (subject == null || subject.isBlank()) {
            return null;
        }
        return subject.trim();
    }

    /**
     * Ánh xạ `mode` của frontend về bộ giá trị session_type trong schema.
     * Mode lạ được coi là CUSTOM thay vì làm hỏng insert.
     */
    private String normalizeMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return "POMODORO";
        }
        return switch (mode.trim().toLowerCase(Locale.ROOT)) {
            case "pomodoro" -> "POMODORO";
            case "stopwatch" -> "STOPWATCH";
            default -> "CUSTOM";
        };
    }

    private SessionResponse toSessionResponse(StudyTime studyTime) {
        return new SessionResponse(
                studyTime.getId(),
                studyTime.getDuration(),
                studyTime.getBreakTime(),
                studyTime.getCount(),
                studyTime.getSubject(),
                studyTime.getUser().getId(),
                studyTime.getUser().getName()
        );
    }

    
}
