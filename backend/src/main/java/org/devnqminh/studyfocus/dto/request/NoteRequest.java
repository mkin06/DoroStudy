package org.devnqminh.studyfocus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NoteRequest(
        @NotBlank(message = "Tiêu đề không được để trống")
        @Size(max = 200, message = "Title must be at most 200 characters")
        String title,

        String content
) {}
