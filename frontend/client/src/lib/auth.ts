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
