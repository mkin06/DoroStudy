package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(name = "note_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NoteType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 80)
    private String name;

    @NotNull
    @Column(nullable = false)
    private Integer status; // 1 active, 0 inactive
}
