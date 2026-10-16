package org.devnqminh.studyfocus.dto.response.authentication;

public class LoginResponse {
    private String username;
    private Long userId;
    private String role;

    public LoginResponse(String username, Long userId) {
        this(username, userId, "USER");
    }

    public LoginResponse(String username, Long userId, String role) {
        this.username = username;
        this.userId = userId;
        this.role = role != null ? role : "USER";
    }

    public String getUsername() {return this.username;}
    public Long getUserId() {return this.userId;}
    public String getRole() {return this.role;}
}
