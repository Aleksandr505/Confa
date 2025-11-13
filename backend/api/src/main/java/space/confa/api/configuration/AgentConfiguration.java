package space.confa.api.configuration;

import io.livekit.server.AgentDispatchServiceClient;
import io.livekit.server.RoomServiceClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import space.confa.api.configuration.properties.LivekitProp;

@Configuration
public class AgentConfiguration {

    @Bean
    public RoomServiceClient roomClient(LivekitProp props) {
        return RoomServiceClient.Companion
                .create(props.host(), props.apiKey(), props.apiSecret());
    }

    @Bean
    public AgentDispatchServiceClient agentDispatchClient(LivekitProp props) {
        return AgentDispatchServiceClient.Companion
                .createClient(props.host(), props.apiKey(), props.apiSecret());
    }
}
