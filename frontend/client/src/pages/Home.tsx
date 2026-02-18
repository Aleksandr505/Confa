import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    activateMyAvatar,
    createRoom,
    fetchMyAvatarAssets,
    fetchMyProfile,
    fetchMyRoomsSummary,
    resolveAvatar,
    type MyAvatarAssetDto,
    type MyProfileDto,
    type RoomAccessSummary,
    uploadMyAvatar,
} from '../api';
import { getUserIdentity } from '../lib/auth';
import '../styles/login.css';
import '../styles/home.css';

function normalizeRoomName(raw: string) {
    return raw
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
}

export default function HomePage() {
    const [rooms, setRooms] = useState<RoomAccessSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [roomName, setRoomName] = useState('my-room');
    const [creating, setCreating] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profile, setProfile] = useState<MyProfileDto | null>(null);
    const [avatars, setAvatars] = useState<MyAvatarAssetDto[]>([]);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const profilePopupRef = useRef<HTMLDivElement | null>(null);
    const nav = useNavigate();
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);
    const profileInitials = useMemo(() => {
        const source = profile?.username || (myUserId ? `user ${myUserId}` : 'user');
        const parts = source.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'U';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'U';
    }, [profile?.username, myUserId]);

    useEffect(() => {
        document.body.classList.remove('app-shell-mode');
    }, []);

    useEffect(() => {
        if (!myUserId) return;
        resolveAvatar(myUserId)
            .then(item => {
                const url = toAbsoluteAvatarUrl(item.contentUrl);
                setCurrentAvatarUrl(url || null);
            })
            .catch(e => {
                console.warn('Failed to resolve current avatar', e);
            });
    }, [myUserId]);

    useEffect(() => {
        if (!profileOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (profilePopupRef.current?.contains(target)) return;
            setProfileOpen(false);
        };
        window.addEventListener('mousedown', onPointerDown);
        return () => {
            window.removeEventListener('mousedown', onPointerDown);
        };
    }, [profileOpen]);

    const loadRoomOrder = () => {
        try {
            const raw = localStorage.getItem('confa:roomLastVisited');
            return raw ? (JSON.parse(raw) as Record<string, number>) : {};
        } catch (e) {
            console.warn('Failed to load room order', e);
            return {};
        }
    };

    const storeRoomVisit = (name: string) => {
        try {
            const order = loadRoomOrder();
            order[name] = Date.now();
            localStorage.setItem('confa:roomLastVisited', JSON.stringify(order));
        } catch (e) {
            console.warn('Failed to store room order', e);
        }
    };

    useEffect(() => {
        loadRooms();
    }, []);

    async function loadRooms() {
        setLoading(true);
        setErr(null);
        try {
            const list = await fetchMyRoomsSummary();
            const order = loadRoomOrder();
            const sorted = list.slice().sort((a, b) => {
                const aOrder = order[a.name] ?? 0;
                const bOrder = order[b.name] ?? 0;
                if (aOrder === bOrder) return 0;
                return bOrder - aOrder;
            });
            setRooms(sorted);
            if (list.length === 0) {
                setRoomName('my-room');
            }
        } catch (e: any) {
            setErr(e?.message || 'Не удалось получить список комнат');
        } finally {
            setLoading(false);
        }
    }

    async function onCreateRoom(e: FormEvent) {
        e.preventDefault();
        const slug = normalizeRoomName(roomName);
        if (!slug || slug.length < 3) {
            setErr('Название должно содержать минимум 3 символа (a-z, 0-9, -, _)');
            return;
        }
        setErr(null);
        setCreating(true);
        try {
            const room = await createRoom({ name: slug });
            const summary: RoomAccessSummary = {
                ...room,
                participantCount: 0,
                participantNames: [],
            };
            storeRoomVisit(room.name);
            setRooms(prev => [summary, ...prev.filter(r => r.id !== room.id)]);
            nav(`/room/${encodeURIComponent(room.name)}`);
        } catch (e: any) {
            const message = typeof e?.message === 'string' && e.message.startsWith('409')
                ? 'Такая комната уже существует. Выберите другое имя или попросите инвайт.'
                : e?.message || 'Не удалось создать комнату';
            setErr(message);
        } finally {
            setCreating(false);
        }
    }

    async function onAvatarSelected(file?: File | null) {
        if (!file) return;
        setAvatarBusy(true);
        setAvatarMessage(null);
        try {
            const item = await uploadMyAvatar(file, 'GLOBAL');
            const resolved = toAbsoluteAvatarUrl(item.contentUrl);
            if (resolved) setCurrentAvatarUrl(resolved);
            await loadProfileCard();
            setAvatarMessage('Аватар обновлён');
        } catch (e: any) {
            setAvatarMessage(e?.message || 'Не удалось загрузить аватар');
        } finally {
            setAvatarBusy(false);
            if (avatarInputRef.current) {
                avatarInputRef.current.value = '';
            }
        }
    }

    async function loadProfileCard() {
        setProfileLoading(true);
        setProfileError(null);
        try {
            const [myProfile, avatarItems] = await Promise.all([
                fetchMyProfile(),
                fetchMyAvatarAssets(),
            ]);
            setProfile(myProfile);
            setAvatars(avatarItems);
            const active = avatarItems.find(item => item.activeGlobal);
            const activeUrl = toAbsoluteAvatarUrl(active?.contentUrl);
            if (activeUrl) setCurrentAvatarUrl(activeUrl);
        } catch (e: any) {
            setProfileError(e?.message || 'Не удалось загрузить профиль');
        } finally {
            setProfileLoading(false);
        }
    }

    async function onActivateAvatar(assetId: number) {
        try {
            setAvatarBusy(true);
            setAvatarMessage(null);
            const item = await activateMyAvatar(assetId);
            const resolved = toAbsoluteAvatarUrl(item.contentUrl);
            if (resolved) setCurrentAvatarUrl(resolved);
            await loadProfileCard();
            setAvatarMessage('Активная аватарка обновлена');
        } catch (e: any) {
            setAvatarMessage(e?.message || 'Не удалось переключить аватар');
        } finally {
            setAvatarBusy(false);
        }
    }

    function onToggleProfile() {
        const next = !profileOpen;
        setProfileOpen(next);
        if (next) {
            void loadProfileCard();
        }
    }

    return (
        <div className="auth-root client-theme home-root">
            <a
                className="switch-to-shell"
                href="/app"
                title="Open Messenger"
            >
                <img src="/chat_logo.png" alt="Messenger" className="switch-to-shell-logo" />
            </a>
            <button
                className="profile-avatar-btn"
                type="button"
                onClick={onToggleProfile}
                title="Профиль"
                style={currentAvatarUrl ? { backgroundImage: `url(${currentAvatarUrl})` } : undefined}
            >
                {!currentAvatarUrl ? profileInitials : null}
            </button>
            {profileOpen && (
                <div className="profile-popup" ref={profilePopupRef}>
                    <div className="profile-popup-title">Личный кабинет</div>
                    {profileLoading ? (
                        <div className="profile-popup-empty">Загрузка…</div>
                    ) : profileError ? (
                        <div className="alert alert-error">{profileError}</div>
                    ) : (
                        <>
                            <div className="profile-meta">
                                <div><strong>ID:</strong> {profile?.id ?? '—'}</div>
                                <div><strong>Логин:</strong> {profile?.username ?? '—'}</div>
                                <div><strong>Роль:</strong> {profile?.role ?? '—'}</div>
                            </div>
                            <div className="home-profile-upload-row">
                                <button
                                    className="btn primary"
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={avatarBusy}
                                >
                                    {avatarBusy ? 'Загрузка…' : 'Загрузить новую'}
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    style={{ display: 'none' }}
                                    onChange={e => onAvatarSelected(e.target.files?.[0])}
                                />
                            </div>
                            {avatarMessage && <div className="alert">{avatarMessage}</div>}
                            <div className="home-profile-avatars-list">
                                {avatars.length === 0 ? (
                                    <div className="profile-popup-empty">Загруженных аватарок пока нет</div>
                                ) : (
                                    avatars.map(item => {
                                        const url = toAbsoluteAvatarUrl(item.contentUrl);
                                        return (
                                            <div className="home-profile-avatar-item" key={item.assetId}>
                                                <div
                                                    className="home-profile-avatar-thumb"
                                                    style={url ? { backgroundImage: `url(${url})` } : undefined}
                                                />
                                                <div className="home-profile-avatar-info">
                                                    <div className="home-profile-avatar-name">asset #{item.assetId}</div>
                                                    <div className="home-profile-avatar-sub">
                                                        {formatAvatarMeta(item)}
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn"
                                                    type="button"
                                                    disabled={avatarBusy || item.activeGlobal}
                                                    onClick={() => onActivateAvatar(item.assetId)}
                                                >
                                                    {item.activeGlobal ? 'Активна' : 'Сделать активной'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            <div className="auth-card">
                <h1 className="auth-title">Confa</h1>
                <p className="auth-subtitle">Комнаты:</p>

                {err && <div className="alert alert-error">{err}</div>}
                {loading ? (
                    <div className="spinner" aria-label="loading" />
                ) : rooms.length === 0 ? (
                    <div className="alert">У вас пока нет комнат. Создайте личную комнату ниже или примите приглашение.</div>
                ) : (
                    <div className="room-list">
                        {rooms.map(room => {
                            const names = (room.participantNames || []).filter(Boolean);
                            const tooltip =
                                names.length > 0 ? names.join(', ') : 'Сейчас в комнате никого нет';
                            const hasParticipants = (room.participantCount ?? 0) > 0;
                            return (
                            <div className="room-row" key={room.id}>
                                <div className="room-info">
                                    <div className="room-name">{room.name}</div>
                                    <div className="room-meta">
                                        <span className="pill">{room.role === 'OWNER' ? 'Владелец' : 'Участник'}</span>
                                        <span
                                            className={`pill pill-muted room-tooltip${hasParticipants ? ' pill-online' : ''}`}
                                            title={tooltip}
                                            data-tooltip={tooltip}
                                        >
                                            {room.participantCount ?? 0} online
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="btn primary"
                                    type="button"
                                    onClick={() => {
                                        storeRoomVisit(room.name);
                                        nav(`/room/${encodeURIComponent(room.name)}`);
                                    }}
                                >
                                    Перейти
                                </button>
                            </div>
                        );
                        })}
                    </div>
                )}

                <hr className="divider divider-spaced" />

                <form className="auth-form" onSubmit={onCreateRoom}>
                    <label className="field">
                        <span>Создать новую комнату</span>
                        <input
                            value={roomName}
                            onChange={e => {
                                setRoomName(e.target.value);
                                setErr(null);
                            }}
                            placeholder="team-sync или demo"
                        />
                    </label>
                    <button className="btn primary" type="submit" disabled={creating}>
                        {creating ? 'Создаём…' : 'Создать и зайти'}
                    </button>
                </form>

            </div>
        </div>
    );
}

function toAbsoluteAvatarUrl(contentUrl?: string | null): string | undefined {
    if (!contentUrl) return undefined;
    return contentUrl.startsWith('http') ? contentUrl : `${import.meta.env.VITE_API_BASE}${contentUrl}`;
}

function formatAvatarMeta(item: MyAvatarAssetDto): string {
    const size = item.originalSizeBytes ? `${Math.round(item.originalSizeBytes / 1024)} KB` : 'size n/a';
    const dims = item.width && item.height ? `${item.width}x${item.height}` : 'dims n/a';
    const created = item.createdAt
        ? new Date(item.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'date n/a';
    return `${dims} • ${size} • ${created}`;
}
