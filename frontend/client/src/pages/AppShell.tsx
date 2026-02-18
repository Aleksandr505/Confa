import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import '../styles/app-shell.css';
import {
    activateMyAvatar,
    type ChannelDto,
    type DmSummary,
    type MyAvatarAssetDto,
    type MyProfileDto,
    type WorkspaceDto,
    type WorkspaceUserDto,
    createDmChannel,
    createWorkspace,
    createWorkspaceChannel,
    createWorkspaceInvite,
    fetchDmList,
    fetchMyAvatarAssets,
    fetchMyProfile,
    fetchWorkspaceChannels,
    fetchWorkspaceMembers,
    fetchWorkspaces,
    resolveAvatarsBatch,
    uploadMyAvatar,
} from '../api';
import { getUserIdentity } from '../lib/auth';

type AppShellState = {
    workspaces: WorkspaceDto[];
    channels: ChannelDto[];
    dms: DmSummary[];
    activeWorkspace?: WorkspaceDto;
    loadingWorkspaces: boolean;
    loadingChannels: boolean;
    loadingDms: boolean;
    refreshWorkspaces: () => Promise<void>;
    refreshDms: () => Promise<void>;
    openWorkspace: (workspaceId: number) => Promise<void>;
};

const AppShellContext = createContext<AppShellState | null>(null);

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
}

function initialsFromName(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || '?';
}

function toAbsoluteAvatarUrl(contentUrl?: string | null): string | undefined {
    if (!contentUrl) return undefined;
    return contentUrl.startsWith('http') ? contentUrl : `${import.meta.env.VITE_API_BASE}${contentUrl}`;
}

function formatAvatarMeta(item: MyAvatarAssetDto): string {
    const size = item.originalSizeBytes ? `${Math.round(item.originalSizeBytes / 1024)} KB` : 'size n/a';
    const dims = item.width && item.height ? `${item.width}x${item.height}` : 'dims n/a';
    return `${dims} • ${size}`;
}

export function useAppShell() {
    const ctx = useContext(AppShellContext);
    if (!ctx) throw new Error('AppShellContext is not available');
    return ctx;
}

