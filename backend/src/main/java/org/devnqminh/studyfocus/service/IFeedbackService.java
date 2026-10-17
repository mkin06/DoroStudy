package org.devnqminh.studyfocus.service;

import org.devnqminh.studyfocus.dto.request.feedback.FeedbackCreateRequest;
import org.devnqminh.studyfocus.dto.response.feedback.FeedbackResponse;

import java.util.List;
import java.util.Map;

public interface IFeedbackService {
    FeedbackResponse createFeedback(FeedbackCreateRequest request, Long userId);
    List<FeedbackResponse> getAllFeedback();
    FeedbackResponse updateStatus(Long id, String status);
    void deleteFeedback(Long id);
    Map<String, Object> getFeedbackStats();
}
