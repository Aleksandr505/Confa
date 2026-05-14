import type { MessageAttachmentDto, MessageDto } from '../api';

const ATTACHMENT_URL_REFRESH_MARGIN_MS = 60_000;

export function mergeMessagesById(prev: MessageDto[], incoming: MessageDto[]): MessageDto[] {
    const prevById = new Map<number, MessageDto>();
    for (const msg of prev) prevById.set(msg.id, msg);

    const mergedById = new Map<number, MessageDto>();
    for (const msg of prev) mergedById.set(msg.id, msg);
    for (const msg of incoming) {
        const existing = prevById.get(msg.id);
        mergedById.set(msg.id, existing ? mergeMessage(existing, msg) : msg);
    }

    return Array.from(mergedById.values()).sort((a, b) => a.id - b.id);
}

function mergeMessage(existing: MessageDto, incoming: MessageDto): MessageDto {
    return {
        ...incoming,
        attachments: preserveFreshAttachmentUrls(existing.attachments, incoming.attachments),
    };
}

function preserveFreshAttachmentUrls(
    existing: MessageAttachmentDto[] | undefined,
    incoming: MessageAttachmentDto[] | undefined,
): MessageAttachmentDto[] {
    if (!incoming?.length) return incoming ?? [];
    if (!existing?.length) return incoming;

    const existingById = new Map<number, MessageAttachmentDto>();
    for (const attachment of existing) {
        existingById.set(attachment.id, attachment);
    }

    return incoming.map(attachment => {
        const current = existingById.get(attachment.id);
        if (!current || !hasFreshUrls(current)) {
            return attachment;
        }
        return {
            ...attachment,
            thumbnailUrl: current.thumbnailUrl || attachment.thumbnailUrl,
            displayUrl: current.displayUrl || attachment.displayUrl,
            urlExpiresAt: current.urlExpiresAt || attachment.urlExpiresAt,
        };
    });
}

function hasFreshUrls(attachment: MessageAttachmentDto): boolean {
    if (!attachment.urlExpiresAt) return false;
    const expiresAt = new Date(attachment.urlExpiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt - Date.now() > ATTACHMENT_URL_REFRESH_MARGIN_MS;
}
