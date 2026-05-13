import { useState } from 'react';
import type { MessageAttachmentDto, MessageDto } from '../api';

type MessageTimelineProps = {
    messages: MessageDto[];
    myUserId: number | null;
    listRef: React.RefObject<HTMLDivElement | null>;
    onScroll: () => void;
    avatarUrlByUserId?: Record<number, string>;
    onAvatarClick?: (userId: number | null) => void;
    showDateDividers?: boolean;
    onReply?: (message: MessageDto) => void;
    onToggleReaction?: (message: MessageDto, emoji: string, reactedByMe: boolean) => void;
};

function isCompactWithPrev(messages: MessageDto[], index: number): boolean {
    if (index === 0) return false;
    const current = messages[index];
    const prev = messages[index - 1];
    if (!current || !prev) return false;
    if (current.senderUserId !== prev.senderUserId) return false;
    if (!current.createdAt || !prev.createdAt) return false;
    const currentTs = new Date(current.createdAt).getTime();
    const prevTs = new Date(prev.createdAt).getTime();
    return currentTs - prevTs < 5 * 60 * 1000;
}

function formatMessageTime(value?: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getDayKey(value?: string | null): string {
    if (!value) return 'unknown';
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayDivider(value?: string | null): string {
    if (!value) return 'Unknown date';
    const target = new Date(value);
    const now = new Date();
    const todayKey = getDayKey(now.toISOString());
    const targetKey = getDayKey(value);
    if (targetKey === todayKey) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (targetKey === getDayKey(yesterday.toISOString())) return 'Yesterday';
    return target.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function initialsFromName(value?: string | null): string {
    const raw = (value || '').trim();
    if (!raw) return '?';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || '?';
}

const COMMON_REACTION_EMOJIS = [
    '🗿', '🐳', '😈', '🫡', '💀',
    '👍', '❤️', '😂', '🔥', '👏',
    '🙏', '😊', '😍', '😮', '😢',
    '🎉', '💯', '👌', '🤝', '🤔',
];
const MAX_REACTIONS_PER_MESSAGE = 3;

export default function MessageTimeline({
    messages,
    myUserId,
    listRef,
    onScroll,
    avatarUrlByUserId,
    onAvatarClick,
    showDateDividers = true,
    onReply,
    onToggleReaction,
}: MessageTimelineProps) {
    const [openReactionPickerFor, setOpenReactionPickerFor] = useState<number | null>(null);
    const [openImage, setOpenImage] = useState<MessageAttachmentDto | null>(null);

    function myReactionCount(message: MessageDto): number {
        return message.reactions?.filter(reaction => reaction.reactedByMe).length ?? 0;
    }

    function canToggleReaction(message: MessageDto, emoji: string): boolean {
        const existing = message.reactions?.find(reaction => reaction.emoji === emoji);
        if (existing?.reactedByMe) return true;
        return myReactionCount(message) < MAX_REACTIONS_PER_MESSAGE;
    }

    async function copyMessage(body: string) {
        if (!body) return;
        try {
            await navigator.clipboard.writeText(body);
        } catch (e) {
            console.warn('Failed to copy message', e);
        }
    }

    return (
        <div className="message-list channel-message-list" ref={listRef} onScroll={onScroll}>
            {messages.map((msg, index) => {
                const own = myUserId !== null && msg.senderUserId === myUserId;
                const compact = isCompactWithPrev(messages, index);
                const timeLabel = formatMessageTime(msg.createdAt);
                const prev = index > 0 ? messages[index - 1] : null;
                const shouldRenderDayDivider =
                    showDateDividers && (!prev || getDayKey(prev.createdAt) !== getDayKey(msg.createdAt));
                return (
                    <div key={msg.id}>
                        {shouldRenderDayDivider && (
                            <div className="message-day-divider">
                                <span>{formatDayDivider(msg.createdAt)}</span>
                            </div>
                        )}
                        <div
                            className={[
                                'message-row',
                                'channel-message-row',
                                own ? 'is-own' : 'is-other',
                                openReactionPickerFor === msg.id ? 'has-open-picker' : '',
                                compact ? 'is-compact' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {!own && !compact ? (
                                (() => {
                                    const senderId = msg.senderUserId ?? null;
                                    const avatarUrl = senderId ? avatarUrlByUserId?.[senderId] : undefined;
                                    const fallback = initialsFromName(
                                        msg.senderUsername || (senderId ? `User ${senderId}` : 'System'),
                                    );
                                    return (
                                        <button
                                            className="message-avatar"
                                            type="button"
                                            onClick={() => onAvatarClick?.(senderId)}
                                            disabled={!onAvatarClick}
                                            title={onAvatarClick ? 'Open DM' : undefined}
                                            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                                        >
                                            {!avatarUrl ? fallback : null}
                                        </button>
                                    );
                                })()
                            ) : (
                                <div className="channel-message-avatar-gap" />
                            )}
                            <div className="message-body channel-message-body">
                                {!compact && (
                                    <div className="message-meta channel-message-meta">
                                        <span className="message-author">
                                            {own ? 'You' : (msg.senderUsername || `User ${msg.senderUserId ?? 'System'}`)}
                                        </span>
                                        <span className="message-time">{timeLabel}</span>
                                    </div>
                                )}
                                <div
                                    className={[
                                        'message-text',
                                        'channel-message-bubble',
                                        msg.replyToMessageId ? 'has-reply' : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    {msg.replyToMessageId && (
                                        <div className="channel-message-reply-preview">
                                            <span className="channel-message-reply-author">
                                                {msg.replyToSenderUsername || 'Unknown'}
                                            </span>
                                            <span className="channel-message-reply-body">
                                                {msg.replyToBody || 'Image'}
                                            </span>
                                        </div>
                                    )}
                                    {msg.body?.trim() ? <span>{msg.body}</span> : null}
                                    {!!msg.attachments?.length && (
                                        <div className="channel-message-attachments">
                                            {msg.attachments.map(attachment => (
                                                <button
                                                    key={attachment.id}
                                                    type="button"
                                                    className="channel-message-attachment"
                                                    onClick={() => setOpenImage(attachment)}
                                                >
                                                    <img
                                                        src={attachment.thumbnailUrl || attachment.displayUrl}
                                                        alt={attachmentAlt(attachment)}
                                                        loading="lazy"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <span className="channel-message-inline-time">{timeLabel}</span>
                                    <div className="channel-message-actions">
                                        <button
                                            type="button"
                                            className="channel-message-action-btn"
                                            disabled={!msg.body?.trim()}
                                            onClick={() => copyMessage(msg.body)}
                                        >
                                            Copy
                                        </button>
                                        <button
                                            type="button"
                                            className="channel-message-action-btn"
                                            onClick={() => onReply?.(msg)}
                                        >
                                            Reply
                                        </button>
                                        <button
                                            type="button"
                                            className="channel-message-action-btn"
                                            onClick={() =>
                                                setOpenReactionPickerFor(prev => (prev === msg.id ? null : msg.id))
                                            }
                                        >
                                            React
                                        </button>
                                        {openReactionPickerFor === msg.id && (
                                            <div className="channel-message-emoji-picker">
                                                {COMMON_REACTION_EMOJIS.map(emoji => {
                                                    const existing = msg.reactions?.find(r => r.emoji === emoji);
                                                    const allowed = canToggleReaction(msg, emoji);
                                                    return (
                                                        <button
                                                            key={`${msg.id}-pick-${emoji}`}
                                                            type="button"
                                                            className="channel-message-emoji-btn"
                                                            disabled={!allowed}
                                                            title={!allowed ? 'Max 3 reactions per message' : undefined}
                                                            onClick={() => {
                                                                onToggleReaction?.(
                                                                    msg,
                                                                    emoji,
                                                                    !!existing?.reactedByMe,
                                                                );
                                                                setOpenReactionPickerFor(null);
                                                            }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {!!msg.reactions?.length && (
                                    <div className="channel-message-reactions">
                                        {msg.reactions.map(reaction => (
                                            <button
                                                key={`${msg.id}-${reaction.emoji}`}
                                                type="button"
                                                className={[
                                                    'channel-message-reaction-btn',
                                                    reaction.reactedByMe ? 'is-active' : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                disabled={!canToggleReaction(msg, reaction.emoji)}
                                                title={
                                                    !canToggleReaction(msg, reaction.emoji)
                                                        ? 'Max 3 reactions per message'
                                                        : undefined
                                                }
                                                onClick={() =>
                                                    onToggleReaction?.(msg, reaction.emoji, reaction.reactedByMe)
                                                }
                                            >
                                                <span>{reaction.emoji}</span>
                                                <span>{reaction.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            {openImage && (
                <div
                    className="message-image-lightbox"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setOpenImage(null)}
                >
                    <button
                        type="button"
                        className="message-image-lightbox__close"
                        onClick={() => setOpenImage(null)}
                    >
                        Close
                    </button>
                    <img
                        src={openImage.displayUrl}
                        alt={attachmentAlt(openImage)}
                        onClick={event => event.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

function attachmentAlt(attachment: MessageAttachmentDto): string {
    return attachment.originalFilename || 'Image attachment';
}
