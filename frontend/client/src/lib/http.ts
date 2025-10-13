const API_BASE = import.meta.env.VITE_API_BASE as string;
const REFRESH_HEADER = import.meta.env.VITE_REFRESH_HEADER as string;

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

function buildHeaders(init?: RequestInit): Headers {
    const h = new Headers(init?.headers);

    if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');

    const token = getAccessToken();
    if (token) {
        h.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
    } else {
        h.delete('Authorization');
    }
    return h;
}

async function tryRefresh(): Promise<boolean> {
    const rt = getRefreshToken();
    if (!rt) return false;

    const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { [REFRESH_HEADER]: rt },
        credentials: 'include',
    });
    if (!resp.ok) return false;

    const newAccess = resp.headers.get('Authorization');
    const newRefresh = resp.headers.get(REFRESH_HEADER);
    const access = newAccess?.startsWith('Bearer ') ? newAccess.slice(7) : newAccess || undefined;

    setTokens(access, newRefresh || undefined);
    return !!access;
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
    let resp = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: buildHeaders(init),
        credentials: 'include',
    });

    if (resp.status === 401) {
        const ok = await tryRefresh();
        if (!ok) {
            clearTokens();
            throw new Error('Unauthorized');
        }

        resp = await fetch(`${API_BASE}${path}`, {
            ...init,
            headers: buildHeaders(init),
            credentials: 'include',
        });
    }

    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    if (resp.status === 204) return undefined as T;
    return (await resp.json()) as T;
}