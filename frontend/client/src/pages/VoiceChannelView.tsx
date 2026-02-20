import { useEffect, useMemo, useState } from 'react';
import {
    ControlBar,
    GridLayout,
    LiveKitRoom,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { fetchChannelLivekitToken } from '../api';
import Soundboard from '../components/Soundboard';

const wsUrl = import.meta.env.VITE_LIVEKIT_WS_URL as string;

type VoiceChannelViewProps = {
    channelId: number;
    channelName: string;
};

export default function VoiceChannelView({ channelId, channelName }: VoiceChannelViewProps) {
    const [token, setToken] = useState<string | null>(null);
    const [connect, setConnect] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(false);

    useEffect(() => {
        setToken(null);
        setConnect(false);
        setError(null);
        setLoading(false);
    }, [channelId]);

    const handleJoin = async () => {
        setLoading(true);
        setError(null);
        try {
            const t = await fetchChannelLivekitToken(channelId);
            setToken(t);
            setConnect(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to join voice channel');
        } finally {
            setLoading(false);
        }
    };

    const handleLeave = () => {
        setConnect(false);
        setToken(null);
    };

    return (
        <div className="voice-stage">
            <div className="voice-stage-header">
                <div>
                    <div className="voice-stage-title">{channelName}</div>
                    <div className="voice-stage-subtitle">Voice channel</div>
                </div>
                <div className="voice-stage-actions">
                    <button
                        className={`toggle-pill${audioEnabled ? ' active' : ''}`}
                        type="button"
                        onClick={() => setAudioEnabled(prev => !prev)}
                    >
                        {audioEnabled ? 'Mic on' : 'Mic off'}
                    </button>
                    <button
                        className={`toggle-pill${videoEnabled ? ' active' : ''}`}
                        type="button"
                        onClick={() => setVideoEnabled(prev => !prev)}
                    >
                        {videoEnabled ? 'Cam on' : 'Cam off'}
                    </button>
                    <button className="primary-btn" type="button" onClick={handleJoin} disabled={loading || connect}>
                        {connect ? 'Connected' : loading ? 'Connecting…' : 'Join'}
                    </button>
                </div>
            </div>

            {error && <div className="alert-banner">{error}</div>}

            <div className="voice-stage-body">
                {token && (
                    <LiveKitRoom
                        data-lk-theme="default"
                        serverUrl={wsUrl}
                        token={token}
                        connect={connect}
                        audio={audioEnabled}
                        video={videoEnabled}
                        className="voice-room"
                        onDisconnected={handleLeave}
                    >
                        <VoiceGrid />
                        <div className="voice-toolbar">
                            <ControlBar
                                className="lk-control-bar--main"
                                controls={{ chat: false, screenShare: true }}
                            />
                            <Soundboard triggerClassName="lk-button lk-soundboard-button" />
                        </div>
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                )}
                {!token && (
                    <div className="voice-stage-empty">
                        <div className="voice-stage-empty-title">Ready when you are</div>
                        <div className="voice-stage-empty-subtitle">
                            Join to start the call and see participants here.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function VoiceGrid() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    const visibleTracks = useMemo(() => tracks, [tracks]);

    return (
        <div className="voice-grid">
            <GridLayout tracks={visibleTracks}>
                <ParticipantTile />
            </GridLayout>
        </div>
    );
}
