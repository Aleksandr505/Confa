package space.confa.api.service.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import space.confa.api.configuration.properties.AvatarProp;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3AvatarStorageService implements AvatarStorageService {

    private final S3Client avatarS3Client;
    private final S3Presigner avatarS3Presigner;
    private final AvatarProp avatarProp;

    @PostConstruct
    public void ensureBucketExists() {
        String bucket = avatarProp.storage().bucket();
        try {
            avatarS3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException e) {
            avatarS3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            log.info("Created avatar bucket {}", bucket);
        } catch (Exception e) {
            log.warn("Failed to verify/create avatar bucket {}", bucket, e);
        }
    }

    @Override
    public void putObject(String key, byte[] bytes, String contentType) {
        avatarS3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(avatarProp.storage().bucket())
                        .key(key)
                        .contentType(contentType)
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes)
        );
    }

    @Override
    public byte[] getObject(String key) {
        ResponseBytes<GetObjectResponse> bytes = avatarS3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                        .bucket(avatarProp.storage().bucket())
                        .key(key)
                        .build()
        );
        return bytes.asByteArray();
    }

    @Override
    public void deleteObject(String key) {
        avatarS3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(avatarProp.storage().bucket())
                .key(key)
                .build());
    }

    @Override
    public String generatePresignedGetUrl(String key, Duration ttl) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(avatarProp.storage().bucket())
                        .key(key)
                        .build())
                .build();
        return avatarS3Presigner.presignGetObject(presignRequest).url().toString();
    }
}
