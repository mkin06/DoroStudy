package org.devnqminh.studyfocus.dto.request.feedback;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackCreateRequest {
    private String kind; // "ux" or "ai"
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
}
