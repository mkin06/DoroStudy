package org.devnqminh.studyfocus.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettingsDTO {

    private Integer focusTime;
    private Integer shortBreak;
    private Integer longBreak;
    private String presetName;
    private Boolean countUpTimer;
    private Boolean deepFocusMode;
}