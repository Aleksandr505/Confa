import { http } from './lib/http';
import { setTokens, loadTokensFromSession } from './lib/auth';

export async function login(username: string, password: string) {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE}/auth`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) throw new Error('Login failed');

    const authHeader = resp.headers.get('Authorization');
    const access = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!access) throw new Error('Access token missing');
    setTokens(access || undefined);
}

export async function fetchLivekitToken(room?: string, displayName?: string) {
    const data = await http<{ token: string }>(`/livekit/token`, {
        method: 'POST',
        body: JSON.stringify({ room, displayName }),
    });
    return data.token;
}

export async function fetchChannelLivekitToken(channelId: number): Promise<string> {
    const data = await http<{ token: string }>(`/api/channels/${channelId}/livekit-token`, {
        method: 'POST',
    });
    return data.token;
}

export type WorkspaceDto = {
    id: number;
    name: string;
    slug: string;
    ownerUserId: number;
    createdAt: string;
};

export type ChannelType = 'TEXT' | 'VOICE' | 'DM';

export type ChannelDto = {
    id: number;
    workspaceId: number | null;
    type: ChannelType;
    name: string | null;
    topic: string | null;
    isPrivate: boolean;
    position: number;
    createdByUserId: number;
    createdAt: string;
};

export type MessageDto = {
    id: number;
    channelId: number;
    senderUserId: number | null;
    senderUsername?: string | null;
    kind: 'USER' | 'SYSTEM' | 'BOT';
    body: string;
    replyToMessageId?: number | null;
    replyToBody?: string | null;
    replyToSenderUsername?: string | null;
    reactions?: MessageReactionDto[];
    createdAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
};

export type MessagePageDto = {
    items: MessageDto[];
    nextCursor?: number | null;
};

export type MessageReactionDto = {
    emoji: string;
    count: number;
    reactedByMe: boolean;
};

export type DmSummary = {
    channelId: number;
    peerUserId: number;
    peerUsername: string;
    lastMessageBody?: string | null;
    lastMessageAt?: string | null;
};

export async function fetchWorkspaces(): Promise<WorkspaceDto[]> {
    return http<WorkspaceDto[]>('/api/workspaces', { method: 'GET' });
}

export async function createWorkspace(payload: { name: string; slug: string }): Promise<WorkspaceDto> {
    return http<WorkspaceDto>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchWorkspaceChannels(workspaceId: number): Promise<ChannelDto[]> {
    return http<ChannelDto[]>(`/api/workspaces/${workspaceId}/channels`, { method: 'GET' });
}

export async function createWorkspaceChannel(
    workspaceId: number,
    payload: { type: ChannelType; name: string; topic?: string; isPrivate?: boolean; position?: number },
): Promise<ChannelDto> {
    return http<ChannelDto>(`/api/workspaces/${workspaceId}/channels`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export type WorkspaceInvite = {
    token: string;
    inviteUrl?: string | null;
    workspaceId: number;
    workspaceName: string;
    expiresAt?: string | null;
    maxUses?: number | null;
    usedCount?: number | null;
};

export async function createWorkspaceInvite(
    workspaceId: number,
    payload?: { ttlSeconds?: number; maxUses?: number },
): Promise<WorkspaceInvite> {
    return http<WorkspaceInvite>(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
}

export async function acceptWorkspaceInvite(token: string): Promise<WorkspaceDto> {
    return http<WorkspaceDto>('/api/workspaces/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

export async function createDmChannel(peerId: number): Promise<ChannelDto> {
    return http<ChannelDto>(`/api/dm/${peerId}`, {
        method: 'POST',
    });
}

export async function fetchChannelMessages(
    channelId: number,
    cursor?: number,
    limit?: number,
): Promise<MessagePageDto> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', String(cursor));
    if (limit) params.set('limit', String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return http<MessagePageDto>(`/api/channels/${channelId}/messages${suffix}`, { method: 'GET' });
}

export async function createChannelMessage(
    channelId: number,
    body: string,
    replyToMessageId?: number | null,
): Promise<MessageDto> {
    return http<MessageDto>(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToMessageId: replyToMessageId ?? null }),
    });
}

export async function fetchDmList(): Promise<DmSummary[]> {
    return http<DmSummary[]>('/api/dms', { method: 'GET' });
}

export async function fetchDmMessages(
    peerId: number,
    cursor?: number,
    limit?: number,
): Promise<MessagePageDto> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', String(cursor));
    if (limit) params.set('limit', String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return http<MessagePageDto>(`/api/dm/${peerId}/messages${suffix}`, { method: 'GET' });
}

export async function createDmMessage(
    peerId: number,
    body: string,
    replyToMessageId?: number | null,
): Promise<MessageDto> {
    return http<MessageDto>(`/api/dm/${peerId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToMessageId: replyToMessageId ?? null }),
    });
}

