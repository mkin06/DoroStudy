package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(
        name = "user_backgrounds",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_background", columnNames = {"user_id", "background_id"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class UserBackground {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "background_id", nullable = false)
    private Background background;

    @NotNull
    @Column(nullable = false)
    private Boolean isFavourite;

    @PrePersist
    void prePersist() {
        if (isFavourite == null) isFavourite = false;
    }
}
