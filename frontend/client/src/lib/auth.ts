const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';


let accessTokenMem: string | null = null;
let refreshTokenMem: string | null = null;


export function setTokens(access?: string | null, refresh?: string | null) {
    if (typeof access === 'string') {
        accessTokenMem = access;
        sessionStorage.setItem(ACCESS_KEY, access);
    }
    if (typeof refresh === 'string') {
        refreshTokenMem = refresh;
        sessionStorage.setItem(REFRESH_KEY, refresh);
    }
}


export function loadTokensFromSession() {
    accessTokenMem = sessionStorage.getItem(ACCESS_KEY);
    refreshTokenMem = sessionStorage.getItem(REFRESH_KEY);
}


export function clearTokens() {
    accessTokenMem = null;
    refreshTokenMem = null;
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
}


export function getAccessToken() {
    return accessTokenMem;
}


export function getRefreshToken() {
    return refreshTokenMem;
}