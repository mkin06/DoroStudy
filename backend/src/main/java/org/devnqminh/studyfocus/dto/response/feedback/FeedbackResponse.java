package org.devnqminh.studyfocus.dto.response.feedback;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackResponse {
    private Long id;
    private Long userId;
    private String userName;
    private String userEmail;
    private String kind;
    private String comment;
    private String area;
    private String issueType;
    private Integer usefulness;
    private String actionability;
    private String distraction;
    private String copingAction;
    private String outcome;
    private String requestedSupport;
    private Long reflectionId;
    private String status;
    private Instant createdAt;
}
