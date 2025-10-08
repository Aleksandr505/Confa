export function isAuthed() {
    return !!sessionStorage.getItem('access_token');
}

