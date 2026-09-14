package org.devnqminh.studyfocus.service;

import org.devnqminh.studyfocus.dto.UserSettingsDTO;

public interface UserSettingsService {

    UserSettingsDTO getSettings(Long userId);

    UserSettingsDTO updateSettings(Long userId, UserSettingsDTO dto);
}
