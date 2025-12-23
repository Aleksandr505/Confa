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

export type RoomAccess = {
    id: number;
    name: string;
    role: 'OWNER' | 'MEMBER';
    isPrivate: boolean;
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

export async function createRoom(payload: { name: string; isPrivate?: boolean }): Promise<RoomAccess> {
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
