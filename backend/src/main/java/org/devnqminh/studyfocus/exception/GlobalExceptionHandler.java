package org.devnqminh.studyfocus.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Chuẩn hoá mọi lỗi API về một dạng JSON có field "message".
 *
 * Trước đây service ném RuntimeException trần nên Spring trả 500 cho cả những case
 * đáng ra là 404/403, và body mặc định không có "message" — frontend đọc `body.message`
 * luôn nhận undefined rồi hiện thông báo chung chung.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(AiQuotaExceededException.class)
    public ResponseEntity<Map<String, Object>> handleQuota(AiQuotaExceededException e,
                                                          HttpServletRequest request) {
        Map<String, Object> body = baseBody(HttpStatus.TOO_MANY_REQUESTS, e.getMessage(), request);
        body.put("quotaExceeded", true);
        body.put("plan", e.getPlan());
        body.put("limit", e.getLimit());
        body.put("used", e.getUsed());
        // Reflection đã lưu — frontend hiển thị luôn, không bắt user nhập lại
        body.put("reflection", e.getReflection());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException e,
                                                                    HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        String message = e.getReason() == null ? status.getReasonPhrase() : e.getReason();
        return ResponseEntity.status(status).body(baseBody(status, message, request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e,
                                                                HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .collect(Collectors.joining("; "));
        if (message.isBlank()) {
            message = "Dữ liệu gửi lên không hợp lệ";
        }
        return ResponseEntity.badRequest()
                .body(baseBody(HttpStatus.BAD_REQUEST, message, request));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e,
                                                                     HttpServletRequest request) {
        return ResponseEntity.badRequest()
                .body(baseBody(HttpStatus.BAD_REQUEST, e.getMessage(), request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e,
                                                                HttpServletRequest request) {
        log.error("Lỗi không lường trước tại {} {}", request.getMethod(), request.getRequestURI(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(baseBody(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Có lỗi xảy ra phía máy chủ. Vui lòng thử lại.", request));
    }

    private Map<String, Object> baseBody(HttpStatus status, String message, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", request.getRequestURI());
        return body;
    }
}
