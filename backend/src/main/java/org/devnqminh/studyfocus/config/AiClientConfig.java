package org.devnqminh.studyfocus.config;

import org.devnqminh.studyfocus.config.ai.AiQuotaProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;

@Configuration
@EnableAsync
@EnableConfigurationProperties(AiQuotaProperties.class)
public class AiClientConfig {

    @Bean
    public RestClient aiRestClient(
            @Value("${ai.service.url}") String baseUrl,
            @Value("${ai.service.connect-timeout-ms:2000}") int connectTimeoutMs,
            @Value("${ai.service.read-timeout-ms:5000}") int readTimeoutMs) {

        // Timeout bắt buộc: nếu AI service treo thì backend không được treo theo.
        // read-timeout là lưới an toàn ngoài cùng (5s theo yêu cầu); ai-service tự đặt
        // timeout ngắn hơn cho Gemini nên bình thường nó trả fallback trước khi tới mốc này.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }

    /**
     * Pool riêng cho job Meta-Learning. Tách khỏi pool mặc định của Spring để một hàng đợi
     * insights dài không chiếm chỗ của các tác vụ async khác, và ngược lại.
     */
    @Bean("aiTaskExecutor")
    public TaskExecutor aiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("ai-insights-");
        // Hàng đợi đầy thì bỏ job cũ nhất: insights luôn được tính lại ở reflection sau,
        // không đáng để chặn thread đang phục vụ user.
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.DiscardOldestPolicy());
        executor.initialize();
        return executor;
    }
}
