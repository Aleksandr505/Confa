import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppShell } from './AppShellContext';
import {
    type MessageDto,
    addMessageReaction,
    createDmChannel,
    createDmMessage,
    fetchDmMessages,
    markChannelRead,
    removeMessageReaction,
    resolveAvatarsBatch,
    uploadMessageImage,
} from '../api';
import { getUserIdentity } from '../lib/auth';
import MessageTimeline from '../components/MessageTimeline';
import { getErrorMessage } from '../lib/errors';
import MessageComposer from '../components/MessageComposer';
import type { CompressedChatImage } from '../lib/imageCompression';

export default function DmViewPage() {
    const { peerId } = useParams();
    const { dms, refreshDms } = useAppShell();
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [avatarUrlByUserId, setAvatarUrlByUserId] = useState<Record<number, string>>({});
    const resolvedAvatarByUserIdRef = useRef<Map<number, string | null>>(new Map());
    const listRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef(true);
    const lastMarkedReadMessageIdRef = useRef<number | null>(null);
    const myUserId = useMemo(() => {
        const identity = getUserIdentity();
        if (!identity) return null;
        const parsed = Number(identity);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);

    const numericPeerId = peerId ? Number(peerId) : undefined;
    const peer = useMemo(
        () => dms.find(dm => dm.peerUserId === numericPeerId),
        [dms, numericPeerId],
    );
    const avatarUserIds = useMemo(
        () =>
            Array.from(
                new Set(
                    messages
                        .map(msg => msg.senderUserId)
                        .filter((id): id is number => typeof id === "number" && id > 0),
                ),
            ).sort((a, b) => a - b),
        [messages],
    );
    const avatarUsersKey = avatarUserIds.join(',');

    useEffect(() => {
        resolvedAvatarByUserIdRef.current.clear();
        setAvatarUrlByUserId({});
        lastMarkedReadMessageIdRef.current = null;
    }, [peer?.channelId]);

    useEffect(() => {
        if (!numericPeerId) return;
        let active = true;

        const mergeById = (prev: MessageDto[], incoming: MessageDto[]) => {
            const map = new Map<number, MessageDto>();
            for (const msg of prev) map.set(msg.id, msg);
            for (const msg of incoming) map.set(msg.id, msg);
            return Array.from(map.values()).sort((a, b) => a.id - b.id);
        };

        const loadMessages = async (silent: boolean) => {
            if (!silent) {
                setLoading(true);
                setError(null);
            }
            try {
                const page = await fetchDmMessages(numericPeerId);
                if (!active) return;
                const items = page.items.slice().reverse();
                setMessages(prev => mergeById(prev, items));
            } catch (e: unknown) {
                if (!silent && active) {
                    setError(getErrorMessage(e, 'Failed to load messages'));
                }
            } finally {
                if (!silent && active) setLoading(false);
            }
        };

        setMessages([]);
        loadMessages(false);
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            loadMessages(true);
        }, 3000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [numericPeerId]);

    useEffect(() => {
        if (!avatarUsersKey) {
            resolvedAvatarByUserIdRef.current.clear();
            setAvatarUrlByUserId({});
            return;
        }
        const userIds = avatarUsersKey
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0);
        if (userIds.length === 0) return;
        const active = new Set(userIds);
        for (const cachedUserId of resolvedAvatarByUserIdRef.current.keys()) {
            if (!active.has(cachedUserId)) {
                resolvedAvatarByUserIdRef.current.delete(cachedUserId);
            }
        }
        const unresolvedUserIds = userIds.filter(userId => !resolvedAvatarByUserIdRef.current.has(userId));
        if (unresolvedUserIds.length === 0) return;

        let cancelled = false;
        const syncAvatars = async () => {
            try {
                const items = await resolveAvatarsBatch(unresolvedUserIds);
                if (cancelled) return;
                const resolvedBatch = new Map<number, string | null>();
                for (const item of items) {
                    const resolvedUrl = item.contentUrl
                        ? item.contentUrl.startsWith('http')
                            ? item.contentUrl
                            : `${import.meta.env.VITE_API_BASE}${item.contentUrl}`
                        : null;
                    resolvedBatch.set(item.userId, resolvedUrl);
                }
                setAvatarUrlByUserId(prev => {
                    const next = { ...prev };
                    let changed = false;
                    for (const userId of unresolvedUserIds) {
                        const url = resolvedBatch.get(userId) ?? null;
                        resolvedAvatarByUserIdRef.current.set(userId, url);
                        if (url) {
                            if (next[userId] !== url) {
                                next[userId] = url;
                                changed = true;
                            }
                        } else if (next[userId]) {
                            delete next[userId];
                            changed = true;
                        }
                    }
                    return changed ? next : prev;
                });
            } catch (e) {
                if (!cancelled) console.warn('Failed to sync DM message avatars', e);
            }
        };

        void syncAvatars();

        return () => {
            cancelled = true;
        };
    }, [avatarUsersKey]);
    
    useEffect(() => {
        const list = listRef.current;
        if (!list || !autoScrollRef.current) return;
        list.scrollTop = list.scrollHeight;
    }, [messages]);

    useEffect(() => {
        if (!peer?.channelId || messages.length === 0) return;
        const latest = messages[messages.length - 1];
        if (!latest?.id) return;
        if (lastMarkedReadMessageIdRef.current === latest.id) return;
        let cancelled = false;
        void markChannelRead(peer.channelId, { lastReadMessageId: latest.id })
            .then(() => {
                if (cancelled) return;
                lastMarkedReadMessageIdRef.current = latest.id;
                void refreshDms(true);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [messages, peer?.channelId, refreshDms]);

    const handleScroll = () => {
        const list = listRef.current;
        if (!list) return;
        const threshold = 48;
        const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        const atBottom = distanceToBottom <= threshold;
        autoScrollRef.current = atBottom;
        setShowScrollDown(!atBottom);
    };

    const scrollToBottom = () => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = list.scrollHeight;
        autoScrollRef.current = true;
        setShowScrollDown(false);
    };

    async function sendMessage(body: string, image?: CompressedChatImage) {
        if (!numericPeerId) return;
        try {
            let attachmentIds: number[] = [];
            if (image) {
                const channel = peer?.channelId
                    ? { id: peer.channelId }
                    : await createDmChannel(numericPeerId);
                const attachment = await uploadMessageImage(image.file, { channelId: channel.id });
                attachmentIds = [attachment.id];
            }
            const msg = await createDmMessage(numericPeerId, body, replyTo?.id, attachmentIds);
            setMessages(prev => [...prev, msg]);
            setReplyTo(null);
            setError(null);
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Failed to send message'));
            throw e;
        }
    }

    async function toggleReaction(message: MessageDto, emoji: string, reactedByMe: boolean) {
        try {
            const reactions = reactedByMe
                ? await removeMessageReaction(message.id, emoji)
                : await addMessageReaction(message.id, emoji);
            setMessages(prev =>
                prev.map(item => (item.id === message.id ? { ...item, reactions } : item)),
            );
        } catch (e) {
            console.warn('Failed to toggle reaction', e);
        }
    }

    return (
        <section className="channel-view">
            <header className="channel-header">
                <div>
                    <div className="channel-title">@{peer?.peerUsername || 'Direct message'}</div>
                    <div className="channel-subtitle">Private conversation</div>
                </div>
                <div className="channel-actions">
                    <button className="ghost-btn" type="button">Call</button>
                    <button className="primary-btn" type="button">Share</button>
                </div>
            </header>

            <div className="message-panel">
                {loading ? (
                    <div className="empty-subtitle">Loading messages…</div>
                ) : error ? (
                    <div className="alert-banner">{error}</div>
                ) : messages.length === 0 ? (
                    <div className="empty-subtitle">No messages yet. Say hello.</div>
                ) : (
                    <MessageTimeline
                        messages={messages}
                        myUserId={myUserId}
                        listRef={listRef}
                        onScroll={handleScroll}
                        avatarUrlByUserId={avatarUrlByUserId}
                        onReply={setReplyTo}
                        onToggleReaction={toggleReaction}
                    />
                )}
                {showScrollDown && (
                    <button className="scroll-down-btn" type="button" onClick={scrollToBottom}>
                        ↓ Newer
                    </button>
                )}
            </div>

            <MessageComposer
                key={`dm-composer-${numericPeerId}`}
                placeholder={`Message ${peer?.peerUsername || 'user'}`}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onSend={sendMessage}
            />
        </section>
    );
}
