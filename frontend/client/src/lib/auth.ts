const ACCESS_KEY = 'access_token';


let accessTokenMem: string | null = null;


export function setTokens(access?: string | null) {
    if (typeof access === 'string') {
        accessTokenMem = access;
        localStorage.setItem(ACCESS_KEY, access);
    }
}


export function loadTokensFromSession() {
    accessTokenMem = localStorage.getItem(ACCESS_KEY);
}


export function clearTokens() {
    accessTokenMem = null;
    localStorage.removeItem(ACCESS_KEY);
}


export function getAccessToken() {
    return accessTokenMem;
}


type JwtPayload = Record<string, unknown>;

function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const [, payload] = token.split('.');
        if (!payload) return null;
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const parsed = JSON.parse(json) as unknown;
        return parsed && typeof parsed === 'object' ? parsed as JwtPayload : null;
    } catch {
        return null;
    }
}

export function getUserRoles(): string[] {
    const token = getAccessToken();
    if (!token) return [];
    const payload = decodeJwtPayload(token);
    if (!payload) return [];

    const raw =
        payload.scope ||
        payload.scp ||
        payload.authorities ||
        payload.roles;

    if (!raw) return [];

    if (Array.isArray(raw)) {
        return raw.filter((role): role is string => typeof role === 'string');
    }

    if (typeof raw === 'string') {
        return raw.split(/\s+/).filter(Boolean);
    }

    return [];
}

export function isAdmin(): boolean {
    const roles = getUserRoles();
    return roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
}

export function getUserIdentity(): string | null {
    const token = getAccessToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    const identity = payload.sub || payload.user || payload.username;
    return typeof identity === 'string' ? identity : null;
}
