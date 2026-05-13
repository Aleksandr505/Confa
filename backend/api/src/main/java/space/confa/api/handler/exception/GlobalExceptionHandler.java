package space.confa.api.handler.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;
import space.confa.api.model.domain.exception.TooManyLoginAttemptsException;

import java.time.Instant;
import java.util.Map;

@Slf4j
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({ ResponseStatusException.class })
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(
            ResponseStatusException ex
    ) {
        var statusCode = ex.getStatusCode();
        var message = ex.getReason() == null || ex.getReason().isBlank()
                ? "Request failed"
                : ex.getReason();

        return ResponseEntity
                .status(statusCode)
                .body(Map.of(
                        "timestamp", Instant.now().toString(),
                        "status", statusCode.value(),
                        "error", statusCode.toString(),
                        "message", message
                ));
    }

    @ExceptionHandler({ TooManyLoginAttemptsException.class })
    public ResponseEntity<Map<String, Object>> handleTooManyLoginAttempts(
            TooManyLoginAttemptsException ex
    ) {
        log.warn("Too many login attempts: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of(
                        "timestamp", Instant.now().toString(),
                        "status", HttpStatus.TOO_MANY_REQUESTS.value(),
                        "error", "Too Many Requests",
                        "message", ex.getMessage()
                ));
    }
}
