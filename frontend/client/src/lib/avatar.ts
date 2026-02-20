function hashString(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

const avatarOverrideByIdentity = new Map<string, string>();

export function getAvatarColor(identity: string) {
    const hash = hashString(identity || 'anon');
    const hue = (hash % 12) * 30;
    const sat = 60 + (hash % 20);
    const light = 42 + ((hash >> 4) % 14);
    return `hsl(${hue} ${sat}% ${light}%)`;
}

export function getAvatarUrl(identity: string, name?: string) {
    const overridden = avatarOverrideByIdentity.get(identity);
    if (overridden) return overridden;

    const color = getAvatarColor(identity);
    const letter = (name || identity || '?').trim().slice(0, 1).toUpperCase() || '?';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="${color}"/><text x="60" y="70" font-family="Inter, system-ui, sans-serif" font-size="56" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;

    if (typeof btoa === 'function') {
        const utf8 = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16)),
        );
        return `data:image/svg+xml;base64,${btoa(utf8)}`;
    }
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function setAvatarUrlOverride(identity: string, avatarUrl?: string | null) {
    if (!identity) return;
    if (avatarUrl && avatarUrl.trim().length > 0) {
        avatarOverrideByIdentity.set(identity, avatarUrl);
        return;
    }
    avatarOverrideByIdentity.delete(identity);
}
