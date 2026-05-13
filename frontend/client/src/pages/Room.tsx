import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AudioTrack,
    CarouselLayout,
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
    fetchChannelLivekitToken,
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
    createRoomMessage,
    fetchRoomMessages,
    resolveAvatarsBatch,
    type RoomAccess,
    type RoomInvite,
    uploadMessageImage,
    type MessageDto,
    addMessageReaction,
    removeMessageReaction,
} from '../api';
import '../styles/livekit-theme.css';
import { getUserIdentity, isAdmin } from '../lib/auth.ts';
import { getAvatarColor, getAvatarUrl, setAvatarUrlOverride } from '../lib/avatar';
import { ParticipantEvent, RoomEvent, Track } from 'livekit-client';
import Soundboard from '../components/Soundboard';
import { getErrorMessage } from '../lib/errors';
import MessageTimeline from '../components/MessageTimeline';
import MessageComposer from '../components/MessageComposer';
import type { CompressedChatImage } from '../lib/imageCompression';

const wsUrl = import.meta.env.VITE_LIVEKIT_WS_URL as string;
let presenceToneAudioCtx: AudioContext | null = null;
let lastLeaveToneAtMs = 0;

function getPresenceToneCtx() {
    const ctx = presenceToneAudioCtx ?? new AudioContext();
    presenceToneAudioCtx = ctx;
    return ctx;
}

function playJoinPresenceTone() {
    const ctx = getPresenceToneCtx();
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
}

