package space.confa.api.service.storage;

import java.time.Duration;

public interface AvatarStorageService {
    void putObject(String key, byte[] bytes, String contentType);
    byte[] getObject(String key);
    void deleteObject(String key);
    String generatePresignedGetUrl(String key, Duration ttl);
}
