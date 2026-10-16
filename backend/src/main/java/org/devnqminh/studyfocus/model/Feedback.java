package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "feedbacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_name", length = 120)
    private String userName;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Column(nullable = false, length = 20)
    private String kind; // "ux" or "ai"

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(length = 50)
    private String area;

    @Column(name = "issue_type", length = 50)
    private String issueType;

    private Integer usefulness;

    @Column(length = 50)
    private String actionability;

    @Column(length = 50)
    private String distraction;

    @Column(name = "coping_action", length = 50)
    private String copingAction;

    @Column(length = 50)
    private String outcome;

    @Column(name = "requested_support", length = 50)
    private String requestedSupport;

    @Column(name = "reflection_id")
    private Long reflectionId;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "NEW"; // NEW, READ, RESOLVED

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = "NEW";
    }
}
