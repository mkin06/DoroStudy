package org.devnqminh.studyfocus.service;

import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.request.authentication.RegisterRequest;
import org.devnqminh.studyfocus.dto.response.authentication.LoginResponse;
import org.devnqminh.studyfocus.dto.response.user.UserProfileResponse;

public interface IAuthService {
    LoginResponse login(LoginRequest loginRequest);
    void register(RegisterRequest request);
    UserProfileResponse getUserProfile(Long userId);

}
