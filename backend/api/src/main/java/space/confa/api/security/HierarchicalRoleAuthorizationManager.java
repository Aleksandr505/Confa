package space.confa.api.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDecisionVoter;
import org.springframework.security.access.ConfigAttribute;
import org.springframework.security.access.vote.RoleHierarchyVoter;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.ReactiveAuthorizationManager;
import org.springframework.security.core.Authentication;
import reactor.core.publisher.Mono;

import java.util.Collections;

@RequiredArgsConstructor
public class HierarchicalRoleAuthorizationManager<T> implements ReactiveAuthorizationManager<T> {

    private final String authority;

    private final RoleHierarchyVoter roleHierarchyVoter;

    @Override
    public Mono<AuthorizationDecision> check(Mono<Authentication> authentication, T object) {
        return authentication.map(auth -> {
            ConfigAttribute configAttribute = () -> roleHierarchyVoter.getRolePrefix() + authority;
            int voteResult = roleHierarchyVoter.vote(auth, object, Collections.singletonList(configAttribute));
            return new AuthorizationDecision(voteResult == AccessDecisionVoter.ACCESS_GRANTED);
        });
    }
}
