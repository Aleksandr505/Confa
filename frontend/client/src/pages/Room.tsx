import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useContext } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
    StartAudio,
    PreJoin,
    useLocalParticipantPermissions,
    ConnectionStateToast,
    useRoomContext,
    useRemoteParticipants,
    TrackLoop,
    TrackRefContext,
    VideoTrack,
    useIsMuted,
    useTracks,
    ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
    fetchLivekitToken,
    fetchRoomAgents,
    inviteAgent,
    kickAgent,
    muteAgent,
    focusAgent,
    type AgentInfoDto,
    type AgentRole,
    type RoomMetadata,
    fetchRoomMetadata,
    enableRoomAgents,
    disableRoomAgents,
} from '../api';
import '../styles/livekit-theme.css';
import { isAdmin } from '../lib/auth.ts';
import { getAvatarColor, getAvatarUrl } from '../lib/avatar';
import { Track } from 'livekit-client';

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
    const navigate = useNavigate();

    const [token, setToken] = useState<string>();
    const [ready, setReady] = useState(false);
    const [choices, setChoices] = useState<Choices | null>(null);
    const [volumePanelOpen, setVolumePanelOpen] = useState(false);

    const [prejoinError, setPrejoinError] = useState<string>();
    const [permIssue, setPermIssue] = useState<PermIssue | null>(null);

    const [agents, setAgents] = useState<AgentInfoDto[]>([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [agentsError, setAgentsError] = useState<string | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
    const [inviteRole, setInviteRole] = useState<AgentRole>('friendly');
    const [inviteLoading, setInviteLoading] = useState(false);

    const [roomConfig, setRoomConfig] = useState<RoomMetadata | null>(null);
    const [roomConfigLoading, setRoomConfigLoading] = useState(false);
    const [roomConfigError, setRoomConfigError] = useState<string | null>(null);

    const isAdminUser = isAdmin();

    const agentsFeatureEnabled = roomConfig?.isAgentsEnabled === true;

    useEffect(() => {
        if (!ready || !roomId) return;

        setRoomConfigLoading(true);
        setRoomConfigError(null);

        fetchRoomMetadata(roomId)
            .then(cfg => setRoomConfig(cfg))
            .catch(e => {
                console.warn('Failed to load room config', e);
                setRoomConfigError(e?.message || 'Не удалось получить конфиг комнаты');
            })
            .finally(() => setRoomConfigLoading(false));
    }, [ready, roomId]);

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
        return () => {
            cancelled = true;
        };
    }, [ready, roomId, choices?.username]);

    const audioProp = useMemo(() => {
        if (!choices?.audioEnabled) return false;
        return choices.audioDeviceId ? { deviceId: choices.audioDeviceId } : true;
    }, [choices]);

    const videoProp = useMemo(() => {
        if (!choices?.videoEnabled) return false;
        return choices.videoDeviceId ? { deviceId: choices.videoDeviceId } : true;
    }, [choices]);

    const loadAgents = useCallback(
        async (silent = false) => {
            if (!roomId) return;
            if (!silent) setAgentsLoading(true);
            setAgentsError(null);
            try {
                const list = await fetchRoomAgents(roomId);
                setAgents(list);
                if (!selectedAgentId && list.length) {
                    setSelectedAgentId(list[0].identity);
                } else if (
                    selectedAgentId &&
                    !list.some(a => a.identity === selectedAgentId)
                ) {
                    setSelectedAgentId(list[0]?.identity);
                }
            } catch (e: any) {
                setAgentsError(e?.message || 'Не удалось загрузить агентов');
            } finally {
                if (!silent) setAgentsLoading(false);
            }
        },
        [roomId, selectedAgentId],
    );

    useEffect(() => {
        if (!ready || !roomId) return;
        const id = setInterval(() => {
            loadAgents(true);
        }, 5000);
        return () => clearInterval(id);
    }, [ready, roomId, loadAgents]);

    useEffect(() => {
        if (!ready) return;
        loadAgents(true);
    }, [ready, roomId, loadAgents]);

    async function handleEnableAgents() {
        if (!roomId) return;
        try {
            await enableRoomAgents(roomId);
            const cfg = await fetchRoomMetadata(roomId);
            setRoomConfig(cfg);
        } catch (e: any) {
            alert(e?.message || 'Не удалось включить агентов');
        }
    }

    async function handleDisableAgents() {
        if (!roomId) return;
        if (!confirm('Отключить агентов в этой комнате? Все приглашения станут недоступны.')) {
            return;
        }
        try {
            await disableRoomAgents(roomId);
            const cfg = await fetchRoomMetadata(roomId);
            setRoomConfig(cfg);
        } catch (e: any) {
            alert(e?.message || 'Не удалось отключить агентов');
        }
    }

    async function handleInvite(role: AgentRole) {
        if (!roomId) return;
        setInviteLoading(true);
        try {
            await inviteAgent(roomId, role);
            await loadAgents();
        } catch (e: any) {
            alert(e?.message || 'Не удалось пригласить агента');
        } finally {
            setInviteLoading(false);
        }
    }

    async function handleKick() {
        if (!roomId || !selectedAgentId) return;
        if (!confirm(`Выгнать агента ${selectedAgentId} из комнаты ${roomId}?`)) return;
        try {
            await kickAgent(roomId, { agentIdentity: selectedAgentId });
            await loadAgents();
        } catch (e: any) {
            alert(e?.message || 'Не удалось выгнать агента');
        }
    }

    async function handleToggleMute() {
        if (!roomId || !selectedAgentId) return;
        const agent = agents.find(a => a.identity === selectedAgentId);
        if (!agent) return;
        try {
            await muteAgent(roomId, agent.sid, !agent.muted);
            await loadAgents();
        } catch (e: any) {
            alert(e?.message || 'Не удалось изменить mute для агента');
        }
    }

    async function handleFocus() {
        if (!roomId || !selectedAgentId) return;
        try {
            await focusAgent(roomId, selectedAgentId);
            alert('Агенту отправлен сигнал сфокусироваться на вас');
        } catch (e: any) {
            alert(e?.message || 'Не удалось сфокусировать агента');
        }
    }

    if (!ready) {
        return (
            <div className="lk-root gradient-bg">
                <div className="prejoin-shell theme-light" data-lk-theme="default">
                    <header className="lk-appbar light">
                        <div className="brand">
                            <span className="brand-dot" />
                            <span className="brand-title">Комната: {roomId}</span>
                        </div>
                        <button
                            className="btn ghost small"
                            type="button"
                            onClick={() => navigate('/')}
                        >
                            На главную
                        </button>
                    </header>
                    <main className="prejoin-main">
                        {prejoinError && <div className="soft-alert">{prejoinError}</div>}
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
                            onError={e => {
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

    const selectedAgent = agents.find(a => a.identity === selectedAgentId);

    return (
        <div className="lk-root gradient-bg">
            <LiveKitRoom
                data-lk-theme="default"
                serverUrl={wsUrl}
                token={token}
                connect={ready}
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
                onError={e => {
                    console.error(e);
                }}
                onDisconnected={() => {
                    setReady(false);
                    setToken(undefined);
                    setVolumePanelOpen(false);
                    navigate('/', { replace: true });
                }}
            >
                <header className="lk-appbar">
                    <div className="brand">
                        <span className="brand-dot" />
                        <span className="brand-title">Комната: {roomId}</span>
                    </div>
                    <div className="appbar-actions">
                        <button
                            className="btn ghost small"
                            type="button"
                            onClick={() => setVolumePanelOpen(v => !v)}
                        >
                            {volumePanelOpen ? 'Скрыть громкость' : 'Громкость участников'}
                        </button>
                        <RoomPermissionHint />
                    </div>
                </header>

                {agentsFeatureEnabled ? (
                    <div className="agent-bar">
                        <div className="agent-section">
                            <span className="agent-label">Пригласить агента</span>
                            <div className="agent-invite">
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value as AgentRole)}
                                >
                                    <option value="friendly">friendly</option>
                                    <option value="funny">funny</option>
                                    <option value="bored">bored</option>
                                </select>
                                <button
                                    className="btn small"
                                    type="button"
                                    onClick={() => handleInvite(inviteRole)}
                                    disabled={inviteLoading}
                                >
                                    {inviteLoading ? 'Приглашаем…' : 'Пригласить'}
                                </button>
                            </div>
                        </div>

                        <div className="agent-section">
                            <span className="agent-label">Управление агентами</span>
                            <div className="agent-actions">
                        <select
                            value={selectedAgentId ?? ''}
                            onChange={e => setSelectedAgentId(e.target.value || undefined)}
                        >
                            {agents.length === 0 && <option value="">Агентов нет</option>}
                            {agents.map(a => (
                                <option key={a.identity} value={a.identity}>
                                    {a.name || a.identity} {a.muted ? '· muted' : ''}
                                </option>
                            ))}
                        </select>
                                <button
                                    className="btn ghost small"
                                    type="button"
                                    disabled={!selectedAgentId}
                                    onClick={handleToggleMute}
                                >
                                    {selectedAgent?.muted ? 'Unmute' : 'Mute'}
                                </button>
                                <button
                                    className="btn ghost small"
                                    type="button"
                                    disabled={!selectedAgentId}
                                    onClick={handleFocus}
                                >
                                    Фокус на мне
                                </button>
                                <button
                                    className="btn ghost small"
                                    type="button"
                                    disabled={!selectedAgentId}
                                    onClick={handleKick}
                                >
                                    Выгнать
                                </button>

                                {}
                                {isAdminUser && (
                                    <button
                                        className="btn ghost small"
                                        type="button"
                                        onClick={handleDisableAgents}
                                    >
                                        Отключить агентов
                                    </button>
                                )}
                            </div>

                            {selectedAgent && (
                                <div className="agent-status">
                                    <span
                                        className="avatar-icon"
                                        style={{
                                            backgroundImage: `url(${getAvatarUrl(
                                                selectedAgent.identity,
                                                selectedAgent.name,
                                            )})`,
                                        }}
                                        aria-hidden
                                    />
                                    <span
                                        className={'agent-dot ' + (selectedAgent.muted ? 'muted' : '')}
                                    />
                                    <span>
                                        {selectedAgent.muted
                                            ? 'Агент сейчас заглушён'
                                            : 'Агент может говорить и слушать комнату'}
                                    </span>
                                </div>
                            )}
                            {agentsLoading && (
                                <div className="agent-status">
                                    <span>Обновляем список агентов…</span>
                                </div>
                            )}
                            {agentsError && (
                                <div className="agent-status" style={{ color: '#fecaca' }}>
                                    {agentsError}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="agent-bar">
                        <div className="agent-section">
                            <span className="agent-label">Агенты в этой комнате</span>
                            <div className="agent-actions">
                                <span className="agent-status">
                                    <span className="agent-dot muted"/>
                                    <span>Функционал агентов отключён.</span>
                                </span>

                                {isAdminUser && !roomConfigLoading && (
                                    <button
                                        className="btn small"
                                        type="button"
                                        onClick={handleEnableAgents}
                                    >
                                        Включить агентов в комнате
                                    </button>
                                )}
                                {roomConfigLoading && (
                                    <span className="agent-status">Загружаем конфиг комнаты…</span>
                                )}
                                {roomConfigError && (
                                    <span className="agent-status" style={{color: '#fecaca'}}>
                                        {roomConfigError}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                <PermissionBanner issue={permIssue} clearIssue={() => setPermIssue(null)} />
                <VolumesPanel open={volumePanelOpen} onClose={() => setVolumePanelOpen(false)} />
                <ParticipantJoinTone />

                <main className="lk-main">
                    <ParticipantsGrid />
                    <ControlBar />
                </main>

                <StartAudio label="Включить звук в браузере" />
                <RoomAudioRenderer />
                <ConnectionStateToast />
            </LiveKitRoom>
        </div>
    );
}

function VolumesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const participants = useRemoteParticipants();
    const [volumes, setVolumes] = useState<Record<string, number>>({});

    useEffect(() => {
        for (const p of participants) {
            const volume = volumes[p.identity];
            if (volume !== undefined) {
                p.setVolume(volume);
            }
        }
    }, [participants, volumes]);

    useEffect(() => {
        let changed = false;
        const next = { ...volumes };
        for (const p of participants) {
            if (next[p.identity] === undefined) {
                next[p.identity] = 0.5;
                p.setVolume(0.5);
                changed = true;
            }
        }
        if (changed) setVolumes(next);
    }, [participants, volumes]);

    useEffect(() => {
        const known = new Set(participants.map(p => p.identity));
        setVolumes(current => {
            const stale = Object.keys(current).filter(id => !known.has(id));
            if (stale.length === 0) return current;
            const next = { ...current };
            stale.forEach(id => delete next[id]);
            return next;
        });
    }, [participants]);

    if (!open) return null;

    return (
        <div className="volume-panel volume-panel--floating">
            <div className="volume-panel__header">
                <div className="volume-panel__title">
                    <span className="volume-panel__name">Громкость</span>
                </div>
                <button className="btn ghost small" type="button" onClick={onClose}>
                    Закрыть
                </button>
            </div>
            {participants.length === 0 ? (
                <div className="volume-panel__empty">В комнате пока никого нет</div>
            ) : (
                <div className="volume-panel__list">
                    {participants.map(p => {
                        const currentVolume = volumes[p.identity] ?? 0.5;
                        const label = p.name || p.identity;
                        return (
                            <div className="volume-row" key={p.sid}>
                                <div className="volume-row__title" title={label}>
                                    <span
                                        className="avatar-icon"
                                        style={{ backgroundImage: `url(${getAvatarUrl(p.identity, p.name)})` }}
                                        aria-hidden
                                    />
                                    {label}
                                </div>
                                <div className="volume-row__controls">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={currentVolume}
                                        onChange={e => {
                                            const next = Number(e.target.value);
                                            setVolumes(map => ({ ...map, [p.identity]: next }));
                                            p.setVolume(next);
                                        }}
                                    />
                                    <span className="volume-row__value">
                                        {Math.round(currentVolume * 100)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ParticipantJoinTone() {
    const participants = useRemoteParticipants();
    const prevCount = useRef<number | null>(null);
    const audioCtx = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (prevCount.current === null) {
            prevCount.current = participants.length;
            return;
        }
        if (participants.length > (prevCount.current ?? 0)) {
            playTone();
        }
        prevCount.current = participants.length;
    }, [participants.length]);

    useEffect(() => {
        return () => {
            audioCtx.current?.close().catch(() => {});
        };
    }, []);

    const playTone = () => {
        const ctx = audioCtx.current ?? new AudioContext();
        audioCtx.current = ctx;
        ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(660, now);
        gain1.gain.setValueAtTime(0.0001, now);
        gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.16);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const start2 = now + 0.18;
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, start2);
        gain2.gain.setValueAtTime(0.0001, start2);
        gain2.gain.exponentialRampToValueAtTime(0.07, start2 + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0001, start2 + 0.12);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(start2);
        osc2.stop(start2 + 0.14);
    };

    return null;
}

function AvatarFallback({ identity, label }: { identity: string; label: string }) {
    const initials = label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase())
        .join('');

    return (
        <div
            className="avatar-fallback"
            style={{ backgroundColor: getAvatarColor(identity) }}
            aria-hidden
        >
            {initials || '?'}
        </div>
    );
}

function ParticipantTile() {
    const trackRef = useContext(TrackRefContext);
    if (!trackRef) return null;

    const participant = trackRef.participant;
    const isCamMuted = useIsMuted('camera', { participant });
    const label = participant.name ?? participant.identity;
    const avatar = getAvatarUrl(participant.identity, participant.name);

    return (
        <div className="tile">
            <div className="tile__media">
                <VideoTrack trackRef={trackRef} />
                {isCamMuted && <AvatarFallback identity={participant.identity} label={label} />}
            </div>
            <div className="tile__footer">
                <span
                    className="avatar-icon"
                    style={{ backgroundImage: `url(${avatar})` }}
                    aria-hidden
                />
                <span className="tile__label">{label}</span>
            </div>
        </div>
    );
}

function ParticipantsGrid() {
    const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

    if (tracks.length === 0) {
        return <div className="participants-empty">Участников пока нет</div>;
    }

    return (
        <div className="participants-grid">
            <TrackLoop tracks={tracks}>
                <ParticipantTile />
            </TrackLoop>
        </div>
    );
}

function RoomPermissionHint() {
    const perms = useLocalParticipantPermissions();
    if (!perms) return null;
    if (perms.canPublish || (perms.canPublishSources?.length ?? 0) > 0) return null;
    return <div className="perm-hint">Токен без прав на микрофон/камеру</div>;
}

function PermissionBanner({
                              issue,
                              clearIssue,
                          }: {
    issue: PermIssue | null;
    clearIssue: () => void;
}) {
    const room = useRoomContext();
    if (!issue) return null;

    const ask = async (what: 'mic' | 'cam' | 'both') => {
        try {
            const constraints =
                what === 'mic'
                    ? { audio: true, video: false }
                    : what === 'cam'
                        ? { audio: false, video: true }
                        : { audio: true, video: true };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getTracks().forEach(t => t.stop());
            clearIssue();

            if (what !== 'cam') await room.localParticipant.setMicrophoneEnabled(true);
            if (what !== 'mic') await room.localParticipant.setCameraEnabled(true);
        } catch (e: any) {
            console.warn('Re-request media failed', e);
            alert(
                'Доступ всё ещё заблокирован. Откройте настройки сайта (иконка камеры/микрофона рядом с адресной строкой) и разрешите доступ, затем попробуйте снова.',
            );
        }
    };

    return (
        <div className="perm-banner">
            <div className="perm-text">
                {issue.message || 'Доступ к устройствам заблокирован.'}{' '}
                <span className="perm-help">
          Можно запросить снова — без перезагрузки страницы.
        </span>
            </div>
            <div className="perm-actions">
                {issue.microphone && (
                    <button className="btn small" onClick={() => ask('mic')}>
                        Запросить микрофон
                    </button>
                )}
                {issue.camera && (
                    <button className="btn small" onClick={() => ask('cam')}>
                        Запросить камеру
                    </button>
                )}
                {!issue.camera && !issue.microphone && (
                    <button className="btn small" onClick={() => ask('both')}>
                        Запросить доступ
                    </button>
                )}
                <button className="btn ghost small" onClick={clearIssue}>
                    Скрыть
                </button>
            </div>
        </div>
    );
}
