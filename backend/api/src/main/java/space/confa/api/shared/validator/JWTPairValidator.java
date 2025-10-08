package space.confa.api.shared.validator;

import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.validation.Errors;
import org.springframework.validation.ValidationUtils;
import org.springframework.validation.Validator;
import space.confa.api.model.dto.response.TokenPairDto;

@RequiredArgsConstructor
public class JWTPairValidator implements Validator {

    private final JwtDecoder jwtDecoder;

    @Override
    public boolean supports(Class<?> clazz) {
        return TokenPairDto.class.equals(clazz);
    }

    @Override
    public void validate(Object target, Errors errors) {
        ValidationUtils.rejectIfEmptyOrWhitespace(
                errors, "accessToken", "field.required");

        ValidationUtils.rejectIfEmptyOrWhitespace(
                errors, "refreshToken", "field.required");

        var tokenPair = (TokenPairDto) target;

        try {
            jwtDecoder.decode(tokenPair.refreshToken());
        } catch (JwtException exception) {
            errors.rejectValue("refreshToken", exception.getMessage());
        }
    }
}
