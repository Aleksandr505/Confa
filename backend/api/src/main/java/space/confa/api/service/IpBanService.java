package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.IpBanRepository;
import space.confa.api.model.entity.IpBanEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IpBanService {

    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final int FAILURE_THRESHOLD = 6;
    private static final Duration BAN_COUNTER_TTL = Duration.ofHours(24);
    private static final List<BanRule> RULES = List.of(
            new BanRule(1, Duration.ofMinutes(15)),
            new BanRule(2, Duration.ofHours(1))
    );

    private final ReactiveStringRedisTemplate redis;
    private final IpBanRepository ipBanRepository;

    public Mono<Void> ensureIpAllowed(String ip) {
        if (ip == null || ip.isBlank()) {
            return Mono.empty();
        }
        return ipBanRepository.findActiveBan(ip, Instant.now())
                .flatMap(ban -> Mono.<Void>error(new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        Boolean.TRUE.equals(ban.getPermanent())
                                ? "Your IP was blocked"
                                : "Your IP was temporary blocked"
                )))
                .then();
    }

    public Mono<Void> registerFailure(String ip, String username) {
        if (ip == null || ip.isBlank()) {
            return Mono.empty();
        }
        String ipKey = keyForIp(ip);

        return incrementWithTtl(ipKey, FAILURE_WINDOW)
                .flatMap(total -> maybeBan(ip, total))
                .onErrorResume(e -> {
                    log.warn("Failed to register login failure for ip={}", ip, e);
                    return Mono.empty();
                });
    }

    private Mono<Long> incrementWithTtl(String key, Duration ttl) {
        return redis.opsForValue()
                .increment(key)
                .flatMap(count -> {
                    if (count == 1L) {
                        return redis.expire(key, ttl).thenReturn(count);
                    }
                    return Mono.just(count);
                });
    }

    private Mono<Void> maybeBan(String ip, Long failures) {
        if (failures < FAILURE_THRESHOLD) {
            return Mono.empty();
        }
        return incrementWithTtl(keyForBan(ip), BAN_COUNTER_TTL)
                .flatMap(banCount -> {
                    BanRule rule = RULES.stream()
                            .filter(entry -> banCount >= entry.threshold())
                            .reduce((first, second) -> second)
                            .orElse(RULES.get(0));
                    return createBan(ip, rule.duration());
                });
    }

    private Mono<Void> createBan(String ip, Duration duration) {
        if (ip == null) {
            return Mono.empty();
        }
        Instant until = Instant.now().plus(duration);
        return ipBanRepository.findLatestByIp(ip)
                .defaultIfEmpty(IpBanEntity.builder().ip(ip).build())
                .flatMap(existing -> {
                    existing.setReason("Too many failed login attempts");
                    existing.setBannedUntil(until);
                    existing.setPermanent(Boolean.TRUE.equals(existing.getPermanent()));
                    return ipBanRepository.save(existing);
                })
                .flatMap(saved -> clearFailureCounter(ip))
                .onErrorResume(e -> {
                    log.warn("Failed to persist IP ban for {}: {}", ip, e.getMessage());
                    return Mono.empty();
                })
                .then();
    }

    private record BanRule(int threshold, Duration duration) {}

    private String keyForIp(String ip) {
        return "fail:ip:" + ip;
    }

    private String keyForBan(String ip) {
        return "ban:ip:" + ip;
    }

    private Mono<Void> clearFailureCounter(String ip) {
        return redis.delete(keyForIp(ip)).then();
    }
}