export default function AppShellLayout() {
    const navigate = useNavigate();
    const { workspaceId, channelId } = useParams();
    const location = useLocation();

    const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
    const [channels, setChannels] = useState<ChannelDto[]>([]);
    const [dms, setDms] = useState<DmSummary[]>([]);
    const [dmAvatarUrlByUserId, setDmAvatarUrlByUserId] = useState<Record<number, string>>({});
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
    const [loadingChannels, setLoadingChannels] = useState(false);
    const [loadingDms, setLoadingDms] = useState(true);
    const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
    const [channelModalOpen, setChannelModalOpen] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceSlug, setWorkspaceSlug] = useState('');
    const [channelName, setChannelName] = useState('');
    const [channelTopic, setChannelTopic] = useState('');
    const [channelType, setChannelType] = useState<'TEXT' | 'VOICE'>('TEXT');
    const [formError, setFormError] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        workspace: WorkspaceDto;
    } | null>(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteWorkspace, setInviteWorkspace] = useState<WorkspaceDto | null>(null);
    const [inviteTtl, setInviteTtl] = useState('');
    const [inviteMaxUses, setInviteMaxUses] = useState('');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [inviteBusy, setInviteBusy] = useState(false);
    const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserDto[]>([]);
    const [loadingWorkspaceUsers, setLoadingWorkspaceUsers] = useState(false);
    const [workspaceUserAvatarById, setWorkspaceUserAvatarById] = useState<Record<number, string>>({});
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profile, setProfile] = useState<MyProfileDto | null>(null);
    const [avatars, setAvatars] = useState<MyAvatarAssetDto[]>([]);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const profilePopupRef = useRef<HTMLDivElement | null>(null);

    const activeWorkspaceId = workspaceId ? Number(workspaceId) : undefined;
    const activeWorkspace = useMemo(
        () => workspaces.find(w => w.id === activeWorkspaceId),
        [workspaces, activeWorkspaceId],
    );
    const isDmMode = location.pathname.startsWith('/app/dm');
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);
    const sortedWorkspaceUsers = useMemo(() => {
        if (workspaceUsers.length === 0) return [];
        if (!myUserId) return workspaceUsers;
        const me = workspaceUsers.filter(user => user.id === myUserId);
        const others = workspaceUsers.filter(user => user.id !== myUserId);
        return [...me, ...others];
    }, [workspaceUsers, myUserId]);
    const workspaceUserIdsKey = useMemo(
        () => workspaceUsers.map(user => user.id).sort((a, b) => a - b).join(','),
        [workspaceUsers],
    );

    const refreshWorkspaces = useCallback(async () => {
        setLoadingWorkspaces(true);
        try {
            const list = await fetchWorkspaces();
            setWorkspaces(list);
        } finally {
            setLoadingWorkspaces(false);
        }
    }, []);

    const refreshDms = useCallback(async () => {
        setLoadingDms(true);
        try {
            const list = await fetchDmList();
            setDms(list);
        } finally {
            setLoadingDms(false);
        }
    }, []);

    const openWorkspace = useCallback(async (id: number) => {
        setLoadingChannels(true);
        try {
            const list = await fetchWorkspaceChannels(id);
            setChannels(list);
            const first = list[0];
            if (first) {
                navigate(`/app/w/${id}/ch/${first.id}`);
            } else {
                navigate(`/app/w/${id}`, { replace: true });
            }
        } finally {
            setLoadingChannels(false);
        }
    }, [navigate]);

    const handleCreateWorkspace = async () => {
        setFormError(null);
        const name = workspaceName.trim();
        const slug = slugify(workspaceSlug || workspaceName);
        if (name.length < 2 || slug.length < 3) {
            setFormError('Name or slug is too short.');
            return;
        }
        try {
            const created = await createWorkspace({ name, slug });
            setWorkspaces(prev => [created, ...prev]);
            setWorkspaceModalOpen(false);
            setWorkspaceName('');
            setWorkspaceSlug('');
            await openWorkspace(created.id);
        } catch (e: any) {
            setFormError(e?.message || 'Failed to create workspace.');
        }
    };

    const handleCreateChannel = async () => {
        setFormError(null);
        const workspaceId = activeWorkspaceId ?? workspaces[0]?.id;
        if (!workspaceId) {
            setFormError('Create a workspace first.');
            return;
        }
        const name = channelName.trim();
        if (name.length < 2) {
            setFormError('Channel name is too short.');
            return;
        }
        try {
            const created = await createWorkspaceChannel(workspaceId, {
                type: channelType,
                name,
                topic: channelTopic.trim() || undefined,
            });
            setChannels(prev => [...prev, created].sort((a, b) => a.position - b.position));
            setChannelModalOpen(false);
            setChannelName('');
            setChannelTopic('');
            navigate(`/app/w/${workspaceId}/ch/${created.id}`);
        } catch (e: any) {
            setFormError(e?.message || 'Failed to create channel.');
        }
    };

    const handleCreateInvite = async () => {
        if (!inviteWorkspace) return;
        setFormError(null);
        setInviteBusy(true);
        try {
            const ttlSeconds = inviteTtl ? Number(inviteTtl) : undefined;
            const maxUses = inviteMaxUses ? Number(inviteMaxUses) : undefined;
            const invite = await createWorkspaceInvite(inviteWorkspace.id, {
                ttlSeconds: ttlSeconds && ttlSeconds > 0 ? ttlSeconds : undefined,
                maxUses: maxUses && maxUses > 0 ? maxUses : undefined,
            });
            setInviteLink(invite.inviteUrl || invite.token);
        } catch (e: any) {
            setFormError(e?.message || 'Failed to create invite.');
        } finally {
            setInviteBusy(false);
        }
    };

    const handleCopyInvite = async () => {
        if (!inviteLink) return;
        try {
            await navigator.clipboard.writeText(inviteLink);
        } catch (e) {
            console.warn('Failed to copy invite', e);
        }
    };

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
            if (activeUrl && myUserId) {
                setWorkspaceUserAvatarById(prev => ({ ...prev, [myUserId]: activeUrl }));
            }
        } catch (e: any) {
            setProfileError(e?.message || 'Failed to load profile');
        } finally {
            setProfileLoading(false);
        }
    }

    async function onAvatarSelected(file?: File | null) {
        if (!file) return;
        setAvatarBusy(true);
        setAvatarMessage(null);
        try {
            await uploadMyAvatar(file, 'GLOBAL');
            await loadProfileCard();
            if (myUserId) {
                const items = await resolveAvatarsBatch([myUserId]);
                const mine = items.find(x => x.userId === myUserId);
                const mineUrl = toAbsoluteAvatarUrl(mine?.contentUrl);
                if (mineUrl) {
                    setWorkspaceUserAvatarById(prev => ({ ...prev, [myUserId]: mineUrl }));
                }
            }
            setAvatarMessage('Avatar uploaded');
        } catch (e: any) {
            setAvatarMessage(e?.message || 'Failed to upload avatar');
        } finally {
            setAvatarBusy(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    }

    async function onActivateAvatar(assetId: number) {
        try {
            setAvatarBusy(true);
            setAvatarMessage(null);
            const item = await activateMyAvatar(assetId);
            const resolved = toAbsoluteAvatarUrl(item.contentUrl);
            await loadProfileCard();
            if (resolved && myUserId) {
                setWorkspaceUserAvatarById(prev => ({ ...prev, [myUserId]: resolved }));
            }
            setAvatarMessage('Active avatar updated');
        } catch (e: any) {
            setAvatarMessage(e?.message || 'Failed to switch avatar');
        } finally {
            setAvatarBusy(false);
        }
    }

    async function openDmWithUser(userId: number) {
        if (!userId || (myUserId !== null && userId === myUserId)) return;
        try {
            await createDmChannel(userId);
            navigate(`/app/dm/${userId}`);
        } catch (e) {
            console.warn('Failed to open DM', e);
        }
    }

    useEffect(() => {
        document.body.classList.add('app-shell-mode');
        return () => {
            document.body.classList.remove('app-shell-mode');
        };
    }, []);

    useEffect(() => {
        refreshWorkspaces();
        refreshDms();
    }, []);

    useEffect(() => {
        const userIds = Array.from(
            new Set(
                dms.map(dm => dm.peerUserId).filter((id): id is number => typeof id === 'number' && id > 0),
            ),
        );
        if (userIds.length === 0) {
            setDmAvatarUrlByUserId({});
            return;
        }

        let cancelled = false;
        const syncAvatars = async () => {
            try {
                const items = await resolveAvatarsBatch(userIds);
                if (cancelled) return;
                const next: Record<number, string> = {};
                for (const item of items) {
                    const url = toAbsoluteAvatarUrl(item.contentUrl);
                    if (url) next[item.userId] = url;
                }
                setDmAvatarUrlByUserId(next);
            } catch (e) {
                if (!cancelled) console.warn('Failed to sync DM avatars', e);
            }
        };

        void syncAvatars();

        return () => {
            cancelled = true;
        };
    }, [dms]);

    useEffect(() => {
        if (!activeWorkspaceId) return;
        let cancelled = false;
        setLoadingChannels(true);
        fetchWorkspaceChannels(activeWorkspaceId)
            .then(list => {
                if (cancelled) return;
                setChannels(list);
                if (channelId) return;
                if (list[0]) {
                    navigate(`/app/w/${activeWorkspaceId}/ch/${list[0].id}`, { replace: true });
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingChannels(false);
            });
        return () => {
            cancelled = true;
        };
    }, [activeWorkspaceId, channelId, navigate]);

    useEffect(() => {
        if (!myUserId) return;
        const uid = myUserId;
        resolveAvatarOnce();
        async function resolveAvatarOnce() {
            try {
                const [item, myProfile] = await Promise.all([
                    resolveAvatarsBatch([uid]),
                    fetchMyProfile(),
                ]);
                const url = toAbsoluteAvatarUrl(item[0]?.contentUrl);
                if (url) {
                    setWorkspaceUserAvatarById(prev => ({ ...prev, [uid]: url }));
                }
                setProfile(myProfile);
            } catch (e) {
                console.warn('Failed to resolve my avatar', e);
            }
        }
    }, [myUserId]);

    useEffect(() => {
        if (!activeWorkspaceId || isDmMode) {
            setWorkspaceUsers([]);
            setWorkspaceUserAvatarById({});
            return;
        }
        let cancelled = false;
        setLoadingWorkspaceUsers(true);
        fetchWorkspaceMembers(activeWorkspaceId)
            .then(items => {
                if (cancelled) return;
                setWorkspaceUsers(items);
            })
            .catch(e => {
                if (!cancelled) console.warn('Failed to load workspace users', e);
            })
            .finally(() => {
                if (!cancelled) setLoadingWorkspaceUsers(false);
            });
        return () => {
            cancelled = true;
        };
    }, [activeWorkspaceId, isDmMode]);

    useEffect(() => {
        const ids = workspaceUserIdsKey
            ? workspaceUserIdsKey.split(',').map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
            : [];
        if (ids.length === 0) {
            setWorkspaceUserAvatarById({});
            return;
        }
        let cancelled = false;
        resolveAvatarsBatch(ids)
            .then(items => {
                if (cancelled) return;
                const next: Record<number, string> = {};
                for (const item of items) {
                    const url = toAbsoluteAvatarUrl(item.contentUrl);
                    if (url) next[item.userId] = url;
                }
                setWorkspaceUserAvatarById(next);
            })
            .catch(e => {
                if (!cancelled) console.warn('Failed to resolve workspace avatars', e);
            });
        return () => {
            cancelled = true;
        };
    }, [workspaceUserIdsKey]);

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

    const value = useMemo(
        () => ({
            workspaces,
            channels,
            dms,
            activeWorkspace,
            loadingWorkspaces,
            loadingChannels,
            loadingDms,
            refreshWorkspaces,
            refreshDms,
            openWorkspace,
        }),
        [
            workspaces,
            channels,
            dms,
            activeWorkspace,
            loadingWorkspaces,
            loadingChannels,
            loadingDms,
        ],
    );

    return (
        <AppShellContext.Provider value={value}>
            <div className="app-shell" onClick={() => setContextMenu(null)}>
                <aside className="rail workspace-rail">
                    <button
                        className={`rail-brand-button${isDmMode ? ' active' : ''}`}
                        type="button"
                        onClick={() => navigate('/app/dm')}
                        aria-label="Direct messages"
                    >
                        C
                    </button>
                    <button
                        className="workspace-add"
                        type="button"
                        onClick={() => {
                            setFormError(null);
                            setWorkspaceModalOpen(true);
                        }}
                        aria-label="Add workspace"
                    >
                        +
                    </button>
                    <div className="rail-group">
                        {loadingWorkspaces ? (
                            <div className="rail-loading">Loading</div>
                        ) : workspaces.length === 0 ? (
                            <div className="rail-empty">+</div>
                        ) : (
                            workspaces.map(workspace => {
                                const isActive = workspace.id === activeWorkspaceId;
                                return (
                                    <button
                                        key={workspace.id}
                                        type="button"
                                        className={`workspace-pill${isActive ? ' active' : ''}`}
                                        onClick={() => openWorkspace(workspace.id)}
                                        onContextMenu={event => {
                                            event.preventDefault();
                                            setContextMenu({
                                                x: event.clientX,
                                                y: event.clientY,
                                                workspace,
                                            });
                                        }}
                                        aria-label={workspace.name}
                                    >
                                        {workspace.name.slice(0, 2).toUpperCase()}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <aside className="rail channel-rail">
                    <div className="rail-header">
                        <div>
                            <div className="rail-title">
                                {isDmMode ? 'Direct messages' : activeWorkspace?.name || 'Workspaces'}
                            </div>
                            <div className="rail-subtitle">
                                {isDmMode ? 'conversations' : 'channels'}
                            </div>
                        </div>
                        {!isDmMode && (
                            <button
                                className="ghost-btn"
                                type="button"
                                aria-label="Add channel"
                                onClick={() => {
                                    setFormError(null);
                                    setChannelModalOpen(true);
                                }}
                            >
                                +
                            </button>
                        )}
                    </div>

                    {isDmMode ? (
                        <div className="rail-section">
                            <div className="rail-section-title">Direct</div>
                            {loadingDms ? (
                                <div className="rail-loading">Loading</div>
                            ) : dms.length === 0 ? (
                                <div className="rail-empty">No DMs yet</div>
                            ) : (
                                <div className="dm-list">
                                    {dms.map(dm => (
                                        <NavLink
                                            key={dm.channelId}
                                            to={`/app/dm/${dm.peerUserId}`}
                                            className={({ isActive }) =>
                                                `dm-item${isActive ? ' active' : ''}`
                                            }
                                        >
                                            <span
                                                className="dm-avatar"
                                                style={
                                                    dmAvatarUrlByUserId[dm.peerUserId]
                                                        ? {
                                                              backgroundImage: `url(${dmAvatarUrlByUserId[dm.peerUserId]})`,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                {!dmAvatarUrlByUserId[dm.peerUserId]
                                                    ? initialsFromName(dm.peerUsername)
                                                    : null}
                                            </span>
                                            <span className="dm-name">{dm.peerUsername}</span>
                                            <span className="dm-snippet">
                                                {dm.lastMessageBody || 'No messages yet'}
                                            </span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rail-section">
                            <div className="rail-section-title">Channels</div>
                            {loadingChannels ? (
                                <div className="rail-loading">Loading</div>
                            ) : channels.length === 0 ? (
                                <div className="rail-empty">No channels yet</div>
                            ) : (
                                <div className="channel-list">
                                    {channels.map(channel => {
                                        const workspaceTarget = channel.workspaceId ?? activeWorkspaceId;
                                        if (!workspaceTarget) return null;
                                        return (
                                        <NavLink
                                            key={channel.id}
                                            to={`/app/w/${workspaceTarget}/ch/${channel.id}`}
                                            className={({ isActive }) =>
                                                `channel-item${isActive ? ' active' : ''}`
                                            }
                                        >
                                            <span className={`channel-icon ${channel.type.toLowerCase()}`}>
                                                {channel.type === 'VOICE' ? '◎' : '#'}
                                            </span>
                                            <span className="channel-name">{channel.name || 'untitled'}</span>
                                        </NavLink>
                                    );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                <main className="app-main">
                    <Outlet />
                </main>

                <aside className="rail info-rail">
                    <div className="info-card">
                        <div className="info-title">Workspace users</div>
                        {isDmMode ? (
                            <div className="info-sub">Open a workspace channel to see members</div>
                        ) : loadingWorkspaceUsers ? (
                            <div className="info-sub">Loading users…</div>
                        ) : sortedWorkspaceUsers.length === 0 ? (
                            <div className="info-sub">No users in this workspace</div>
                        ) : (
                            <div className="workspace-users-list">
                                {sortedWorkspaceUsers.map((user, index) => {
                                    const isMe = myUserId !== null && user.id === myUserId;
                                    const avatarUrl = workspaceUserAvatarById[user.id];
                                    return (
                                        <button
                                            key={user.id}
                                            type="button"
                                            className={`workspace-user-item${isMe ? ' is-me' : ''}`}
                                            onClick={() => {
                                                if (isMe) {
                                                    const next = !profileOpen;
                                                    setProfileOpen(next);
                                                    setAvatarMessage(null);
                                                    if (next) void loadProfileCard();
                                                    return;
                                                }
                                                void openDmWithUser(user.id);
                                            }}
                                        >
                                            <span
                                                className="workspace-user-avatar"
                                                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                                            >
                                                {!avatarUrl ? initialsFromName(user.username) : null}
                                            </span>
                                            <span className="workspace-user-meta">
                                                <span className="workspace-user-name">
                                                    {isMe ? 'You' : user.username}
                                                </span>
                                                <span className="workspace-user-role">{user.role}</span>
                                            </span>
                                            {!isMe && <span className="workspace-user-action">DM</span>}
                                            {isMe && index === 0 && <span className="workspace-user-action">Profile</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {profileOpen && (
                        <div className="info-card profile-inline-popup" ref={profilePopupRef}>
                            <div className="info-title">My profile</div>
                            {profileLoading ? (
                                <div className="info-sub">Loading…</div>
                            ) : profileError ? (
                                <div className="alert-banner">{profileError}</div>
                            ) : (
                                <>
                                    <div className="info-sub">#{profile?.id} · {profile?.username} · {profile?.role}</div>
                                    <div className="profile-upload-row">
                                        <button
                                            className="primary-btn"
                                            type="button"
                                            onClick={() => avatarInputRef.current?.click()}
                                            disabled={avatarBusy}
                                        >
                                            {avatarBusy ? 'Uploading…' : 'Upload new'}
                                        </button>
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            style={{ display: 'none' }}
                                            onChange={e => onAvatarSelected(e.target.files?.[0])}
                                        />
                                    </div>
                                    {avatarMessage && <div className="info-sub">{avatarMessage}</div>}
                                    <div className="profile-avatars-list">
                                        {avatars.length === 0 ? (
                                            <div className="info-sub">No uploaded avatars yet</div>
                                        ) : (
                                            avatars.map(item => {
                                                const url = toAbsoluteAvatarUrl(item.contentUrl);
                                                return (
                                                    <div className="profile-avatar-item" key={item.assetId}>
                                                        <div
                                                            className="profile-avatar-thumb"
                                                            style={url ? { backgroundImage: `url(${url})` } : undefined}
                                                        />
                                                        <div className="profile-avatar-info">
                                                            <div className="profile-avatar-name">asset #{item.assetId}</div>
                                                            <div className="profile-avatar-sub">{formatAvatarMeta(item)}</div>
                                                        </div>
                                                        <button
                                                            className="ghost-btn"
                                                            type="button"
                                                            disabled={avatarBusy || item.activeGlobal}
                                                            onClick={() => onActivateAvatar(item.assetId)}
                                                        >
                                                            {item.activeGlobal ? 'Active' : 'Activate'}
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
                </aside>
            </div>
            {workspaceModalOpen && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-title">New workspace</div>
                        <label className="modal-field">
                            <span>Name</span>
                            <input
                                value={workspaceName}
                                onChange={e => {
                                    setWorkspaceName(e.target.value);
                                    setFormError(null);
                                }}
                                placeholder="Acme Team"
                            />
                        </label>
                        <label className="modal-field">
                            <span>Slug</span>
                            <input
                                value={workspaceSlug}
                                onChange={e => {
                                    setWorkspaceSlug(e.target.value);
                                    setFormError(null);
                                }}
                                placeholder="acme-team"
                            />
                        </label>
                        {formError && <div className="alert-banner">{formError}</div>}
                        <div className="modal-actions">
                            <button className="ghost-btn" type="button" onClick={() => setWorkspaceModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="primary-btn" type="button" onClick={handleCreateWorkspace}>
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {channelModalOpen && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-title">New channel</div>
                        <label className="modal-field">
                            <span>Type</span>
                            <select
                                value={channelType}
                                onChange={e => setChannelType(e.target.value as 'TEXT' | 'VOICE')}
                            >
                                <option value="TEXT">Text</option>
                                <option value="VOICE">Voice</option>
                            </select>
                        </label>
                        <label className="modal-field">
                            <span>Name</span>
                            <input
                                value={channelName}
                                onChange={e => {
                                    setChannelName(e.target.value);
                                    setFormError(null);
                                }}
                                placeholder="general"
                            />
                        </label>
                        <label className="modal-field">
                            <span>Topic</span>
                            <input
                                value={channelTopic}
                                onChange={e => setChannelTopic(e.target.value)}
                                placeholder="Main updates and chatter"
                            />
                        </label>
                        {formError && <div className="alert-banner">{formError}</div>}
                        <div className="modal-actions">
                            <button className="ghost-btn" type="button" onClick={() => setChannelModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="primary-btn" type="button" onClick={handleCreateChannel}>
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {inviteModalOpen && inviteWorkspace && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal-title">Workspace invite</div>
                        <div className="modal-subtitle">{inviteWorkspace.name}</div>
                        <label className="modal-field">
                            <span>TTL (seconds)</span>
                            <input
                                value={inviteTtl}
                                onChange={e => setInviteTtl(e.target.value)}
                                placeholder="604800"
                            />
                        </label>
                        <label className="modal-field">
                            <span>Max uses</span>
                            <input
                                value={inviteMaxUses}
                                onChange={e => setInviteMaxUses(e.target.value)}
                                placeholder="10"
                            />
                        </label>
                        {inviteLink && (
                            <div className="invite-result">
                                <div className="invite-link">{inviteLink}</div>
                                <button className="ghost-btn" type="button" onClick={handleCopyInvite}>
                                    Copy
                                </button>
                            </div>
                        )}
                        {formError && <div className="alert-banner">{formError}</div>}
                        <div className="modal-actions">
                            <button
                                className="ghost-btn"
                                type="button"
                                onClick={() => {
                                    setInviteModalOpen(false);
                                    setInviteWorkspace(null);
                                    setInviteLink(null);
                                }}
                            >
                                Close
                            </button>
                            <button
                                className="primary-btn"
                                type="button"
                                onClick={handleCreateInvite}
                                disabled={inviteBusy}
                            >
                                {inviteBusy ? 'Creating…' : 'Create invite'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={event => event.stopPropagation()}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    <button
                        type="button"
                        className="context-menu-item"
                        onClick={() => {
                            setInviteWorkspace(contextMenu.workspace);
                            setInviteLink(null);
                            setInviteTtl('');
                            setInviteMaxUses('');
                            setInviteModalOpen(true);
                            setContextMenu(null);
                        }}
                    >
                        Create invite
                    </button>
                </div>
            )}
        </AppShellContext.Provider>
    );
}
