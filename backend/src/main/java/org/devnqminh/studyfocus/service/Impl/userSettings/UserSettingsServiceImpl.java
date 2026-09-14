package org.devnqminh.studyfocus.service.Impl.userSettings;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.UserSettingsDTO;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.model.UserSettings;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.repository.UserSettingsRepository;
import org.devnqminh.studyfocus.service.UserSettingsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityNotFoundException;

@Service
@RequiredArgsConstructor
public class UserSettingsServiceImpl implements UserSettingsService {

    private final UserSettingsRepository settingsRepository;
    private final UserRepository userRepository;

    /**
     * Lấy settings của user (hoặc tạo mới nếu chưa có)
     */
    @Override
    @Transactional(readOnly = true)
    public UserSettingsDTO getSettings(Long userId) {
        UserSettings settings = settingsRepository.findByUserId(userId)
                .orElseGet(() -> createDefaultSettings(userId));

        return mapToDTO(settings);
    }

    /**
     * Cập nhật settings
     */
    @Override
    @Transactional
    public UserSettingsDTO updateSettings(Long userId, UserSettingsDTO dto) {
        UserSettings settings = settingsRepository.findByUserId(userId)
                .orElseGet(() -> createNewSettingsEntity(userId));

        // Cập nhật từ DTO
        settings.setFocusTime(dto.getFocusTime());
        settings.setShortBreak(dto.getShortBreak());
        settings.setLongBreak(dto.getLongBreak());
        settings.setPresetName(dto.getPresetName());
        settings.setCountUpTimer(dto.getCountUpTimer());
        settings.setDeepFocusMode(dto.getDeepFocusMode());

        UserSettings saved = settingsRepository.save(settings);
        return mapToDTO(saved);
    }

    /**
     * Tạo settings mới với default values và LƯU VÀO DB
     */
    private UserSettings createDefaultSettings(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User with ID " + userId + " not found"));

        UserSettings settings = new UserSettings();
        settings.setUser(user);
        settings.setFocusTime(25);
        settings.setShortBreak(5);
        settings.setLongBreak(15);
        settings.setPresetName("Classic Pomodoro");
        settings.setCountUpTimer(false);
        settings.setDeepFocusMode(false);
        return settingsRepository.save(settings);
    }

    /**
     * Tạo entity mới CHƯA LƯU (dùng trong update)
     */
    private UserSettings createNewSettingsEntity(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User with ID " + userId + " not found"));

        UserSettings settings = new UserSettings();
        settings.setUser(user);
        settings.setFocusTime(25);
        settings.setShortBreak(5);
        settings.setLongBreak(15);
        settings.setPresetName("Classic Pomodoro");
        settings.setCountUpTimer(false);
        settings.setDeepFocusMode(false);
        return settings;
    }

    /**
     * Map Entity -> DTO
     */
    private UserSettingsDTO mapToDTO(UserSettings settings) {
        return UserSettingsDTO.builder()
                .focusTime(settings.getFocusTime())
                .shortBreak(settings.getShortBreak())
                .longBreak(settings.getLongBreak())
                .presetName(settings.getPresetName())
                                .countUpTimer(settings.isCountUpTimer())
                                .deepFocusMode(settings.isDeepFocusMode())
                .build();
    }
}
