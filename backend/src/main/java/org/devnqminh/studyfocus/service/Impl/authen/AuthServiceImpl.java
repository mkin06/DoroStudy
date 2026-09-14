package org.devnqminh.studyfocus.service.Impl.authen;

import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.request.authentication.RegisterRequest;
import org.devnqminh.studyfocus.dto.response.authentication.LoginResponse;
import org.devnqminh.studyfocus.dto.response.user.UserProfileResponse;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.IAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


import java.time.Instant;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements IAuthService {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private  PasswordEncoder passwordEncoder;

    //Implement JWT token generation
    private String generateToken(User user) {
        return "dummy-jwt-token";
    }

    @Override
    public LoginResponse login(LoginRequest loginRequest) {

        User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(
                loginRequest.getPassword(),
                user.getPasswordHash()
        )) {
            throw new RuntimeException("Invalid username or password");
        }

        String token = "dummy-token";
        return new LoginResponse(token, user.getUsername(), user.getId());
    }

    @Override
    public void register(RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists");
        }
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        user.setCreatedAt(Instant.now());
        user.setStatus("ACTIVE");
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findByIdWithTimes(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .location(user.getLocation())
                .image(user.getImage())
                .createdAt(user.getCreatedAt())
                .status(user.getStatus())
                .times(user.getTimes().stream()
                        .map(time -> UserProfileResponse.StudyTimeDTO.builder()
                                .id(time.getId())
                                .duration(time.getDuration())
                                .breakTime(time.getBreakTime())
                                .count(time.getCount())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

}
