package space.confa.api.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimiter {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public Mono<Boolean> tryConsume(String key) {
        return Mono.fromSupplier(() -> getBucket(key))
                .map(bucket -> bucket.tryConsume(1));
    }

    private Bucket getBucket(String key) {
        return buckets.computeIfAbsent(key, k -> newBucket());
    }

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(5)
                .refillGreedy(5, Duration.ofMinutes(10))
                .build();

        return Bucket.builder()
                .addLimit(limit)
                .build();
    }
}
