package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.IpBanEntity;

import java.time.Instant;

@Repository
public interface IpBanRepository extends R2dbcRepository<IpBanEntity, Long> {

    @Query("""
            SELECT * FROM ip_ban
            WHERE ip = :ip
              AND (permanent = true OR (banned_until IS NOT NULL AND banned_until > :now))
            ORDER BY banned_until DESC
            LIMIT 1
            """)
    Mono<IpBanEntity> findActiveBan(String ip, Instant now);

    @Query("""
            SELECT * FROM ip_ban
            WHERE permanent = true OR (banned_until IS NOT NULL AND banned_until > :now)
            ORDER BY created_at DESC
            """)
    Flux<IpBanEntity> findAllActive(Instant now);

    @Query("""
            SELECT * FROM ip_ban
            WHERE ip = :ip
            ORDER BY created_at DESC
            LIMIT 1
            """)
    Mono<IpBanEntity> findLatestByIp(String ip);
}
