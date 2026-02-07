import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AudioTrack,
    CarouselLayout,
    Chat,
    ConnectionQualityIndicator,
    ConnectionStateToast,
    ControlBar,
    FocusLayoutContainer,
    GridLayout,
    LayoutContextProvider,
    LiveKitRoom,
    ParticipantName,
    ParticipantTile,
    type ParticipantTileProps,
    PreJoin,
    RoomAudioRenderer,
    StartAudio,
    TrackMutedIndicator,
    useCreateLayoutContext,
    useFeatureContext,
    useLocalParticipantPermissions,
    useMaybeLayoutContext,
    useMaybeTrackRefContext,
    usePinnedTracks,
    useRemoteParticipants,
    useRoomContext,
    useTracks,
    VideoTrack,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
    isEqualTrackRef,
    isTrackReferencePinned,
    isTrackReference,
    type TrackReferenceOrPlaceholder,
    type WidgetState,
} from '@livekit/components-core';
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
    fetchMyRooms,
    createInvite,
    type RoomAccess,
    type RoomInvite,
} from '../api';
import '../styles/livekit-theme.css';
import { getUserIdentity, isAdmin } from '../lib/auth.ts';
import { getAvatarColor, getAvatarUrl } from '../lib/avatar';
import { ParticipantEvent, Track } from 'livekit-client';

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

    const [roomAccess, setRoomAccess] = useState<RoomAccess | null>(null);
    const [inviteInfo, setInviteInfo] = useState<RoomInvite | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [volumes, setVolumes] = useState<Record<string, number>>({});
    const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>({});

    const isAdminUser = isAdmin();

    const agentsFeatureEnabled = roomConfig?.isAgentsEnabled === true;

    useEffect(() => {
        if (!roomId) return;
        fetchMyRooms()
            .then(list => setRoomAccess(list.find(r => r.name === roomId) || null))
            .catch(() => {});
    }, [roomId]);

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
        setPrejoinError(undefined);
        setToken(undefined);
        (async () => {
            try {
                const displayName = choices?.username?.trim() || undefined;
                const t = await fetchLivekitToken(roomId, displayName);
                if (!cancelled) setToken(t);
            } catch (e: any) {
                if (!cancelled) {
                    const raw = e?.message || 'Token error';
                    const friendly = raw.startsWith('403')
                        ? 'Нет доступа к этой комнате. Попросите владельца выдать приглашение.'
                        : raw;
                    setPrejoinError(friendly);
                }
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

    useEffect(() => {
        if (!inviteInfo) {
            setInviteCopied(false);
        }
    }, [inviteInfo]);

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

    async function handleCreateInvite() {
        if (!roomId) return;
        setInviteBusy(true);
        setInviteError(null);
        setInviteInfo(null);
        try {
            const invite = await createInvite(roomId, {});
            setInviteInfo(invite);
        } catch (e: any) {
            setInviteError(e?.message || 'Не удалось создать приглашение');
        } finally {
            setInviteBusy(false);
        }
    }

    async function handleCopyInvite() {
        if (!inviteInfo) return;
        const value = inviteInfo.inviteUrl || inviteInfo.token;
        try {
            await navigator.clipboard.writeText(value);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 1500);
        } catch (e: any) {
            setInviteError(e?.message || 'Не удалось скопировать приглашение');
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
        const userIdentity = getUserIdentity();
        if (!userIdentity) {
            alert('Не удалось определить вашу identity');
            return;
        }
        try {
            await focusAgent(roomId, {
                activeAgentIdentity: selectedAgentId,
                userIdentity,
            });
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
                    {prejoinError ? (
                        <>
                            <div className="soft-alert">{prejoinError}</div>
                            <button
                                className="btn ghost small"
                                type="button"
                                onClick={() => navigate('/', { replace: true })}
                            >
                                На главную
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="spinner" aria-label="loading" />
                            <p className="muted">Подключаемся…</p>
                        </>
                    )}
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
                        {roomAccess?.role === 'OWNER' && (
                            <button
                                className="btn ghost small"
                                type="button"
                                onClick={handleCreateInvite}
                                disabled={inviteBusy}
                            >
                                {inviteBusy ? 'Создаём ссылку…' : 'Пригласить'}
                            </button>
                        )}
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

                {inviteError && (
                    <div className="soft-alert" style={{ margin: '8px 12px', color: '#fecaca' }}>
                        {inviteError}
                    </div>
                )}
                {inviteInfo && (
                    <div className="soft-alert invite-box" style={{ margin: '8px 12px' }}>
                        <div className="invite-box__title">Приглашение готово</div>
                        <div className="invite-box__link">{inviteInfo.inviteUrl || inviteInfo.token}</div>
                        <div className="invite-box__actions">
                            <button className="btn primary small" type="button" onClick={handleCopyInvite}>
                                {inviteCopied ? 'Скопировано' : 'Скопировать ссылку'}
                            </button>
                            <button className="btn ghost small" type="button" onClick={() => setInviteInfo(null)}>
                                Скрыть
                            </button>
                        </div>
                    </div>
                )}

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
                <VolumesPanel
                    open={volumePanelOpen}
                    onClose={() => setVolumePanelOpen(false)}
                    volumes={volumes}
                    setVolumes={setVolumes}
                    screenShareVolumes={screenShareVolumes}
                    setScreenShareVolumes={setScreenShareVolumes}
                />
                <ParticipantJoinTone />

                <main className="lk-main">
                    <BrandedVideoConference />
                </main>

                <StartAudio label="Включить звук в браузере" />
            </LiveKitRoom>
        </div>
    );
}

function VolumesPanel({
    open,
    onClose,
    volumes,
    setVolumes,
    screenShareVolumes,
    setScreenShareVolumes,
}: {
    open: boolean;
    onClose: () => void;
    volumes: Record<string, number>;
    setVolumes: Dispatch<SetStateAction<Record<string, number>>>;
    screenShareVolumes: Record<string, number>;
    setScreenShareVolumes: Dispatch<SetStateAction<Record<string, number>>>;
}) {
    const participants = useRemoteParticipants();
    const screenShareAudioTracks = useTracks(
        [{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }],
        { onlySubscribed: false },
    )
        .filter(isTrackReference)
        .filter(track => track.publication.source === Track.Source.ScreenShareAudio);

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

    useEffect(() => {
        let changed = false;
        const next = { ...screenShareVolumes };
        for (const track of screenShareAudioTracks) {
            const trackId = track.publication.trackSid;
            if (next[trackId] === undefined) {
                next[trackId] = 0.5;
                const audioTrack = track.publication.track;
                if (audioTrack && audioTrack.kind === Track.Kind.Audio && typeof (audioTrack as any).setVolume === 'function') {
                    (audioTrack as any).setVolume(0.5);
                }
                changed = true;
            }
        }
        if (changed) setScreenShareVolumes(next);
    }, [screenShareAudioTracks, screenShareVolumes, setScreenShareVolumes]);

    useEffect(() => {
        const known = new Set(screenShareAudioTracks.map(track => track.publication.trackSid));
        setScreenShareVolumes(current => {
            const stale = Object.keys(current).filter(id => !known.has(id));
            if (stale.length === 0) return current;
            const next = { ...current };
            stale.forEach(id => delete next[id]);
            return next;
        });
    }, [screenShareAudioTracks, setScreenShareVolumes]);

    useEffect(() => {
        for (const track of screenShareAudioTracks) {
            const volume = screenShareVolumes[track.publication.trackSid];
            const audioTrack = track.publication.track;
            if (
                volume !== undefined &&
                audioTrack &&
                audioTrack.kind === Track.Kind.Audio &&
                typeof (audioTrack as any).setVolume === 'function'
            ) {
                (audioTrack as any).setVolume(volume);
            }
        }
    }, [screenShareAudioTracks, screenShareVolumes]);

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
            {screenShareAudioTracks.length > 0 && (
                <>
                    <div className="volume-panel__subhead">Демонстрация экрана</div>
                    <div className="volume-panel__list">
                        {screenShareAudioTracks.map(track => {
                            const trackId = track.publication.trackSid;
                            const currentVolume = screenShareVolumes[trackId] ?? 0.5;
                            const label = track.participant.name || track.participant.identity;
                            return (
                                <div className="volume-row" key={trackId}>
                                    <div className="volume-row__title" title={label}>
                                        <span
                                            className="avatar-icon"
                                            style={{
                                                backgroundImage: `url(${getAvatarUrl(
                                                    track.participant.identity,
                                                    track.participant.name,
                                                )})`,
                                            }}
                                            aria-hidden
                                        />
                                        {label}&nbsp;·&nbsp;Screen share audio
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
                                                setScreenShareVolumes(map => ({ ...map, [trackId]: next }));
                                                const audioTrack = track.publication.track;
                                                if (
                                                    audioTrack &&
                                                    audioTrack.kind === Track.Kind.Audio &&
                                                    typeof (audioTrack as any).setVolume === 'function'
                                                ) {
                                                    (audioTrack as any).setVolume(next);
                                                }
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
                </>
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

function BrandedTileContent() {
    const trackRef = useMaybeTrackRefContext();
    const layoutContext = useMaybeLayoutContext();
    const autoManageSubscription = useFeatureContext()?.autoSubscription;

    const handleSubscribe = useCallback(
        (subscribed: boolean) => {
            if (
                !trackRef?.source ||
                !layoutContext?.pin.dispatch ||
                !layoutContext.pin.state ||
                subscribed
            ) {
                return;
            }
            if (isTrackReferencePinned(trackRef, layoutContext.pin.state)) {
                layoutContext.pin.dispatch({ msg: 'clear_pin' });
            }
        },
        [layoutContext, trackRef],
    );

    if (!trackRef) return null;

    const participant = trackRef.participant;
    const name = participant.name ?? participant.identity;
    const avatarUrl = getAvatarUrl(participant.identity, participant.name);
    const isScreenShare = trackRef.source === Track.Source.ScreenShare;
    const micPublication = participant.getTrackPublication(Track.Source.Microphone);

    const isVideoTrack =
        isTrackReference(trackRef) &&
        (trackRef.publication?.kind === 'video' ||
            trackRef.source === Track.Source.Camera ||
            trackRef.source === Track.Source.ScreenShare);
    const isAudioTrack = isTrackReference(trackRef) && !isVideoTrack;

    return (
        <>
            {isVideoTrack && (
                <VideoTrack
                    trackRef={trackRef}
                    onSubscriptionStatusChanged={handleSubscribe}
                    manageSubscription={autoManageSubscription}
                    muted={isScreenShare ? false : undefined}
                />
            )}
            {isAudioTrack && (
                <AudioTrack
                    trackRef={trackRef}
                    onSubscriptionStatusChanged={handleSubscribe}
                />
            )}
            <div className="lk-participant-placeholder">
                {avatarUrl ? (
                    <span
                        className="avatar-circle"
                        style={{ backgroundImage: `url(${avatarUrl})` }}
                        aria-hidden
                    />
                ) : (
                    <AvatarFallback identity={participant.identity} label={name} />
                )}
            </div>
            <div className="lk-participant-metadata">
                <div className="lk-participant-metadata-item">
                    {!isScreenShare && (
                        <span
                            className="avatar-icon"
                            style={{ backgroundImage: `url(${avatarUrl})` }}
                            aria-hidden
                        />
                    )}
                    {isScreenShare ? (
                        <ParticipantName>&apos;s screen</ParticipantName>
                    ) : (
                        <>
                            <TrackMutedIndicator
                                trackRef={{
                                    participant,
                                    source: Track.Source.Microphone,
                                    publication: micPublication,
                                }}
                                show="muted"
                            />
                            <ParticipantName />
                        </>
                    )}
                </div>
                <ConnectionQualityIndicator className="lk-participant-metadata-item" />
            </div>
        </>
    );
}

function BrandedParticipantTile(props: ParticipantTileProps) {
    return (
        <ParticipantTile {...props}>
            <BrandedTileContent />
        </ParticipantTile>
    );
}

function BrandedVideoConference() {
    const [widgetState, setWidgetState] = useState<WidgetState>({
        showChat: false,
        unreadMessages: 0,
        showSettings: false,
    });
    const [isDeafened, setIsDeafened] = useState(false);
    const [restoreMicState, setRestoreMicState] = useState<boolean | null>(null);
    const lastAutoFocusedScreenShareTrack = useRef<TrackReferenceOrPlaceholder | null>(null);
    const layoutContext = useCreateLayoutContext();
    const [screenShareError, setScreenShareError] = useState<string | null>(null);
    const room = useRoomContext();

    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    const screenShareTracks = tracks
        .filter(isTrackReference)
        .filter(track => track.publication.source === Track.Source.ScreenShare);

    const focusTrack = usePinnedTracks(layoutContext)?.[0];
    const carouselTracks = tracks.filter(track => !isEqualTrackRef(track, focusTrack));

    useEffect(() => {
        const hasSubscribedScreenShare = screenShareTracks.some(
            track => track.publication.isSubscribed,
        );

        if (hasSubscribedScreenShare && lastAutoFocusedScreenShareTrack.current === null) {
            layoutContext.pin.dispatch?.({
                msg: 'set_pin',
                trackReference: screenShareTracks[0],
            });
            lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
        } else if (
            lastAutoFocusedScreenShareTrack.current &&
            !screenShareTracks.some(
                track =>
                    track.publication.trackSid ===
                    lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
            )
        ) {
            layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
            lastAutoFocusedScreenShareTrack.current = null;
        }
        if (focusTrack && !isTrackReference(focusTrack)) {
            const updatedFocusTrack = tracks.find(
                tr =>
                    tr.participant.identity === focusTrack.participant.identity &&
                    tr.source === focusTrack.source,
            );
            if (updatedFocusTrack && isTrackReference(updatedFocusTrack)) {
                layoutContext.pin.dispatch?.({
                    msg: 'set_pin',
                    trackReference: updatedFocusTrack,
                });
            }
        }
    }, [
        focusTrack,
        layoutContext,
        screenShareTracks,
        tracks,
    ]);

    useEffect(() => {
        if (!room) return;
        if (isDeafened) {
            const wasEnabled = room.localParticipant.isMicrophoneEnabled;
            setRestoreMicState(prev => prev ?? wasEnabled);
            void room.localParticipant.setMicrophoneEnabled(false);
            return;
        }
        if (restoreMicState !== null) {
            void room.localParticipant.setMicrophoneEnabled(restoreMicState);
            setRestoreMicState(null);
        }
    }, [isDeafened, restoreMicState, room]);

    useEffect(() => {
        if (!room) return;
        const participant = room.localParticipant;
        const handleUnmuted = (publication: { source: Track.Source }) => {
            if (!isDeafened) return;
            if (publication.source === Track.Source.Microphone) {
                void participant.setMicrophoneEnabled(false);
            }
        };
        participant.on(ParticipantEvent.TrackUnmuted, handleUnmuted);
        return () => {
            participant.off(ParticipantEvent.TrackUnmuted, handleUnmuted);
        };
    }, [isDeafened, room]);

    useEffect(() => {
        const micToggle = document.querySelector<HTMLButtonElement>(
            '[data-lk-control-bar] button[data-lk-source="microphone"]',
        );
        if (!micToggle) return;
        if (isDeafened) {
            micToggle.setAttribute('disabled', 'true');
            micToggle.setAttribute('aria-disabled', 'true');
        } else {
            micToggle.removeAttribute('disabled');
            micToggle.setAttribute('aria-disabled', 'false');
        }
    }, [isDeafened]);

    const toggleDeafen = () => {
        setIsDeafened(current => !current);
    };

    return (
        <div className="lk-video-conference">
            <LayoutContextProvider value={layoutContext} onWidgetChange={state => setWidgetState(state)}>
                <div className="lk-video-conference-inner">
                    {!focusTrack ? (
                        <div className="lk-grid-layout-wrapper">
                            <GridLayout tracks={tracks}>
                                <BrandedParticipantTile />
                            </GridLayout>
                        </div>
                    ) : (
                        <div className="lk-focus-layout-wrapper">
                            <FocusLayoutContainer>
                                <CarouselLayout tracks={carouselTracks}>
                                    <BrandedParticipantTile />
                                </CarouselLayout>
                                {focusTrack && (
                                    <BrandedParticipantTile trackRef={focusTrack} className="lk-focus-track" />
                                )}
                            </FocusLayoutContainer>
                        </div>
                    )}
                    <div className="lk-control-bar-row" data-lk-control-bar data-audio-off={isDeafened ? 'true' : 'false'}>
                        <ControlBar
                            className="lk-control-bar--main"
                            controls={{ chat: true, screenShare: true }}
                            onDeviceError={({ source, error }) => {
                                if (source === Track.Source.ScreenShare) {
                                    setScreenShareError(
                                        error?.message ||
                                            'Не удалось включить демонстрацию экрана. Проверьте разрешения браузера.',
                                    );
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="lk-button lk-deafen-button"
                            aria-pressed={isDeafened}
                            data-lk-enabled={isDeafened}
                            onClick={toggleDeafen}
                            title={isDeafened ? 'Audio off enabled' : 'Audio off'}
                        >
                            <DeafenIcon muted={isDeafened} />
                            <span>Audio off</span>
                        </button>
                    </div>
                </div>
                {screenShareError && (
                    <div className="soft-alert" style={{ margin: '6px 12px' }}>
                        {screenShareError}
                        <button
                            type="button"
                            className="btn ghost small"
                            style={{ marginLeft: 8 }}
                            onClick={() => setScreenShareError(null)}
                        >
                            Ок
                        </button>
                    </div>
                )}
                <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
            </LayoutContextProvider>
            <RoomAudioRenderer muted={isDeafened} />
            <ConnectionStateToast />
        </div>
    );
}

function DeafenIcon({ muted }: { muted: boolean }) {
    return (
        <svg
            className="lk-deafen-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M3.5 8.5h3l4-3.5v10l-4-3.5h-3z" />
            {muted ? (
                <path d="M13.5 7.5l3 3m0-3l-3 3" />
            ) : (
                <>
                    <path d="M13.6 8.2c.7.6 1 1.2 1 1.8s-.3 1.2-1 1.8" />
                    <path d="M15.7 6.7c1.4 1.1 2 2.4 2 3.3s-.6 2.2-2 3.3" />
                </>
            )}
        </svg>
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
