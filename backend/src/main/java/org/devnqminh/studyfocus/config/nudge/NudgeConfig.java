package org.devnqminh.studyfocus.config.nudge;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật cấu hình nhắc chủ động và bộ lập lịch.
 *
 * {@code @EnableScheduling} đặt ở đây chứ không đặt trên class ứng dụng để phạm vi của nó
 * gắn liền với tính năng cần tới nó — đọc file này là biết ai đang chạy job nền.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(NudgeProperties.class)
@EnableScheduling
public class NudgeConfig {
}
