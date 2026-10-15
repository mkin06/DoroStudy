package org.devnqminh.studyfocus.dto.response.authentication;

public class LoginResponse {
    private String username;
    private Long userId;

    public LoginResponse(String username, Long userId) {
        this.username = username;
        this.userId = userId;
    }
    public String getUsername() {return this.username;}
    public Long getUserId() {return this.userId;}
}
