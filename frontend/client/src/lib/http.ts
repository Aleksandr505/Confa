const API_BASE = import.meta.env.VITE_API_BASE as string;
const REFRESH_HEADER = import.meta.env.VITE_REFRESH_HEADER as string;


import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';


function bearer(token?: string | null) {
    if (!token) return {};
    const hasPrefix = token.startsWith('Bearer ');
    return { 'Authorization': hasPrefix ? token : `Bearer ${token}` };
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
    const access = newAccess?.startsWith('Bearer ') ? newAccess.slice(7) : newAccess;
    setTokens(access || undefined, newRefresh || undefined);
    return !!access;
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...bearer(getAccessToken()),
    };

    const resp = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: headers,
        credentials: 'include',
    });

    if (resp.status === 401) {
        const ok = await tryRefresh();
        if (!ok) {
            clearTokens();
            throw new Error('Unauthorized');
        }
        const resp2 = await fetch(`${API_BASE}${path}`, {
            ...init,
            headers: headers,
            credentials: 'include',
        });
        if (!resp2.ok) throw new Error(`${resp2.status} ${resp2.statusText}`);
        if (resp2.status === 204) return undefined as T;
        return await resp2.json() as T;
    }

    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    if (resp.status === 204) return undefined as T;
    return await resp.json() as T;
}