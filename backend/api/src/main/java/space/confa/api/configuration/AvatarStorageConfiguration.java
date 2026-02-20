package space.confa.api.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import space.confa.api.configuration.properties.AvatarProp;

import java.net.URI;

@Configuration
public class AvatarStorageConfiguration {

    @Bean
    public S3Client avatarS3Client(AvatarProp avatarProp) {
        AvatarProp.Storage storage = avatarProp.storage();
        return S3Client.builder()
                .endpointOverride(URI.create(storage.endpoint()))
                .region(Region.of(storage.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(storage.pathStyle())
                        .build())
                .build();
    }

    @Bean
    public S3Presigner avatarS3Presigner(AvatarProp avatarProp) {
        AvatarProp.Storage storage = avatarProp.storage();
        return S3Presigner.builder()
                .endpointOverride(URI.create(storage.endpoint()))
                .region(Region.of(storage.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(storage.pathStyle())
                        .build())
                .build();
    }
}
