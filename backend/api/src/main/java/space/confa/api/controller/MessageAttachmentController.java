package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.configuration.properties.AttachmentProp;
import space.confa.api.model.dto.response.MessageAttachmentDto;
import space.confa.api.service.MessageAttachmentService;

@RestController
@RequestMapping("/api/attachments")
@RequiredArgsConstructor
public class MessageAttachmentController {

    private final MessageAttachmentService messageAttachmentService;
    private final AttachmentProp attachmentProp;

    @PostMapping(path = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<MessageAttachmentDto> uploadImage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("file") FilePart file,
            @RequestParam(required = false) Long channelId,
            @RequestParam(required = false) String roomName
    ) {
        return readBytes(file)
                .flatMap(bytes -> messageAttachmentService.uploadImage(
                        userId(jwt),
                        channelId,
                        roomName,
                        bytes,
                        file.headers().getContentType() == null
                                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                                : file.headers().getContentType().toString(),
                        file.filename()
                ));
    }

    private Mono<byte[]> readBytes(FilePart filePart) {
        int maxBytes = Math.toIntExact(Math.min(Integer.MAX_VALUE, attachmentProp.image().maxRawUploadBytes()));
        return DataBufferUtils.join(filePart.content(), maxBytes)
                .map(buffer -> {
                    byte[] bytes = new byte[buffer.readableByteCount()];
                    buffer.read(bytes);
                    DataBufferUtils.release(buffer);
                    return bytes;
                })
                .onErrorMap(
                        DataBufferLimitException.class,
                        error -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image exceeds raw upload limit")
                );
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
