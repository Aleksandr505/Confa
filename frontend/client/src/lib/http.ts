const API_BASE = import.meta.env.VITE_API_BASE as string;

import { getAccessToken, setTokens, clearTokens } from './auth';

function buildHeaders(init?: RequestInit): Headers {
    const h = new Headers(init?.headers);

    const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    if (!isFormDataBody && !h.has('Content-Type')) h.set('Content-Type', 'application/json');

    const token = getAccessToken();
    if (token) {
        h.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
    } else {
        h.delete('Authorization');
    }
    return h;
}

async function tryRefresh(): Promise<boolean> {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
    });
    if (!resp.ok) return false;

    const newAccess = resp.headers.get('Authorization');
    const access = newAccess?.startsWith('Bearer ')
        ? newAccess.slice(7)
        : newAccess || undefined;

    setTokens(access);
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

    if (!resp.ok) {
        throw new Error(`${resp.status} ${resp.statusText}`);
    }

    const raw = await resp.text();

    if (!raw || !raw.trim()) {
        return undefined as T;
    }

    try {
        return JSON.parse(raw) as T;
    } catch (e) {
        throw new Error('Failed to parse JSON response');
    }
}
