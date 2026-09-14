package org.devnqminh.studyfocus.dto.response.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private Long id;
    private String username;
    private String name;
    private String email;
    private String location;
    private String image;
    private Instant createdAt;
    private String status;
    private List<StudyTimeDTO> times;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudyTimeDTO {
        private Long id;
        private Double duration;
        private Double breakTime;
        private Integer count;
    }
}
