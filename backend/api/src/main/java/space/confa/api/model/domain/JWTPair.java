package space.confa.api.model.domain;

public record JWTPair<T, N>(T access, N refresh) {
}