export async function addMessageReaction(messageId: number, emoji: string): Promise<MessageReactionDto[]> {
    return http<MessageReactionDto[]>(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
    });
}

export async function removeMessageReaction(messageId: number, emoji: string): Promise<MessageReactionDto[]> {
    return http<MessageReactionDto[]>(
        `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: 'DELETE' },
    );
}

export type RoomAccess = {
    id: number;
    name: string;
    role: 'OWNER' | 'MEMBER';
};

export type RoomAccessSummary = RoomAccess & {
    participantCount: number;
    participantNames: string[];
};

export type RoomInvite = {
    token: string;
    inviteUrl?: string | null;
    roomName: string;
    expiresAt?: string | null;
    maxUses?: number | null;
    usedCount?: number | null;
};

export async function fetchMyRooms(): Promise<RoomAccess[]> {
    return http<RoomAccess[]>('/rooms/my', { method: 'GET' });
}

export async function fetchMyRoomsSummary(): Promise<RoomAccessSummary[]> {
    return http<RoomAccessSummary[]>('/rooms/my/summary', { method: 'GET' });
}

export async function createRoom(payload: { name: string }): Promise<RoomAccess> {
    return http<RoomAccess>('/rooms', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function createInvite(
    roomName: string,
    payload?: { ttlSeconds?: number; maxUses?: number },
): Promise<RoomInvite> {
    return http<RoomInvite>(`/rooms/${encodeURIComponent(roomName)}/invites`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
}

export async function acceptInvite(token: string): Promise<RoomAccess> {
    return http<RoomAccess>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

export type AgentRole = 'bored' | 'friendly' | 'funny';

export type AgentInfoDto = {
    sid: string;
    identity: string;
    name: string;
    muted: boolean;
};

export type KickAgentDto = {
    agentIdentity: string;
};

export type FocusAgentDto = {
    activeAgentIdentity: string;
    userIdentity: string;
};

export async function fetchRoomAgents(room: string): Promise<AgentInfoDto[]> {
    return http<AgentInfoDto[]>(`/rooms/${encodeURIComponent(room)}/agents`, {
        method: 'GET',
    });
}

export async function inviteAgent(room: string, agentRole: AgentRole): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/invite`, {
        method: 'POST',
        body: JSON.stringify({ agentRole }),
    });
}

export async function kickAgent(room: string, payload: KickAgentDto): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/kick`, {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );
}

export async function muteAgent(
    room: string,
    agentSid: string,
    isMuted: boolean,
): Promise<void> {
    await http<void>(
        `/rooms/${encodeURIComponent(room)}/agents/mute`,
        {
            method: 'POST',
            body: JSON.stringify({ agentSid, isMuted }),
        },
    );
}

export async function focusAgent(room: string, payload: FocusAgentDto): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/focus`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export type RoomMetadata = {
    isAgentsEnabled: boolean;
    maxAgents?: number;
    enabledBy?: string | null;
    enabledAt?: string | null;
};

export async function fetchRoomMetadata(room: string): Promise<RoomMetadata> {
    return http<RoomMetadata>(`/rooms/${encodeURIComponent(room)}/config`, {
        method: 'GET',
    });
}

export async function enableRoomAgents(room: string): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/enable`, {
        method: 'POST',
    });
}

export async function disableRoomAgents(room: string): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/disable`, {
        method: 'POST',
    });
}


loadTokensFromSession();
