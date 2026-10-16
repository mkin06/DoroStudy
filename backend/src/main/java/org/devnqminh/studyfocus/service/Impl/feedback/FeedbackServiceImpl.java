package org.devnqminh.studyfocus.service.Impl.feedback;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.feedback.FeedbackCreateRequest;
import org.devnqminh.studyfocus.dto.response.feedback.FeedbackResponse;
import org.devnqminh.studyfocus.model.Feedback;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.FeedbackRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.IFeedbackService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedbackServiceImpl implements IFeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public FeedbackResponse createFeedback(FeedbackCreateRequest request, Long userId) {
        String userName = "Khách (Chưa đăng nhập)";
        String userEmail = null;

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                userName = user.getName() != null && !user.getName().trim().isEmpty()
                        ? user.getName().trim()
                        : user.getUsername();
                userEmail = user.getEmail();
            }
        }

        Feedback feedback = Feedback.builder()
                .userId(userId)
                .userName(userName)
                .userEmail(userEmail)
                .kind(request.getKind() != null ? request.getKind().toLowerCase() : "ux")
                .comment(request.getComment() != null ? request.getComment().trim() : "")
                .area(request.getArea())
                .issueType(request.getIssueType())
                .usefulness(request.getUsefulness())
                .actionability(request.getActionability())
                .distraction(request.getDistraction())
                .copingAction(request.getCopingAction())
                .outcome(request.getOutcome())
                .requestedSupport(request.getRequestedSupport())
                .reflectionId(request.getReflectionId())
                .status("NEW")
                .createdAt(Instant.now())
                .build();

        Feedback saved = feedbackRepository.save(feedback);
        return mapToResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FeedbackResponse> getAllFeedback() {
        return feedbackRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public FeedbackResponse updateStatus(Long id, String status) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy góp ý với id: " + id));
        feedback.setStatus(status != null ? status.toUpperCase() : "NEW");
        Feedback updated = feedbackRepository.save(feedback);
        return mapToResponse(updated);
    }

    @Override
    @Transactional
    public void deleteFeedback(Long id) {
        if (!feedbackRepository.existsById(id)) {
            throw new RuntimeException("Không tìm thấy góp ý với id: " + id);
        }
        feedbackRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getFeedbackStats() {
        List<Feedback> all = feedbackRepository.findAllByOrderByCreatedAtDesc();
        long total = all.size();
        long newCount = all.stream().filter(f -> "NEW".equalsIgnoreCase(f.getStatus())).count();
        long uxCount = all.stream().filter(f -> "ux".equalsIgnoreCase(f.getKind())).count();
        long aiCount = all.stream().filter(f -> "ai".equalsIgnoreCase(f.getKind())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("newCount", newCount);
        stats.put("uxCount", uxCount);
        stats.put("aiCount", aiCount);
        return stats;
    }

    private FeedbackResponse mapToResponse(Feedback feedback) {
        return FeedbackResponse.builder()
                .id(feedback.getId())
                .userId(feedback.getUserId())
                .userName(feedback.getUserName())
                .userEmail(feedback.getUserEmail())
                .kind(feedback.getKind())
                .comment(feedback.getComment())
                .area(feedback.getArea())
                .issueType(feedback.getIssueType())
                .usefulness(feedback.getUsefulness())
                .actionability(feedback.getActionability())
                .distraction(feedback.getDistraction())
                .copingAction(feedback.getCopingAction())
                .outcome(feedback.getOutcome())
                .requestedSupport(feedback.getRequestedSupport())
                .reflectionId(feedback.getReflectionId())
                .status(feedback.getStatus())
                .createdAt(feedback.getCreatedAt())
                .build();
    }
}
