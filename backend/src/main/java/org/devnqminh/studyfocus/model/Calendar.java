package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;


import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "calendars")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Calendar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // date(date)
    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    // content(String)
    @Column(columnDefinition = "TEXT")
    private String content;

    @OneToMany(mappedBy = "calendar", cascade = CascadeType.ALL, orphanRemoval = false)
    @Builder.Default
    private List<Note> notes = new ArrayList<>();
}
