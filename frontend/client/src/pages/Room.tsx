import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
    StartAudio,
    PreJoin,
    useLocalParticipantPermissions,
    ConnectionStateToast,
    useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { fetchLivekitToken } from '../api';
import '../styles/livekit-theme.css';

const wsUrl = import.meta.env.VITE_LIVEKIT_WS_URL as string;

type Choices = {
    username?: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
};

type PermIssue = {
    camera?: boolean;
    microphone?: boolean;
    message?: string;
};

export default function RoomPage() {
    const { roomId = 'demo' } = useParams();

    const [token, setToken] = useState<string>();
    const [ready, setReady] = useState(false);
    const [choices, setChoices] = useState<Choices | null>(null);

    const [prejoinError, setPrejoinError] = useState<string>();
    const [permIssue, setPermIssue] = useState<PermIssue | null>(null);

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        (async () => {
            try {
                const displayName = choices?.username?.trim() || undefined;
                const t = await fetchLivekitToken(roomId, displayName);
                if (!cancelled) setToken(t);
            } catch (e: any) {
                if (!cancelled) setPrejoinError(e?.message || 'Token error');
            }
        })();
        return () => { cancelled = true; };
    }, [ready, roomId, choices?.username]);

    const audioProp = useMemo(() => {
        if (!choices?.audioEnabled) return false;
        return choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : true;
    }, [choices]);

    const videoProp = useMemo(() => {
        if (!choices?.videoEnabled) return false;
        return choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : true;
    }, [choices]);


    if (!ready) {
        return (
            <div className="lk-root gradient-bg">
                <div className="prejoin-shell theme-light" data-lk-theme="default">
                    <header className="lk-appbar light">
                        <div className="brand">
                            <span className="brand-dot" />
                            <span className="brand-title">Room: {roomId}</span>
                        </div>
                    </header>
                    <main className="prejoin-main">
                        {prejoinError && (
                            <div className="soft-alert">
                                {prejoinError}
                            </div>
                        )}
                        <PreJoin
                            persistUserChoices
                            joinLabel="Войти в комнату"
                            userLabel="Ваше имя"
                            micLabel="Микрофон"
                            camLabel="Камера"
                            onSubmit={(values: any) => {
                                setChoices({
                                    username: values?.username,
                                    audioEnabled: !!values?.audioEnabled,
                                    videoEnabled: !!values?.videoEnabled,
                                    audioDeviceId: values?.audioDeviceId,
                                    videoDeviceId: values?.videoDeviceId,
                                });
                                setReady(true);
                            }}
                            onError={(e) => {
                                setPrejoinError(e?.message || 'Permission or device error');
                            }}
                        />
                        <p className="hint">
                            Если запретили доступ — нажмите «Войти» без камеры/микрофона.
                            В комнате можно будет запросить доступ снова.
                        </p>
                    </main>
                </div>
            </div>
        );
    }

    if (ready && !token) {
        return (
            <div className="lk-root gradient-bg">
                <div className="center-card">
                    <div className="spinner" aria-label="loading" />
                    <p className="muted">Подключаемся…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="lk-root gradient-bg">
            <LiveKitRoom
                data-lk-theme="default"
                serverUrl={wsUrl}
                token={token}
                connect
                audio={audioProp}
                video={videoProp}
                className="lk-room-shell"
                options={{
                    publishDefaults: { stopMicTrackOnMute: true },
                }}
                onMediaDeviceFailure={(failure, kind) => {
                    const isCam = kind === 'videoinput';
                    const isMic = kind === 'audioinput';
                    setPermIssue({
                        camera: isCam || undefined,
                        microphone: isMic || undefined,
                        message:
                            (failure as any)?.message ||
                            'Permission denied: браузер заблокировал доступ к устройствам',
                    });
                    console.warn('Media device failure', failure, kind);
                }}
                onError={(e) => {
                    console.error(e);
                }}
            >
                <header className="lk-appbar">
                    <div className="brand">
                        <span className="brand-dot" />
                        <span className="brand-title">Room: {roomId}</span>
                    </div>
                    <RoomPermissionHint />
                </header>

                <PermissionBanner issue={permIssue} clearIssue={() => setPermIssue(null)} />

                <main className="lk-main">
                    <VideoConference />
                </main>

                <StartAudio label="Включить звук в браузере" />
                <RoomAudioRenderer />
                <ConnectionStateToast />
            </LiveKitRoom>
        </div>
    );
}

function RoomPermissionHint() {
    const perms = useLocalParticipantPermissions();
    if (!perms) return null;
    if (perms.canPublish || (perms.canPublishSources?.length ?? 0) > 0) return null;
    return <div className="perm-hint">Токен без прав на микрофон/камеру</div>;
}

function PermissionBanner({ issue, clearIssue }: { issue: PermIssue | null; clearIssue: () => void }) {
    const room = useRoomContext();
    if (!issue) return null;

    const ask = async (what: 'mic' | 'cam' | 'both') => {
        try {
            const constraints =
                what === 'mic' ? { audio: true, video: false } :
                    what === 'cam' ? { audio: false, video: true } :
                        { audio: true, video: true };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getTracks().forEach(t => t.stop()); // чистим временные треки
            clearIssue();

            if (what !== 'cam') await room.localParticipant.setMicrophoneEnabled(true);
            if (what !== 'mic') await room.localParticipant.setCameraEnabled(true);
        } catch (e: any) {
            console.warn('Re-request media failed', e);
            alert(
                'Доступ всё ещё заблокирован. Откройте настройки сайта (иконка камеры/микрофона рядом с адресной строкой) и разрешите доступ, затем попробуйте снова.'
            );
        }
    };

    return (
        <div className="perm-banner">
            <div className="perm-text">
                {issue.message || 'Доступ к устройствам заблокирован.'}{' '}
                <span className="perm-help">Можно запросить снова — без перезагрузки страницы.</span>
            </div>
            <div className="perm-actions">
                {issue.microphone && (
                    <button className="btn small" onClick={() => ask('mic')}>Запросить микрофон</button>
                )}
                {issue.camera && (
                    <button className="btn small" onClick={() => ask('cam')}>Запросить камеру</button>
                )}
                {!issue.camera && !issue.microphone && (
                    <button className="btn small" onClick={() => ask('both')}>Запросить доступ</button>
                )}
                <button className="btn ghost small" onClick={clearIssue}>Скрыть</button>
            </div>
        </div>
    );
}