function playLeavePresenceTone() {
    const nowMs = performance.now();
    if (nowMs - lastLeaveToneAtMs < 240) return;
    lastLeaveToneAtMs = nowMs;

    const ctx = getPresenceToneCtx();
    ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(740, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const start2 = now + 0.12;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(520, start2);
    gain2.gain.setValueAtTime(0.0001, start2);
    gain2.gain.exponentialRampToValueAtTime(0.06, start2 + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, start2 + 0.14);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(start2);
    osc2.stop(start2 + 0.16);
}

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

type RoomPageProps = {
    roomName?: string;
    channelId?: number;
    embedded?: boolean;
    hideChat?: boolean;
    onExit?: () => void;
};

type PreJoinSubmitValues = Partial<Choices>;

type AudioTrackWithVolume = {
    setVolume: (volume: number) => void;
};

function hasSetVolume(track: unknown): track is AudioTrackWithVolume {
    return !!track && typeof (track as { setVolume?: unknown }).setVolume === 'function';
}

export default function RoomPage({ roomName, channelId, embedded, hideChat, onExit }: RoomPageProps = {}) {
    const { roomId } = useParams();
    const resolvedRoomId = roomName ?? roomId ?? 'demo';
    const navigate = useNavigate();
    const handleExit = () => {
        if (onExit) {
            onExit();
            return;
        }
        navigate('/', { replace: true });
    };

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
    const [avatarRefreshTick, setAvatarRefreshTick] = useState(0);
    const handleAvatarsResolved = useCallback(() => {
        setAvatarRefreshTick(v => v + 1);
    }, []);

    const isAdminUser = isAdmin();

    const agentsFeatureEnabled = roomConfig?.isAgentsEnabled === true;

    useEffect(() => {
        if (!resolvedRoomId) return;
        const volumeKey = `confa:volumes:${resolvedRoomId}`;
        const screenShareKey = `confa:screenShareVolumes:${resolvedRoomId}`;
        try {
            const raw = localStorage.getItem(volumeKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, number>;
                setVolumes(parsed);
            }
        } catch (e) {
            console.warn('Failed to load volume settings', e);
        }
        try {
            const raw = localStorage.getItem(screenShareKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, number>;
                setScreenShareVolumes(parsed);
            }
        } catch (e) {
            console.warn('Failed to load screen share volume settings', e);
        }
    }, [resolvedRoomId]);

    useEffect(() => {
        if (!resolvedRoomId) return;
        const volumeKey = `confa:volumes:${resolvedRoomId}`;
        try {
            localStorage.setItem(volumeKey, JSON.stringify(volumes));
        } catch (e) {
            console.warn('Failed to save volume settings', e);
        }
    }, [resolvedRoomId, volumes]);

    useEffect(() => {
        if (!resolvedRoomId) return;
        const screenShareKey = `confa:screenShareVolumes:${resolvedRoomId}`;
        try {
            localStorage.setItem(screenShareKey, JSON.stringify(screenShareVolumes));
        } catch (e) {
            console.warn('Failed to save screen share volume settings', e);
        }
    }, [resolvedRoomId, screenShareVolumes]);

    useEffect(() => {
        if (!resolvedRoomId) return;
        fetchMyRooms()
            .then(list => setRoomAccess(list.find(r => r.name === resolvedRoomId) || null))
            .catch(() => {});
    }, [resolvedRoomId]);

    useEffect(() => {
        if (!ready || !resolvedRoomId) return;

        setRoomConfigLoading(true);
        setRoomConfigError(null);

        fetchRoomMetadata(resolvedRoomId)
            .then(cfg => setRoomConfig(cfg))
            .catch((e: unknown) => {
                console.warn('Failed to load room config', e);
                setRoomConfigError(getErrorMessage(e, 'Не удалось получить конфиг комнаты'));
            })
            .finally(() => setRoomConfigLoading(false));
    }, [ready, resolvedRoomId]);

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        setPrejoinError(undefined);
        setToken(undefined);
        (async () => {
            try {
                const displayName = choices?.username?.trim() || undefined;
                const t = channelId
                    ? await fetchChannelLivekitToken(channelId)
                    : await fetchLivekitToken(resolvedRoomId, displayName);
                if (!cancelled) setToken(t);
            } catch (e: unknown) {
                if (!cancelled) {
                    const raw = getErrorMessage(e, 'Token error');
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
    }, [channelId, ready, resolvedRoomId, choices?.username]);

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
            if (!resolvedRoomId) return;
            if (!silent) setAgentsLoading(true);
            setAgentsError(null);
            try {
                const list = await fetchRoomAgents(resolvedRoomId);
                setAgents(list);
                if (!selectedAgentId && list.length) {
                    setSelectedAgentId(list[0].identity);
                } else if (
                    selectedAgentId &&
                    !list.some(a => a.identity === selectedAgentId)
                ) {
                    setSelectedAgentId(list[0]?.identity);
                }
            } catch (e: unknown) {
                setAgentsError(getErrorMessage(e, 'Не удалось загрузить агентов'));
            } finally {
                if (!silent) setAgentsLoading(false);
            }
        },
        [resolvedRoomId, selectedAgentId],
    );

    useEffect(() => {
        if (!ready || !resolvedRoomId) return;
        const id = setInterval(() => {
            loadAgents(true);
        }, 5000);
        return () => clearInterval(id);
    }, [ready, resolvedRoomId, loadAgents]);

    useEffect(() => {
        if (!ready) return;
        loadAgents(true);
    }, [ready, resolvedRoomId, loadAgents]);

    useEffect(() => {
        if (!inviteInfo) {
            setInviteCopied(false);
        }
    }, [inviteInfo]);

    async function handleEnableAgents() {
        if (!resolvedRoomId) return;
        try {
            await enableRoomAgents(resolvedRoomId);
            const cfg = await fetchRoomMetadata(resolvedRoomId);
            setRoomConfig(cfg);
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось включить агентов'));
        }
    }

    async function handleDisableAgents() {
        if (!resolvedRoomId) return;
        if (!confirm('Отключить агентов в этой комнате? Все приглашения станут недоступны.')) {
            return;
        }
        try {
            await disableRoomAgents(resolvedRoomId);
            const cfg = await fetchRoomMetadata(resolvedRoomId);
            setRoomConfig(cfg);
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось отключить агентов'));
        }
    }

    async function handleCreateInvite() {
        if (!resolvedRoomId) return;
        setInviteBusy(true);
        setInviteError(null);
        setInviteInfo(null);
        try {
            const invite = await createInvite(resolvedRoomId, {});
            setInviteInfo(invite);
        } catch (e: unknown) {
            setInviteError(getErrorMessage(e, 'Не удалось создать приглашение'));
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
        } catch (e: unknown) {
            setInviteError(getErrorMessage(e, 'Не удалось скопировать приглашение'));
        }
    }

    async function handleInvite(role: AgentRole) {
        if (!resolvedRoomId) return;
        setInviteLoading(true);
        try {
            await inviteAgent(resolvedRoomId, role);
            await loadAgents();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось пригласить агента'));
        } finally {
            setInviteLoading(false);
        }
    }

    async function handleKick() {
        if (!resolvedRoomId || !selectedAgentId) return;
        if (!confirm(`Выгнать агента ${selectedAgentId} из комнаты ${resolvedRoomId}?`)) return;
        try {
            await kickAgent(resolvedRoomId, { agentIdentity: selectedAgentId });
            await loadAgents();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось выгнать агента'));
        }
    }

    async function handleToggleMute() {
        if (!resolvedRoomId || !selectedAgentId) return;
        const agent = agents.find(a => a.identity === selectedAgentId);
        if (!agent) return;
        try {
            await muteAgent(resolvedRoomId, agent.sid, !agent.muted);
            await loadAgents();
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось изменить mute для агента'));
        }
    }

    async function handleFocus() {
        if (!resolvedRoomId || !selectedAgentId) return;
        const userIdentity = getUserIdentity();
        if (!userIdentity) {
            alert('Не удалось определить вашу identity');
            return;
        }
        try {
            await focusAgent(resolvedRoomId, {
                activeAgentIdentity: selectedAgentId,
                userIdentity,
            });
            alert('Агенту отправлен сигнал сфокусироваться на вас');
        } catch (e: unknown) {
            alert(getErrorMessage(e, 'Не удалось сфокусировать агента'));
        }
    }

    if (!ready) {
        return (
            <div className={`lk-root gradient-bg${embedded ? ' embedded' : ''}`}>
                <div className="prejoin-shell theme-light" data-lk-theme="default">
                    <header className="lk-appbar light">
                        <div className="brand">
                            <span className="brand-dot" />
                            <span className="brand-title">Комната: {resolvedRoomId}</span>
                        </div>
                        <button
                            className="btn ghost small"
                            type="button"
                                onClick={handleExit}
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
                            onSubmit={(values: PreJoinSubmitValues) => {
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
                                setPrejoinError(getErrorMessage(e, 'Permission or device error'));
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
            <div className={`lk-root gradient-bg${embedded ? ' embedded' : ''}`}>
                <div className="center-card">
                    {prejoinError ? (
                        <>
                            <div className="soft-alert">{prejoinError}</div>
                            <button
                                className="btn ghost small"
                                type="button"
                                onClick={handleExit}
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
        <div className={`lk-root gradient-bg${embedded ? ' embedded' : ''}`}>
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
                            getErrorMessage(
                                failure,
                                'Permission denied: браузер заблокировал доступ к устройствам',
                            ),
                    });
                    console.warn('Media device failure', failure, kind);
                }}
                onError={e => {
                    console.error(e);
                }}
                onDisconnected={() => {
                    playLeavePresenceTone();
                    setReady(false);
                    setToken(undefined);
                    setVolumePanelOpen(false);
                    handleExit();
                }}
            >
                <header className="lk-appbar">
                    <div className="brand">
                        <span className="brand-dot" />
                        <span className="brand-title">Комната: {resolvedRoomId}</span>
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
                <AvatarSync
                    roomName={resolvedRoomId}
                    onResolved={handleAvatarsResolved}
                />
                <VolumesPanel
                    open={volumePanelOpen}
                    onClose={() => setVolumePanelOpen(false)}
                    volumes={volumes}
                    setVolumes={setVolumes}
                    screenShareVolumes={screenShareVolumes}
                    setScreenShareVolumes={setScreenShareVolumes}
                />
                <ParticipantPresenceTone />

                <main className="lk-main">
                    <BrandedVideoConference
                        disableChat={hideChat || embedded}
                        avatarRefreshTick={avatarRefreshTick}
                        roomName={resolvedRoomId}
                    />
                </main>

                <StartAudio label="Включить звук в браузере" />
            </LiveKitRoom>
        </div>
    );
}

function AvatarSync({
    roomName,
    onResolved,
}: {
    roomName: string;
    onResolved: () => void;
}) {
    const participants = useRemoteParticipants();
    const room = useRoomContext();
    const resolvedAvatarByUserIdRef = useRef<Map<number, string | null>>(new Map());

    const userIds = useMemo(() => {
        const ids = new Set<number>();
        const localIdentity = room.localParticipant?.identity;
        if (localIdentity) {
            const parsed = Number(localIdentity);
            if (Number.isFinite(parsed) && parsed > 0) ids.add(parsed);
        }
        for (const participant of participants) {
            const parsed = Number(participant.identity);
            if (Number.isFinite(parsed) && parsed > 0) ids.add(parsed);
        }
        return Array.from(ids).sort((a, b) => a - b);
    }, [participants, room.localParticipant?.identity]);
    const userIdsKey = useMemo(() => userIds.join(','), [userIds]);

    useEffect(() => {
        resolvedAvatarByUserIdRef.current.clear();
    }, [roomName]);

    useEffect(() => {
        if (!userIdsKey) {
            resolvedAvatarByUserIdRef.current.clear();
            return;
        }
        const activeUserIds = new Set(
            userIdsKey
                .split(',')
                .map(value => Number(value))
                .filter(value => Number.isFinite(value) && value > 0),
        );
        for (const cachedUserId of resolvedAvatarByUserIdRef.current.keys()) {
            if (!activeUserIds.has(cachedUserId)) {
                resolvedAvatarByUserIdRef.current.delete(cachedUserId);
            }
        }
    }, [userIdsKey]);

    useEffect(() => {
        if (!userIdsKey) return;
        const currentUserIds = userIdsKey
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0);
        if (currentUserIds.length === 0) return;
        let cancelled = false;
        const unresolvedUserIds = currentUserIds.filter(
            userId => !resolvedAvatarByUserIdRef.current.has(userId),
        );
        if (unresolvedUserIds.length === 0) return;

        void (async () => {
            try {
                const items = await resolveAvatarsBatch(unresolvedUserIds, undefined, roomName);
                if (cancelled) return;
                const resolvedByUserId = new Map<number, string | null>();
                for (const item of items) {
                    if (!item.userId) continue;
                    const resolvedUrl = item.contentUrl
                        ? item.contentUrl.startsWith('http')
                            ? item.contentUrl
                            : `${import.meta.env.VITE_API_BASE}${item.contentUrl}`
                        : null;
                    resolvedByUserId.set(item.userId, resolvedUrl);
                }

                let changed = false;
                for (const userId of unresolvedUserIds) {
                    const nextUrl = resolvedByUserId.get(userId) ?? null;
                    const prevUrl = resolvedAvatarByUserIdRef.current.get(userId);
                    resolvedAvatarByUserIdRef.current.set(userId, nextUrl);
                    if (prevUrl !== nextUrl) {
                        setAvatarUrlOverride(String(userId), nextUrl);
                        changed = true;
                    }
                }

                if (changed) {
                    onResolved();
                }
            } catch (e) {
                if (!cancelled) {
                    console.warn('Failed to sync avatars', e);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [onResolved, roomName, userIdsKey]);

    return null;
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
    const screenShareAudioByParticipant = useMemo(() => {
        const unique = new Map<string, TrackReferenceOrPlaceholder>();
        for (const track of screenShareAudioTracks) {
            if (!unique.has(track.participant.identity)) {
                unique.set(track.participant.identity, track);
            }
        }
        return Array.from(unique.values());
    }, [screenShareAudioTracks]);

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
    }, [participants, setVolumes, volumes]);

    useEffect(() => {
        let changed = false;
        const next = { ...screenShareVolumes };
        for (const track of screenShareAudioTracks) {
            const identity = track.participant.identity;
            if (next[identity] === undefined) {
                next[identity] = 0.5;
                const audioTrack = track.publication?.track;
                if (audioTrack?.kind === Track.Kind.Audio && hasSetVolume(audioTrack)) {
                    audioTrack.setVolume(0.5);
                }
                changed = true;
            }
        }
        if (changed) setScreenShareVolumes(next);
    }, [screenShareAudioTracks, screenShareVolumes, setScreenShareVolumes]);

    useEffect(() => {
        for (const track of screenShareAudioTracks) {
            const volume = screenShareVolumes[track.participant.identity];
            const audioTrack = track.publication?.track;
            if (
                volume !== undefined &&
                audioTrack &&
                audioTrack.kind === Track.Kind.Audio &&
                hasSetVolume(audioTrack)
            ) {
                audioTrack.setVolume(volume);
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
            {screenShareAudioByParticipant.length > 0 && (
                <>
                    <div className="volume-panel__subhead">Демонстрация экрана</div>
                    <div className="volume-panel__list">
                        {screenShareAudioByParticipant.map(track => {
                            const identity = track.participant.identity;
                            const currentVolume = screenShareVolumes[identity] ?? 0.5;
                            const label = track.participant.name || track.participant.identity;
                            return (
                                <div className="volume-row" key={identity}>
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
                                                setScreenShareVolumes(map => ({ ...map, [identity]: next }));
                                                const audioTrack = track.publication?.track;
                                                if (
                                                    audioTrack &&
                                                    audioTrack.kind === Track.Kind.Audio &&
                                                    hasSetVolume(audioTrack)
                                                ) {
                                                    audioTrack.setVolume(next);
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

function ParticipantPresenceTone() {
    const room = useRoomContext();

    useEffect(() => {
        const onParticipantConnected = () => {
            playJoinPresenceTone();
        };
        const onParticipantDisconnected = () => {
            playLeavePresenceTone();
        };
        const onRoomDisconnected = () => {
            playLeavePresenceTone();
        };

        room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        room.on(RoomEvent.Disconnected, onRoomDisconnected);

        return () => {
            room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
            room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
            room.off(RoomEvent.Disconnected, onRoomDisconnected);
        };
    }, [room]);

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

function BrandedVideoConference({
    disableChat,
    avatarRefreshTick,
    roomName,
}: {
    disableChat?: boolean;
    avatarRefreshTick: number;
    roomName: string;
}) {
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
    const [secondaryMenuOpen, setSecondaryMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const room = useRoomContext();
    const [isCameraEnabled, setIsCameraEnabled] = useState(() => room.localParticipant.isCameraEnabled);
    const secondaryMenuRef = useRef<HTMLDivElement | null>(null);
    const moreButtonRef = useRef<HTMLButtonElement | null>(null);

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
        const syncCamera = () => {
            setIsCameraEnabled(participant.isCameraEnabled);
        };
        const handleUnmuted = (publication: { source: Track.Source }) => {
            if (!isDeafened) return;
            if (publication.source === Track.Source.Microphone) {
                void participant.setMicrophoneEnabled(false);
            }
        };
        const handleTrackPublished = () => syncCamera();
        const handleTrackUnpublished = () => syncCamera();
        syncCamera();
        participant.on(ParticipantEvent.TrackUnmuted, handleUnmuted);
        participant.on(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
        participant.on(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);
        return () => {
            participant.off(ParticipantEvent.TrackUnmuted, handleUnmuted);
            participant.off(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
            participant.off(ParticipantEvent.LocalTrackUnpublished, handleTrackUnpublished);
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

    useEffect(() => {
        if (!secondaryMenuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (secondaryMenuRef.current?.contains(target)) return;
            if (moreButtonRef.current?.contains(target)) return;
            setSecondaryMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSecondaryMenuOpen(false);
            }
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [secondaryMenuOpen]);

    useEffect(() => {
        const isRoomShellFullscreen = () => {
            const fullscreenEl =
                document.fullscreenElement ??
                ((document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ?? null);
            if (!(fullscreenEl instanceof HTMLElement)) {
                setIsFullscreen(false);
                return;
            }
            setIsFullscreen(fullscreenEl.classList.contains('lk-room-shell'));
        };

        isRoomShellFullscreen();
        document.addEventListener('fullscreenchange', isRoomShellFullscreen);
        document.addEventListener('webkitfullscreenchange', isRoomShellFullscreen as EventListener);
        return () => {
            document.removeEventListener('fullscreenchange', isRoomShellFullscreen);
            document.removeEventListener('webkitfullscreenchange', isRoomShellFullscreen as EventListener);
        };
    }, []);

    const toggleDeafen = () => {
        setIsDeafened(current => !current);
    };

    const toggleCamera = async () => {
        const next = !room.localParticipant.isCameraEnabled;
        try {
            await room.localParticipant.setCameraEnabled(next);
            setIsCameraEnabled(next);
        } catch (error) {
            console.warn('Failed to toggle camera', error);
        }
    };

    const toggleFullscreen = async () => {
        const roomShell = document.querySelector<HTMLElement>('.lk-room-shell');
        if (!roomShell) return;
        const docWithWebkit = document as Document & {
            webkitFullscreenElement?: Element | null;
            webkitExitFullscreen?: () => Promise<void> | void;
        };
        const shellWithWebkit = roomShell as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
        };
        const activeFullscreenEl = document.fullscreenElement ?? docWithWebkit.webkitFullscreenElement ?? null;
        const isRoomFullscreen = activeFullscreenEl === roomShell;

        try {
            if (isRoomFullscreen) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (docWithWebkit.webkitExitFullscreen) {
                    await docWithWebkit.webkitExitFullscreen();
                }
            } else {
                if (roomShell.requestFullscreen) {
                    await roomShell.requestFullscreen();
                } else if (shellWithWebkit.webkitRequestFullscreen) {
                    await shellWithWebkit.webkitRequestFullscreen();
                }
            }
        } catch (error) {
            console.warn('Failed to toggle fullscreen', error);
        }
    };

    return (
        <div className="lk-video-conference" data-avatar-refresh={avatarRefreshTick}>
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
                    <div
                        className="lk-control-bar-row"
                        data-lk-control-bar
                        data-audio-off={isDeafened ? 'true' : 'false'}
                        data-menu-open={secondaryMenuOpen ? 'true' : 'false'}
                    >
                        <ControlBar
                            className="lk-control-bar--main"
                            controls={{ chat: !disableChat, screenShare: true, camera: false }}
                            onDeviceError={({ source, error }) => {
                                if (source === Track.Source.ScreenShare) {
                                    setScreenShareError(
                                        error?.message ||
                                            'Не удалось включить демонстрацию экрана. Проверьте разрешения браузера.',
                                    );
                                }
                            }}
                        />
                        <Soundboard
                            roomName={roomName}
                            audioOff={isDeafened}
                            triggerClassName="lk-button lk-soundboard-button"
                        />
                        <div
                            ref={secondaryMenuRef}
                            className="lk-secondary-controls"
                            data-open={secondaryMenuOpen ? 'true' : 'false'}
                        >
                            <button
                                type="button"
                                className="lk-button lk-secondary-action"
                                aria-pressed={isFullscreen}
                                onClick={() => {
                                    void toggleFullscreen();
                                    setSecondaryMenuOpen(false);
                                }}
                                title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Открыть во весь экран'}
                            >
                                <span>{isFullscreen ? '🗗 Exit full' : '🖥️ Full screen'}</span>
                            </button>
                            <button
                                type="button"
                                className="lk-button lk-secondary-action"
                                aria-pressed={isCameraEnabled}
                                onClick={() => {
                                    void toggleCamera();
                                    setSecondaryMenuOpen(false);
                                }}
                                title={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
                            >
                                <span>{isCameraEnabled ? '📷 Camera on' : '📷 Camera off'}</span>
                            </button>
                            <button
                                type="button"
                                className="lk-button lk-secondary-action lk-deafen-menu-action"
                                aria-pressed={isDeafened}
                                data-lk-enabled={isDeafened}
                                onClick={() => {
                                    toggleDeafen();
                                    setSecondaryMenuOpen(false);
                                }}
                                title={isDeafened ? 'Audio off enabled' : 'Audio off'}
                            >
                                <DeafenIcon muted={isDeafened} />
                                <span>🔇 Audio off</span>
                            </button>
                        </div>
                        <button
                            ref={moreButtonRef}
                            type="button"
                            className="lk-button lk-more-button"
                            aria-expanded={secondaryMenuOpen}
                            aria-haspopup="menu"
                            aria-label="Дополнительные действия"
                            onClick={() => setSecondaryMenuOpen(current => !current)}
                        >
                            <span>⋮</span>
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
                {!disableChat && (
                    <RoomChatPanel roomName={roomName} visible={widgetState.showChat} />
                )}
            </LayoutContextProvider>
            <RoomAudioRenderer muted={isDeafened} />
            <ConnectionStateToast />
        </div>
    );
}

function RoomChatPanel({ roomName, visible }: { roomName: string; visible: boolean }) {
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [avatarUrlByUserId, setAvatarUrlByUserId] = useState<Record<number, string>>({});
    const resolvedAvatarByUserIdRef = useRef<Map<number, string | null>>(new Map());
    const listRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef(true);
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);
    const avatarUserIds = useMemo(
        () =>
            Array.from(
                new Set(
                    messages
                        .map(msg => msg.senderUserId)
                        .filter((id): id is number => typeof id === 'number' && id > 0),
                ),
            ).sort((a, b) => a - b),
        [messages],
    );
    const avatarUsersKey = avatarUserIds.join(',');

    useEffect(() => {
        resolvedAvatarByUserIdRef.current.clear();
        setAvatarUrlByUserId({});
    }, [roomName]);

    useEffect(() => {
        let active = true;

        const mergeById = (prev: MessageDto[], incoming: MessageDto[]) => {
            const map = new Map<number, MessageDto>();
            for (const msg of prev) map.set(msg.id, msg);
            for (const msg of incoming) map.set(msg.id, msg);
            return Array.from(map.values()).sort((a, b) => a.id - b.id);
        };

        const loadMessages = async (silent: boolean) => {
            if (!silent) {
                setLoading(true);
                setError(null);
            }
            try {
                const page = await fetchRoomMessages(roomName);
                if (!active) return;
                const items = page.items.slice().reverse();
                setMessages(prev => mergeById(prev, items));
            } catch (e) {
                if (!silent && active) {
                    setError(getErrorMessage(e, 'Не удалось загрузить чат'));
                }
            } finally {
                if (!silent && active) setLoading(false);
            }
        };

        setMessages([]);
        void loadMessages(false);
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            void loadMessages(true);
        }, 3000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [roomName]);

    useEffect(() => {
        if (!avatarUsersKey) {
            resolvedAvatarByUserIdRef.current.clear();
            setAvatarUrlByUserId({});
            return;
        }
        const userIds = avatarUsersKey
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0);
        const active = new Set(userIds);
        for (const cachedUserId of resolvedAvatarByUserIdRef.current.keys()) {
            if (!active.has(cachedUserId)) {
                resolvedAvatarByUserIdRef.current.delete(cachedUserId);
            }
        }
        const unresolvedUserIds = userIds.filter(userId => !resolvedAvatarByUserIdRef.current.has(userId));
        if (unresolvedUserIds.length === 0) return;

        let cancelled = false;
        const syncAvatars = async () => {
            try {
                const items = await resolveAvatarsBatch(unresolvedUserIds, undefined, roomName);
                if (cancelled) return;
                const resolvedBatch = new Map<number, string | null>();
                for (const item of items) {
                    const resolvedUrl = item.contentUrl
                        ? item.contentUrl.startsWith('http')
                            ? item.contentUrl
                            : `${import.meta.env.VITE_API_BASE}${item.contentUrl}`
                        : null;
                    resolvedBatch.set(item.userId, resolvedUrl);
                }
                setAvatarUrlByUserId(prev => {
                    const next = { ...prev };
                    let changed = false;
                    for (const userId of unresolvedUserIds) {
                        const url = resolvedBatch.get(userId) ?? null;
                        resolvedAvatarByUserIdRef.current.set(userId, url);
                        if (url) {
                            if (next[userId] !== url) {
                                next[userId] = url;
                                changed = true;
                            }
                        } else if (next[userId]) {
                            delete next[userId];
                            changed = true;
                        }
                    }
                    return changed ? next : prev;
                });
            } catch (e) {
                if (!cancelled) console.warn('Failed to sync room chat avatars', e);
            }
        };

        void syncAvatars();

        return () => {
            cancelled = true;
        };
    }, [avatarUsersKey, roomName]);

    useEffect(() => {
        const list = listRef.current;
        if (!list || !autoScrollRef.current) return;
        list.scrollTop = list.scrollHeight;
    }, [messages]);

    const handleScroll = () => {
        const list = listRef.current;
        if (!list) return;
        const threshold = 48;
        const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        const atBottom = distanceToBottom <= threshold;
        autoScrollRef.current = atBottom;
        setShowScrollDown(!atBottom);
    };

    const scrollToBottom = () => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = list.scrollHeight;
        autoScrollRef.current = true;
        setShowScrollDown(false);
    };

    async function sendMessage(body: string, image?: CompressedChatImage) {
        try {
            const attachmentIds = image
                ? [(await uploadMessageImage(image.file, { roomName })).id]
                : [];
            const msg = await createRoomMessage(roomName, body, replyTo?.id, attachmentIds);
            setMessages(prev => [...prev, msg]);
            setReplyTo(null);
            setError(null);
        } catch (e) {
            setError(getErrorMessage(e, 'Не удалось отправить сообщение'));
            throw e;
        }
    }

    async function toggleReaction(message: MessageDto, emoji: string, reactedByMe: boolean) {
        try {
            const reactions = reactedByMe
                ? await removeMessageReaction(message.id, emoji)
                : await addMessageReaction(message.id, emoji);
            setMessages(prev =>
                prev.map(item => (item.id === message.id ? { ...item, reactions } : item)),
            );
        } catch (e) {
            console.warn('Failed to toggle room chat reaction', e);
        }
    }

    return (
        <aside className="lk-room-chat-panel" data-visible={visible ? 'true' : 'false'}>
            <div className="lk-room-chat-title">Chat</div>
            <div className="message-panel lk-room-message-panel">
                {loading ? (
                    <div className="empty-subtitle">Loading messages…</div>
                ) : error ? (
                    <div className="alert-banner">{error}</div>
                ) : messages.length === 0 ? (
                    <div className="empty-subtitle">No messages yet.</div>
                ) : (
                    <MessageTimeline
                        messages={messages}
                        myUserId={myUserId}
                        listRef={listRef}
                        onScroll={handleScroll}
                        avatarUrlByUserId={avatarUrlByUserId}
                        onReply={setReplyTo}
                        onToggleReaction={toggleReaction}
                    />
                )}
                {showScrollDown && (
                    <button className="scroll-down-btn" type="button" onClick={scrollToBottom}>
                        Newer
                    </button>
                )}
            </div>
            <MessageComposer
                key={`room-composer-${roomName}`}
                placeholder={`Message ${roomName}`}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onSend={sendMessage}
            />
        </aside>
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
        } catch (e: unknown) {
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
