import { http } from './lib/http';
import { setTokens, loadTokensFromSession } from './lib/auth';

const REFRESH_HEADER = import.meta.env.VITE_REFRESH_HEADER as string;

export type LoginResponse = void;

export async function login(username: string, password: string) {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE}/auth`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) throw new Error('Login failed');

    const authHeader = resp.headers.get('Authorization');
    const refreshHeader = resp.headers.get(REFRESH_HEADER);
    const access = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!access) throw new Error('Access token missing');
    setTokens(access || undefined, refreshHeader || undefined);
}

export async function fetchLivekitToken(room?: string, displayName?: string) {
    const data = await http<{ token: string }>(`/livekit/token`, {
        method: 'POST',
        body: JSON.stringify({ room, displayName }),
    });
    return data.token;
}

loadTokensFromSession();
