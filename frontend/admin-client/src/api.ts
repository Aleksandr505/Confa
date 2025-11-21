import { http } from './lib/http';
import {setTokens} from "./lib/auth.ts";

export type BootstrapStatusResponse = {
    isInitialized: boolean;
};

export async function getBootstrapStatus(): Promise<BootstrapStatusResponse> {
    return http<BootstrapStatusResponse>('/admin/bootstrap/status');
}

export type BootstrapRequest = {
    serviceKey: string;
    username: string;
};

export type BootstrapResponse = {
    username: string;
    password: string;
};

export async function createFirstAdmin(payload: BootstrapRequest): Promise<BootstrapResponse> {
    return http<BootstrapResponse>('/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function loginAdmin(username: string, password: string): Promise<void> {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE}/auth`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
        throw new Error('Login failed');
    }

    const authHeader = resp.headers.get('Authorization');
    const access = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!access) throw new Error('Access token missing');
    setTokens(access || undefined);
}

export type UserDto = {
    id: string;
    username: string;
    role: 'USER' | 'ADMIN';
    blockedAt?: string | null;
};

export type CreateUserRequest = {
    username: string;
    password: string;
    role: 'USER' | 'ADMIN';
};

export async function fetchUsers(): Promise<UserDto[]> {
    return http<UserDto[]>('/admin/users', { method: 'GET' });
}

export async function createUser(payload: CreateUserRequest): Promise<UserDto> {
    return http<UserDto>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function blockUser(id: string): Promise<UserDto> {
    return http<UserDto>(`/admin/users/${id}/block`, {
        method: 'PATCH',
    });
}

export async function unblockUser(id: string): Promise<UserDto> {
    return http<UserDto>(`/admin/users/${id}/unblock`, {
        method: 'PATCH',
    });
}

export async function deleteUser(id: string): Promise<void> {
    await http<void>(`/admin/users/${id}`, {
        method: 'DELETE',
    });
}



export type RoomSummaryDto = {
    name: string;
    numParticipants: number;
};

export type AgentInfoDto = {
    sid: string;
    identity: string;
    name: string;
    muted: boolean;
};

export type ParticipantInfoDto = {
    sid: string;
    identity: string;
    name: string;
    kind: string;
    metadata?: string | null;
};

export type KickAgentDto = {
    agentIdentity: string;
};

export async function fetchActiveRooms(): Promise<RoomSummaryDto[]> {
    return http<RoomSummaryDto[]>('/rooms', {
        method: 'GET',
    });
}

export async function fetchAgentsByRoom(room: string): Promise<AgentInfoDto[]> {
    return http<AgentInfoDto[]>(`/rooms/${encodeURIComponent(room)}/agents`, {
        method: 'GET',
    });
}

export async function fetchParticipantsByRoom(room: string): Promise<ParticipantInfoDto[]> {
    return http<ParticipantInfoDto[]>(`/rooms/${encodeURIComponent(room)}/participants`, {
        method: 'GET',
    });
}

export async function kickAgent(room: string, payload: KickAgentDto): Promise<void> {
    await http<void>(`/rooms/${encodeURIComponent(room)}/agents/kick`, {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );
}
