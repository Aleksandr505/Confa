package space.confa.api.service;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import space.confa.api.configuration.properties.JWTProp;
import space.confa.api.model.domain.ConfaUser;
import space.confa.api.model.domain.JWTPair;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class JWTService {

    private final JWTProp jwtProp;
    private final JwtEncoder jwtAuthEncoder;
    private final JwtDecoder jwtAuthDecoder;

    public JWTService(
            JWTProp jwtProp,
            JwtEncoder jwtAuthEncoder,
            JwtDecoder jwtAuthDecoder
    ) {
        this.jwtProp = jwtProp;
        this.jwtAuthEncoder = jwtAuthEncoder;
        this.jwtAuthDecoder = jwtAuthDecoder;
    }

    public Jwt generateAccessJWT(UsernamePasswordAuthenticationToken authentication) {
        var expirationInMillis = Duration.parse(jwtProp.accessExpiration()).toMillis();
        return generateAuthToken(authentication, Instant.now().plusMillis(expirationInMillis));
    }

    public Jwt generateAccessJWT(Map<String, Object> claims, String subject) {
        var expirationInMillis = Duration.parse(jwtProp.accessExpiration()).toMillis();
        return generateAuthToken(Instant.now().plusMillis(expirationInMillis), claims, subject);
    }

    public Jwt generateRefreshJWT(UsernamePasswordAuthenticationToken authentication) {
        var expirationInMillis = Duration.parse(jwtProp.refreshExpiration()).toMillis();
        return generateAuthToken(authentication, Instant.now().plusMillis(expirationInMillis));
    }

    public JWTPair<Jwt, Jwt> generatePairJWT(UsernamePasswordAuthenticationToken authentication) {
        var access = generateAccessJWT(authentication);
        var refresh = generateRefreshJWT(authentication);

        return new JWTPair<>(access, refresh);
    }

    private Jwt generateAuthToken(UsernamePasswordAuthenticationToken authentication, Instant expirationDate) {
        var principal = (ConfaUser) authentication.getPrincipal();
        var subject =  String.valueOf(principal.getId());
        var authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        Map<String, Object> claims = new HashMap<>();
        claims.put("scope", authorities);

        return generateAuthToken(expirationDate, claims, subject);
    }

    private Jwt generateAuthToken(Instant expirationDate, Map<String, Object> claims, String subject) {
        var params = getJwtEncoderParameters(expirationDate, claims, subject);
        return jwtAuthEncoder.encode(params);
    }

    private JwtEncoderParameters getJwtEncoderParameters(
            Instant expirationDate,
            Map<String, Object> claims,
            String subject
    ) {
        var jwsClaims = JwtClaimsSet.builder()
                .claims(claimsMap -> claimsMap.putAll(claims))
                .issuer(jwtProp.issuer())
                .subject(subject)
                .issuedAt(Instant.now())
                .id(UUID.randomUUID().toString())
                .expiresAt(expirationDate)
                .build();

        var jwsHeader = JwsHeader.with(MacAlgorithm.HS256).build();

        return JwtEncoderParameters.from(jwsHeader, jwsClaims);
    }

    public String getAuthJwtSubject(String tokenValue) {
        return jwtAuthDecoder.decode(tokenValue).getSubject();
    }

    public Map<String, Object> getAuthJwtClaims(String tokenValue) {
        return jwtAuthDecoder.decode(tokenValue).getClaims();
    }
}
